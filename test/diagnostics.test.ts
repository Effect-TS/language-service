import * as LSP from "@effect/language-service/core/LSP"
import * as Nano from "@effect/language-service/core/Nano"
import { diagnostics } from "@effect/language-service/diagnostics"
import * as TypeCheckerApi from "@effect/language-service/utils/TypeCheckerApi"
import * as TypeScriptApi from "@effect/language-service/utils/TypeScriptApi"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import { createMockLanguageServiceHost } from "./utils/MockLanguageServiceHost.js"

const getExamplesDiagnosticsDir = () => path.join(__dirname, "..", "examples", "diagnostics")

function testDiagnosticOnExample(diagnostic: LSP.DiagnosticDefinition, fileName: string) {
  const sourceText = fs.readFileSync(path.join(getExamplesDiagnosticsDir(), fileName))
    .toString("utf8")
  it(fileName, () => {
    // create the language service
    const languageServiceHost = createMockLanguageServiceHost(fileName, sourceText)
    const languageService = ts.createLanguageService(
      languageServiceHost,
      undefined,
      ts.LanguageServiceMode.Semantic
    )
    const program = languageService.getProgram()
    if (!program) throw new Error("No typescript program!")
    const sourceFile = program.getSourceFile(fileName)
    if (!sourceFile) throw new Error("No source file " + fileName + " in VFS")

    // check and assert the refactor is executable
    const canApply = pipe(
      diagnostic.apply(sourceFile),
      Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
      Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
      Nano.provideService(LSP.PluginOptions, {
        diagnostics: true,
        quickinfo: false
      }),
      Nano.run
    )

    if (Either.isLeft(canApply)) {
      expect("// no diagnostics").toMatchSnapshot()
      return
    }

    // sort by start position
    canApply.right.sort((a, b) => a.node.getStart(sourceFile) - b.node.getStart(sourceFile))

    // create human readable messages
    const humanMessages = canApply.right.map((error) => {
      const start = ts.getLineAndCharacterOfPosition(sourceFile, error.node.getStart(sourceFile))
      const end = ts.getLineAndCharacterOfPosition(sourceFile, error.node.getEnd())
      const errorSourceCode = sourceText.substring(
        error.node.getStart(sourceFile),
        error.node.getEnd()
      )

      return errorSourceCode + "\n" +
        `${start.line + 1}:${start.character} - ${
          end.line + 1
        }:${end.character} | ${error.messageText}`
    }).join("\n\n")
    expect(humanMessages).toMatchSnapshot()
  })
}

function testFiles(diagnostic: LSP.DiagnosticDefinition, fileNames: Array<string>) {
  for (const fileName of fileNames) {
    describe(fileName, () => {
      testDiagnosticOnExample(diagnostic, fileName)
    })
  }
}

function getExampleFileNames(diagnosticName: string): Array<string> {
  return fs.readdirSync(getExamplesDiagnosticsDir())
    .filter((fileName) =>
      fileName === diagnosticName + ".ts" ||
      fileName.startsWith(diagnosticName + "_") && fileName.endsWith(".ts")
    )
}

Object.keys(diagnostics).map((diagnosticName) =>
  // @ts-expect-error
  testFiles(diagnostics[diagnosticName], getExampleFileNames(diagnosticName))
)
