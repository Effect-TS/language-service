import { createProjectService } from "@typescript-eslint/project-service"
import * as Arr from "effect/Array"
import * as Console from "effect/Console"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as Path from "effect/Path"
import * as Result from "effect/Result"
import { CliError, Command, Flag } from "effect/unstable/cli"
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
import { ansi, BOLD, CYAN, DIM, YELLOW } from "./ansi"
import { NoFilesToCheckError } from "./diagnostics"
import { renderTextChange } from "./setup/diff-renderer"
import { extractEffectLspOptions, getFileNamesInTsConfig, TypeScriptContext } from "./utils"

// Build a set of valid diagnostic names and codes for validation
const validDiagnosticNames = new Set(diagnosticsDefinitions.map((_) => _.name))
const validDiagnosticCodes = new Set(diagnosticsDefinitions.map((_) => String(_.code)))
const diagnosticCodeByName = new Map(diagnosticsDefinitions.map((_) => [_.name, _.code]))

export class ColumnRequiresLineError extends Data.TaggedError("ColumnRequiresLineError")<{}> {
  get message(): string {
    return "The --column option requires --line to be specified."
  }
}

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
): string => {
  const lines: Array<string> = []

  // Fix header
  lines.push("")
  lines.push(`  ${ansi("Fix: ", BOLD)}${ansi(fix.fixName, CYAN)} - ${fix.description}`)
  lines.push(ansi("  " + "\u2500".repeat(60), DIM))

  // Render the diff for each file change
  for (const fileChange of fix.changes) {
    if (fileChange.fileName === sourceFile.fileName) {
      for (const textChange of fileChange.textChanges) {
        const diffLines = renderTextChange(sourceFile, textChange)
        for (const diffLine of diffLines) {
          lines.push(`  ${diffLine}`)
        }
      }
    }
  }

  return lines.join("\n")
}

/**
 * Render a diagnostic with all its quick fixes
 */
const renderDiagnosticWithFixes = (
  sourceFile: ts.SourceFile,
  info: QuickFixInfo,
  tsInstance: typeof ts
): string => {
  const lines: Array<string> = []

  // Get line and column for the diagnostic
  const { character, line } = tsInstance.getLineAndCharacterOfPosition(sourceFile, info.diagnostic.start)

  // Diagnostic header: file:line:col effect(ruleName): message
  const locationStr = `${sourceFile.fileName}:${line + 1}:${character + 1}`
  lines.push(
    `${ansi(locationStr, CYAN)} ${ansi(`effect(${info.diagnostic.ruleName})`, YELLOW)}: ${info.diagnostic.messageText}`
  )

  // Render each fix
  for (const fix of info.fixes) {
    lines.push(renderQuickFix(sourceFile, fix))
  }

  lines.push("")

  return lines.join("\n")
}

const BATCH_SIZE = 50

export const quickfixes = Command.make(
  "quickfixes",
  {
    file: Flag.file("file").pipe(
      Flag.optional,
      Flag.withDescription("The full path of the file to check for quick fixes.")
    ),
    project: Flag.file("project").pipe(
      Flag.optional,
      Flag.withDescription("The full path of the project tsconfig.json file to check for quick fixes.")
    ),
    code: Flag.string("code").pipe(
      Flag.withDescription("Filter by diagnostic name or code (e.g., 'floatingEffect' or '5')."),
      Flag.mapEffect((value) => {
        // Validate that the code is a known diagnostic name or code
        if (validDiagnosticNames.has(value)) {
          // It's a diagnostic name, return the corresponding code
          return Effect.succeed(diagnosticCodeByName.get(value)!)
        }
        if (validDiagnosticCodes.has(value)) {
          // It's a diagnostic code, return as number
          return Effect.succeed(Number(value))
        }
        // Invalid code
        const validValues = [...validDiagnosticNames].sort().join(", ")
        return Effect.fail(
          new CliError.UserError({
            cause: new Error(`Invalid diagnostic code '${value}'. Valid values: ${validValues}`)
          })
        )
      }),
      Flag.optional
    ),
    line: Flag.integer("line").pipe(
      Flag.withDescription("Filter by line number (1-based)."),
      Flag.optional
    ),
    column: Flag.integer("column").pipe(
      Flag.withDescription("Filter by column number (1-based). Requires --line to be specified."),
      Flag.optional
    ),
    fix: Flag.string("fix").pipe(
      Flag.withDescription("Filter by fix name (e.g., 'floatingEffect_yieldStar')."),
      Flag.optional
    )
  },
  Effect.fn("quickfixes")(function*({ code, column, file, fix, line, project }) {
    // Validate that column requires line
    if (Option.isSome(column) && Option.isNone(line)) {
      return yield* new ColumnRequiresLineError()
    }

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
            Result.getOrElse(
              () => ({ diagnostics: [], codeFixes: [] } as { diagnostics: Array<any>; codeFixes: Array<any> })
            )
          )

          // Group fixes by diagnostic position and code
          const diagnosticMap = new Map<string, QuickFixInfo>()

          for (const diagnostic of result.diagnostics) {
            if (diagnostic.start === undefined) continue
            // Filter by code option if provided
            if (Option.isSome(code) && diagnostic.code !== code.value) continue

            // Filter by line and column if provided
            if (Option.isSome(line)) {
              const pos = tsInstance.getLineAndCharacterOfPosition(sourceFile, diagnostic.start)
              // line option is 1-based, TypeScript uses 0-based
              if (pos.line !== line.value - 1) continue
              // If column is also provided, check it too
              if (Option.isSome(column) && pos.character !== column.value - 1) continue
            }

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
            // Filter by fix name if provided
            if (Option.isSome(fix) && codeFix.fixName !== fix.value) continue

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
                  codeFix.apply as Nano.Nano<void>,
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
            yield* Console.log(renderDiagnosticWithFixes(sourceFile, info, tsInstance))
          }
        } finally {
          service.closeClientFile(filePath)
        }
      }
      yield* Effect.yieldNow
    }

    if (totalDiagnosticsWithFixes === 0) {
      yield* Console.log("No quick fixes available.")
    } else {
      yield* Console.log(
        ansi(`Found ${totalDiagnosticsWithFixes} diagnostic(s) with quick fixes.`, BOLD)
      )
    }
  })
).pipe(
  Command.withDescription("Shows diagnostics with available quick fixes and their proposed changes.")
)
