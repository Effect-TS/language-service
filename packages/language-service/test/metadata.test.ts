import { diagnosticGroups } from "@effect/language-service/core/DiagnosticGroup"
import * as LanguageServicePluginOptions from "@effect/language-service/core/LanguageServicePluginOptions"
import * as LSP from "@effect/language-service/core/LSP"
import * as Nano from "@effect/language-service/core/Nano"
import * as TypeCheckerApi from "@effect/language-service/core/TypeCheckerApi"
import * as TypeCheckerUtils from "@effect/language-service/core/TypeCheckerUtils"
import * as TypeParser from "@effect/language-service/core/TypeParser"
import * as TypeScriptApi from "@effect/language-service/core/TypeScriptApi"
import * as TypeScriptUtils from "@effect/language-service/core/TypeScriptUtils"
import { diagnostics } from "@effect/language-service/diagnostics"
import { pipe } from "effect/Function"
import * as Result from "effect/Result"
import * as fs from "node:fs"
import * as path from "node:path"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import { getExamplesDirForVersion, getHarnessDirForVersion, getHarnessVersion } from "./utils/harness"
import { configFromSourceComment, createServicesWithMockedVFS } from "./utils/mocks"

interface PreviewFile {
  harnessVersion: "v3" | "v4"
  fileName: string
  sourceText: string
}

interface TrimmedPreview {
  sourceText: string
  removedChars: number
}

const metadataPath = path.join(__dirname, "..", "src", "metadata.json")
const diagnosticGroupOrder = new Map(diagnosticGroups.map((group, index) => [group.id, index]))

function getPreviewFileForDiagnostic(diagnostic: LSP.DiagnosticDefinition): PreviewFile {
  for (const harnessVersion of ["v4", "v3"] as const) {
    const fileName = path.join("examples", "diagnostics", `${diagnostic.name}_preview.ts`)
    const absolutePath = path.join(getHarnessDirForVersion(harnessVersion), fileName)
    if (fs.existsSync(absolutePath)) {
      return {
        harnessVersion,
        fileName,
        sourceText: fs.readFileSync(absolutePath, "utf8")
      }
    }
  }
  throw new Error(`Missing preview file for ${diagnostic.name}`)
}

function getDiagnosticOutput(
  diagnostic: LSP.DiagnosticDefinition,
  previewFile: PreviewFile
): Array<{ start: number; end: number; text: string }> {
  const { languageService, program, sourceFile } = createServicesWithMockedVFS(
    getHarnessDirForVersion(previewFile.harnessVersion),
    getExamplesDirForVersion(previewFile.harnessVersion),
    previewFile.fileName,
    previewFile.sourceText
  )

  try {
    const result = pipe(
      LSP.getSemanticDiagnosticsWithCodeFixes([diagnostic], sourceFile),
      TypeParser.nanoLayer,
      TypeCheckerUtils.nanoLayer,
      TypeScriptUtils.nanoLayer,
      Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
      Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
      Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
      Nano.provideService(
        LanguageServicePluginOptions.LanguageServicePluginOptions,
        LanguageServicePluginOptions.parse({
          ...LanguageServicePluginOptions.defaults,
          diagnostics: true,
          refactors: false,
          quickinfo: false,
          completions: false,
          goto: false,
          namespaceImportPackages: ["effect"],
          ...configFromSourceComment(previewFile.sourceText)
        })
      ),
      Nano.map(({ diagnostics }) =>
        diagnostics
          .slice()
          .sort((a, b) => (a.start || 0) - (b.start || 0))
          .map((item) => ({
            start: item.start || 0,
            end: (item.start || 0) + (item.length || 0),
            text: ts.flattenDiagnosticMessageText(item.messageText, "\n")
          }))
      ),
      Nano.unsafeRun
    )

    if (!Result.isSuccess(result)) {
      throw new Error(`Failed to collect metadata for ${diagnostic.name}`)
    }

    return Result.getOrElse(result, () => [])
  } finally {
    languageService.dispose()
  }
}

function trimLeadingDirectives(sourceText: string): TrimmedPreview {
  const lines = sourceText.split("\n")
  let removedChars = 0
  let index = 0

  while (index < lines.length) {
    const line = lines[index]!
    if (!line.startsWith("// @")) {
      break
    }
    removedChars += line.length
    if (index < lines.length - 1) {
      removedChars += 1
    }
    index++
  }

  return {
    sourceText: lines.slice(index).join("\n"),
    removedChars
  }
}

describe.skipIf(getHarnessVersion() !== "v4")("Metadata", () => {
  it("generates metadata.json from diagnostic previews", { timeout: 120_000 }, () => {
    const rules = diagnostics
      .slice()
      .sort((a, b) => {
        const groupOrderDiff = (diagnosticGroupOrder.get(a.group) ?? Number.MAX_SAFE_INTEGER) -
          (diagnosticGroupOrder.get(b.group) ?? Number.MAX_SAFE_INTEGER)

        return groupOrderDiff !== 0 ? groupOrderDiff : a.name.localeCompare(b.name)
      })
      .map((diagnostic) => {
        const previewFile = getPreviewFileForDiagnostic(diagnostic)
        const preview = trimLeadingDirectives(previewFile.sourceText)
        return {
          name: diagnostic.name,
          group: diagnostic.group,
          description: diagnostic.description,
          defaultSeverity: diagnostic.severity,
          fixable: diagnostic.fixable,
          supportedEffect: diagnostic.supportedEffect,
          preview: {
            sourceText: preview.sourceText,
            diagnostics: getDiagnosticOutput(diagnostic, previewFile).map((item) => ({
              ...item,
              start: Math.max(0, item.start - preview.removedChars),
              end: Math.max(0, item.end - preview.removedChars)
            }))
          }
        }
      })

    const metadata = {
      groups: diagnosticGroups,
      rules
    }

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n")

    expect(rules).toHaveLength(diagnostics.length)
    expect(fs.existsSync(metadataPath)).toBe(true)
  })
})
