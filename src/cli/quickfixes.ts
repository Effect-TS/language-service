import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Path from "@effect/platform/Path"
import * as Ansi from "@effect/printer-ansi/Ansi"
import * as Doc from "@effect/printer-ansi/AnsiDoc"
import { createProjectService } from "@typescript-eslint/project-service"
import * as Arr from "effect/Array"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type * as ts from "typescript"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeCheckerApi from "../core/TypeCheckerApi"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils"
import * as TypeParser from "../core/TypeParser"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"
import { diagnostics as diagnosticsDefinitions } from "../diagnostics"
import { NoFilesToCheckError } from "./diagnostics"
import { renderTextChange } from "./setup/diff-renderer"
import { extractEffectLspOptions, getFileNamesInTsConfig, TypeScriptContext } from "./utils"

interface QuickFixInfo {
  diagnostic: {
    start: number
    end: number
    messageText: string
    code: number
    ruleName: string
  }
  fixes: Array<{
    fixName: string
    description: string
    changes: ReadonlyArray<ts.FileTextChanges>
  }>
}

/**
 * Checks if a fix is a "skip" fix (skip next line or skip file)
 */
const isSkipFix = (fixName: string): boolean => fixName.endsWith("_skipNextLine") || fixName.endsWith("_skipFile")

/**
 * Render a single quick fix with its diff
 */
const renderQuickFix = (
  sourceFile: ts.SourceFile,
  fix: { fixName: string; description: string; changes: ReadonlyArray<ts.FileTextChanges> }
): Doc.AnsiDoc => {
  const lines: Array<Doc.AnsiDoc> = []

  // Fix header
  lines.push(Doc.empty)
  lines.push(
    Doc.cat(
      Doc.cat(
        Doc.cat(
          Doc.annotate(Doc.text("  Fix: "), Ansi.bold),
          Doc.annotate(Doc.text(fix.fixName), Ansi.cyan)
        ),
        Doc.text(" - ")
      ),
      Doc.text(fix.description)
    )
  )
  lines.push(Doc.annotate(Doc.text("  " + "─".repeat(60)), Ansi.blackBright))

  // Render the diff for each file change
  for (const fileChange of fix.changes) {
    if (fileChange.fileName === sourceFile.fileName) {
      for (const textChange of fileChange.textChanges) {
        const diffLines = renderTextChange(sourceFile, textChange)
        for (const diffLine of diffLines) {
          lines.push(Doc.cat(Doc.text("  "), diffLine))
        }
      }
    }
  }

  return Doc.vsep(lines)
}

/**
 * Render a diagnostic with all its quick fixes
 */
const renderDiagnosticWithFixes = (
  sourceFile: ts.SourceFile,
  info: QuickFixInfo,
  tsInstance: typeof ts
): Doc.AnsiDoc => {
  const lines: Array<Doc.AnsiDoc> = []

  // Get line and column for the diagnostic
  const { character, line } = tsInstance.getLineAndCharacterOfPosition(sourceFile, info.diagnostic.start)

  // Diagnostic header: file:line:col effect(ruleName): message
  const locationStr = `${sourceFile.fileName}:${line + 1}:${character + 1}`
  lines.push(
    Doc.cat(
      Doc.cat(
        Doc.cat(
          Doc.cat(
            Doc.annotate(Doc.text(locationStr), Ansi.cyan),
            Doc.text(" ")
          ),
          Doc.annotate(Doc.text(`effect(${info.diagnostic.ruleName})`), Ansi.yellow)
        ),
        Doc.text(": ")
      ),
      Doc.text(info.diagnostic.messageText)
    )
  )

  // Render each fix
  for (const fix of info.fixes) {
    lines.push(renderQuickFix(sourceFile, fix))
  }

  lines.push(Doc.empty)

  return Doc.vsep(lines)
}

const BATCH_SIZE = 50

export const quickfixes = Command.make(
  "quickfixes",
  {
    file: Options.file("file").pipe(
      Options.optional,
      Options.withDescription("The full path of the file to check for quick fixes.")
    ),
    project: Options.file("project").pipe(
      Options.optional,
      Options.withDescription("The full path of the project tsconfig.json file to check for quick fixes.")
    )
  },
  Effect.fn("quickfixes")(function*({ file, project }) {
    const path = yield* Path.Path
    const tsInstance = yield* TypeScriptContext

    // Collect files to check
    const filesToCheck = Option.isSome(project)
      ? yield* getFileNamesInTsConfig(project.value)
      : new Set<string>()

    if (Option.isSome(file)) {
      filesToCheck.add(path.resolve(file.value))
    }

    if (filesToCheck.size === 0) {
      return yield* new NoFilesToCheckError()
    }

    let totalDiagnosticsWithFixes = 0

    for (const batch of Arr.chunksOf(filesToCheck, BATCH_SIZE)) {
      const { service } = createProjectService({ options: { loadTypeScriptPlugins: false } })

      for (const filePath of batch) {
        service.openClientFile(filePath)
        try {
          const scriptInfo = service.getScriptInfo(filePath)
          if (!scriptInfo) continue

          const projectInfo = scriptInfo.getDefaultProject()
          const languageService = projectInfo.getLanguageService(true)
          const program = languageService.getProgram()
          if (!program) continue

          const sourceFile = program.getSourceFile(filePath)
          if (!sourceFile) continue

          const pluginConfig = extractEffectLspOptions(program.getCompilerOptions())
          if (!pluginConfig) continue

          // Get diagnostics and code fixes
          const result = pipe(
            LSP.getSemanticDiagnosticsWithCodeFixes(diagnosticsDefinitions, sourceFile),
            TypeParser.nanoLayer,
            TypeCheckerUtils.nanoLayer,
            TypeScriptUtils.nanoLayer,
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
            Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
            Nano.provideService(TypeScriptApi.TypeScriptApi, tsInstance),
            Nano.provideService(
              LanguageServicePluginOptions.LanguageServicePluginOptions,
              { ...LanguageServicePluginOptions.parse(pluginConfig), diagnosticsName: false }
            ),
            Nano.run,
            Either.getOrElse(() => ({ diagnostics: [], codeFixes: [] }))
          )

          // Group fixes by diagnostic position and code
          const diagnosticMap = new Map<string, QuickFixInfo>()

          for (const diagnostic of result.diagnostics) {
            if (diagnostic.start === undefined) continue

            const key = `${diagnostic.start}-${diagnostic.start + (diagnostic.length ?? 0)}-${diagnostic.code}`
            const ruleName = Object.values(diagnosticsDefinitions).find((_) => _.code === diagnostic.code)?.name
              ?? `unknown(${diagnostic.code})`

            if (!diagnosticMap.has(key)) {
              diagnosticMap.set(key, {
                diagnostic: {
                  start: diagnostic.start,
                  end: diagnostic.start + (diagnostic.length ?? 0),
                  messageText: tsInstance.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
                  code: diagnostic.code,
                  ruleName
                },
                fixes: []
              })
            }
          }

          // Get format context for applying fixes
          const formatContext = tsInstance.formatting.getFormatContext(
            tsInstance.getDefaultFormatCodeSettings(),
            { getNewLine: () => "\n" } as ts.LanguageServiceHost
          )

          // Apply each code fix to get its text changes
          for (const codeFix of result.codeFixes) {
            // Skip the "skip" fixes
            if (isSkipFix(codeFix.fixName)) continue

            const key = `${codeFix.start}-${codeFix.end}-${codeFix.code}`
            const info = diagnosticMap.get(key)
            if (!info) continue

            // Get the text changes by running the fix
            const changes = tsInstance.textChanges.ChangeTracker.with(
              {
                formatContext,
                host: { getNewLine: () => "\n" } as ts.LanguageServiceHost,
                preferences: {}
              },
              (changeTracker) =>
                pipe(
                  codeFix.apply,
                  Nano.provideService(TypeScriptApi.ChangeTracker, changeTracker),
                  Nano.run
                )
            )

            info.fixes.push({
              fixName: codeFix.fixName,
              description: codeFix.description,
              changes
            })
          }

          // Filter to only diagnostics with actionable fixes
          const diagnosticsWithFixes = Array.from(diagnosticMap.values()).filter(
            (info) => info.fixes.length > 0
          )

          if (diagnosticsWithFixes.length === 0) continue

          // Sort by position
          diagnosticsWithFixes.sort((a, b) => a.diagnostic.start - b.diagnostic.start)

          totalDiagnosticsWithFixes += diagnosticsWithFixes.length

          // Render output for this file
          for (const info of diagnosticsWithFixes) {
            const doc = renderDiagnosticWithFixes(sourceFile, info, tsInstance)
            yield* Console.log(doc.pipe(Doc.render({ style: "pretty" })))
          }
        } finally {
          service.closeClientFile(filePath)
        }
      }
      yield* Effect.yieldNow()
    }

    if (totalDiagnosticsWithFixes === 0) {
      yield* Console.log("No quick fixes available.")
    } else {
      yield* Console.log(
        Doc.annotate(
          Doc.text(`Found ${totalDiagnosticsWithFixes} diagnostic(s) with quick fixes.`),
          Ansi.bold
        ).pipe(Doc.render({ style: "pretty" }))
      )
    }
  })
).pipe(
  Command.withDescription("Shows diagnostics with available quick fixes and their proposed changes.")
)
