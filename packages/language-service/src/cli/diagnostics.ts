import { createProjectService } from "@typescript-eslint/project-service"
import * as Array from "effect/Array"
import * as Console from "effect/Console"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import { identity, pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as Path from "effect/Path"
import * as Result from "effect/Result"
import { Command, Flag } from "effect/unstable/cli"
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
import { extractEffectLspOptions, getFileNamesInTsConfig, TypeScriptContext } from "./utils"

interface DiagnosticReporterState {
  tsInstance: typeof ts
  checkedCount: number
  errorsCount: number
  warningsCount: number
  messagesCount: number
  languageService: ts.LanguageService | undefined
  totalFilesCount: number
  currentFileIndex: number
}

interface DiagnosticReporter {
  onBegin: (state: DiagnosticReporterState) => Effect.Effect<void>
  onFile: (state: DiagnosticReporterState, filePath: string) => Effect.Effect<void>
  onDiagnostics: (
    state: DiagnosticReporterState,
    filePath: string,
    diagnostics: ReadonlyArray<ts.Diagnostic>
  ) => Effect.Effect<void>
  onEnd: (state: DiagnosticReporterState) => Effect.Effect<void>
}

export type OutputFormat = "json" | "pretty" | "text" | "github-actions"
export type SeverityLevel = "error" | "warning" | "message"

interface JsonFormattedDiagnostic {
  file: string
  line: number
  column: number
  endLine: number
  endColumn: number
  severity: SeverityLevel
  code: number
  name: string
  message: string
}

export class NoFilesToCheckError extends Data.TaggedError("NoFilesToCheckError")<{}> {
  get message(): string {
    return "No files to check. Please provide an existing .ts file or a project tsconfig.json"
  }
}

export class DiagnosticsFoundError extends Data.TaggedError("DiagnosticsFoundError")<{
  errorsCount: number
  warningsCount: number
  messagesCount: number
}> {
  get message(): string {
    return `Found ${this.errorsCount} errors, ${this.warningsCount} warnings and ${this.messagesCount} messages.`
  }
}

const categoryToSeverity = (category: ts.DiagnosticCategory, tsInstance: typeof ts): SeverityLevel => {
  switch (category) {
    case tsInstance.DiagnosticCategory.Error:
      return "error"
    case tsInstance.DiagnosticCategory.Warning:
      return "warning"
    default:
      return "message"
  }
}

const formatDiagnosticForJson = (
  diagnostic: ts.Diagnostic,
  tsInstance: typeof ts
): JsonFormattedDiagnostic | undefined => {
  if (!diagnostic.file || diagnostic.start === undefined) return undefined

  const { character, line } = tsInstance.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start)
  const endPos = diagnostic.start + (diagnostic.length ?? 0)
  const { character: endCharacter, line: endLine } = tsInstance.getLineAndCharacterOfPosition(diagnostic.file, endPos)

  const diagnosticName = Object.values(diagnosticsDefinitions).find((_) => _.code === diagnostic.code)?.name
    ?? `effect(${diagnostic.code})`

  return {
    file: diagnostic.file.fileName,
    line: line + 1,
    column: character + 1,
    endLine: endLine + 1,
    endColumn: endCharacter + 1,
    severity: categoryToSeverity(diagnostic.category, tsInstance),
    code: diagnostic.code,
    name: diagnosticName,
    message: tsInstance.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
  }
}

const severityToGitHubCommand = (severity: SeverityLevel): string => {
  switch (severity) {
    case "error":
      return "error"
    case "warning":
      return "warning"
    default:
      return "notice"
  }
}

const formatDiagnosticForGitHubActions = (
  diagnostic: ts.Diagnostic,
  tsInstance: typeof ts
): string | undefined => {
  const output = formatDiagnosticForJson(diagnostic, tsInstance)
  if (!output) return undefined

  const command = severityToGitHubCommand(output.severity)
  const message = output.message.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A")

  return `::${command} file=${output.file},line=${output.line},col=${output.column},endLine=${output.endLine},endColumn=${output.endColumn},title=${output.name}::${message}`
}

const parseSeverityFilter = (
  severityOption: Option.Option<string>
): Set<SeverityLevel> | undefined => {
  if (Option.isNone(severityOption)) return undefined
  const levels = severityOption.value.split(",").map((s) => s.trim().toLowerCase())
  const validLevels = new Set<SeverityLevel>()
  for (const level of levels) {
    if (level === "error" || level === "warning" || level === "message") {
      validLevels.add(level)
    }
  }
  return validLevels.size > 0 ? validLevels : undefined
}

const diagnosticPrettyFormatter = Effect.gen(function*() {
  const path = yield* Path.Path
  return identity<DiagnosticReporter>({
    onBegin: () => Effect.void,
    onFile: () => Effect.void,
    onDiagnostics: (state, _filePath, diagnostics) =>
      Effect.sync(() => {
        const rawFormatted = state.tsInstance.formatDiagnosticsWithColorAndContext(diagnostics, {
          getCanonicalFileName: (fileName) => path.resolve(fileName),
          getCurrentDirectory: () => path.resolve("."),
          getNewLine: () => "\n"
        })
        return Object.values(diagnosticsDefinitions).reduce(
          (text, def) => text.replace(new RegExp(`TS${def.code}:`, "g"), `effect(${def.name}):`),
          rawFormatted
        )
      }).pipe(Effect.flatMap(Console.log), Effect.when(Effect.sync(() => diagnostics.length > 0))),
    onEnd: (state) =>
      Console.log(
        `Checked ${state.checkedCount} files out of ${state.totalFilesCount} files. \n${state.errorsCount} errors, ${state.warningsCount} warnings and ${state.messagesCount} messages.`
      )
  })
})
const diagnosticTextFormatter = Effect.gen(function*() {
  const path = yield* Path.Path
  return identity<DiagnosticReporter>({
    onBegin: () => Effect.void,
    onFile: () => Effect.void,
    onDiagnostics: (state, _filePath, diagnostics) =>
      Effect.sync(() => {
        const rawFormatted = state.tsInstance.formatDiagnostics(diagnostics, {
          getCanonicalFileName: (fileName) => path.resolve(fileName),
          getCurrentDirectory: () => path.resolve("."),
          getNewLine: () => "\n"
        })
        return Object.values(diagnosticsDefinitions).reduce(
          (text, def) => text.replace(new RegExp(`TS${def.code}:`, "g"), `effect(${def.name}):`),
          rawFormatted
        )
      }).pipe(Effect.flatMap(Console.log), Effect.when(Effect.sync(() => diagnostics.length > 0))),
    onEnd: (state) =>
      Console.log(
        `Checked ${state.checkedCount} files out of ${state.totalFilesCount} files. \n${state.errorsCount} errors, ${state.warningsCount} warnings and ${state.messagesCount} messages.`
      )
  })
})

const diagnosticJsonFormatter = Effect.gen(function*() {
  let hasEmittedDiagnostics = false
  return identity<DiagnosticReporter>({
    onBegin: () => Console.log(`{ "diagnostics": [`),
    onFile: () => Effect.void,
    onDiagnostics: (state, _filePath, diagnostics) =>
      Effect.gen(function*() {
        for (const diagnostic of diagnostics) {
          const jsonDiagnostic = formatDiagnosticForJson(diagnostic, state.tsInstance)
          if (jsonDiagnostic) {
            if (hasEmittedDiagnostics) yield* Console.log(", ")
            yield* Console.log(JSON.stringify(jsonDiagnostic, null, 2))
            hasEmittedDiagnostics = true
          }
        }
      }),
    onEnd: (state) =>
      Console.log(`], "summary": ${
        JSON.stringify(
          {
            filesChecked: state.checkedCount,
            totalFiles: state.totalFilesCount,
            errors: state.errorsCount,
            warnings: state.warningsCount,
            messages: state.messagesCount
          },
          null,
          2
        )
      } }`)
  })
})

const diagnosticGitHubActionsFormatter = Effect.gen(function*() {
  return identity<DiagnosticReporter>({
    onBegin: () => Effect.void,
    onFile: () => Effect.void,
    onDiagnostics: (state, _filePath, diagnostics) =>
      Effect.gen(function*() {
        if (diagnostics.length === 0) return
        for (const diagnostic of diagnostics) {
          const formatted = formatDiagnosticForGitHubActions(diagnostic, state.tsInstance)
          if (formatted) {
            yield* Console.log(formatted)
          }
        }
      }),
    onEnd: (state) =>
      Console.log(
        `Checked ${state.checkedCount} files out of ${state.totalFilesCount} files. \n${state.errorsCount} errors, ${state.warningsCount} warnings and ${state.messagesCount} messages.`
      )
  })
})

const withDiagnosticsProgressFormatter = (formatter: DiagnosticReporter) =>
  Effect.gen(function*() {
    return identity<DiagnosticReporter>({
      onBegin: (state) =>
        Effect.sync(() => process.stderr.write(`Starting diagnostics for ${state.totalFilesCount} files...\n`)).pipe(
          Effect.flatMap(() => formatter.onBegin(state))
        ),
      onFile: (state, filePath) =>
        Effect.sync(() =>
          process.stderr.write(
            `[${state.currentFileIndex}/${state.totalFilesCount}] ${filePath.slice(-60).padStart(60)}\r`
          )
        ).pipe(
          Effect.flatMap(() => formatter.onFile(state, filePath))
        ),
      onDiagnostics: (state, filePath, diagnostics) => formatter.onDiagnostics(state, filePath, diagnostics),
      onEnd: (state) =>
        Effect.sync(() => process.stderr.write("\n")).pipe(
          Effect.flatMap(() => formatter.onEnd(state))
        )
    })
  })

const BATCH_SIZE = 50

export const diagnostics = Command.make(
  "diagnostics",
  {
    file: Flag.file("file").pipe(
      Flag.optional,
      Flag.withDescription("The full path of the file to check for diagnostics.")
    ),
    project: Flag.file("project").pipe(
      Flag.optional,
      Flag.withDescription("The full path of the project tsconfig.json file to check for diagnostics.")
    ),

    format: Flag.choice("format", ["json", "pretty", "text", "github-actions"] as ReadonlyArray<OutputFormat>)
      .pipe(
        Flag.withDefault("pretty" as const),
        Flag.withDescription(
          "Output format: json (machine-readable), pretty (colored with context), text (plain text), github-actions (workflow commands)"
        )
      ),
    strict: Flag.boolean("strict").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Treat warnings as errors (affects exit code)")
    ),
    severity: Flag.string("severity").pipe(
      Flag.optional,
      Flag.withDescription("Filter by severity levels (comma-separated: error,warning,message)")
    ),
    progress: Flag.boolean("progress").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Show progress as files are checked (outputs to stderr)")
    )
  },
  Effect.fn("diagnostics")(function*({ file, format, progress, project, severity, strict }) {
    const path = yield* Path.Path
    const severityFilter = parseSeverityFilter(severity)
    const state: DiagnosticReporterState = {
      tsInstance: yield* TypeScriptContext,
      checkedCount: 0,
      errorsCount: 0,
      warningsCount: 0,
      messagesCount: 0,
      languageService: undefined,
      totalFilesCount: 0,
      currentFileIndex: 0
    }

    const filesToCheck = Option.isSome(project)
      ? yield* getFileNamesInTsConfig(project.value)
      : new Set<string>()

    if (Option.isSome(file)) {
      filesToCheck.add(path.resolve(file.value))
    }

    if (filesToCheck.size === 0) {
      return yield* new NoFilesToCheckError()
    }

    state.totalFilesCount = filesToCheck.size

    let reporter: DiagnosticReporter | undefined
    switch (format) {
      case "pretty":
        reporter = yield* diagnosticPrettyFormatter
        break
      case "text":
        reporter = yield* diagnosticTextFormatter
        break
      case "json":
        reporter = yield* diagnosticJsonFormatter
        break
      case "github-actions":
        reporter = yield* diagnosticGitHubActionsFormatter
        break
      default:
        reporter = yield* diagnosticPrettyFormatter
    }
    if (progress) {
      reporter = yield* withDiagnosticsProgressFormatter(reporter)
    }

    yield* reporter.onBegin(state)

    const disposeIfLanguageServiceChanged = (languageService: ts.LanguageService | undefined) => {
      if (state.languageService !== languageService) {
        state.languageService?.dispose()
        state.languageService = languageService
      }
    }

    for (const batch of Array.chunksOf(filesToCheck, BATCH_SIZE)) {
      const { service } = createProjectService({ options: { loadTypeScriptPlugins: false } })

      for (const filePath of batch) {
        state.currentFileIndex++
        yield* reporter.onFile(state, filePath)

        service.openClientFile(filePath)
        try {
          const scriptInfo = service.getScriptInfo(filePath)
          if (!scriptInfo) continue

          const projectInfo = scriptInfo.getDefaultProject()
          const languageService = projectInfo.getLanguageService(true)
          disposeIfLanguageServiceChanged(languageService)
          const program = languageService.getProgram()
          if (!program) continue
          const sourceFile = program.getSourceFile(filePath)
          if (!sourceFile) continue
          const pluginConfig = extractEffectLspOptions(program.getCompilerOptions())
          if (!pluginConfig) continue

          const rawResults = pipe(
            LSP.getSemanticDiagnosticsWithCodeFixes(diagnosticsDefinitions, sourceFile),
            TypeParser.nanoLayer,
            TypeCheckerUtils.nanoLayer,
            TypeScriptUtils.nanoLayer,
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
            Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
            Nano.provideService(TypeScriptApi.TypeScriptApi, state.tsInstance),
            Nano.provideService(
              LanguageServicePluginOptions.LanguageServicePluginOptions,
              { ...LanguageServicePluginOptions.parse(pluginConfig), diagnosticsName: false }
            ),
            Nano.run,
            Result.map((_) => _.diagnostics),
            Result.map(
              Array.map((_) =>
                _.category === state.tsInstance.DiagnosticCategory.Suggestion
                  ? { ..._, category: state.tsInstance.DiagnosticCategory.Message }
                  : _
              )
            ),
            Result.getOrElse(() => [])
          )

          // Apply severity filter if specified
          const results = severityFilter
            ? rawResults.filter((d) => severityFilter.has(categoryToSeverity(d.category, state.tsInstance)))
            : rawResults

          state.checkedCount++
          state.errorsCount += results.filter((_) => _.category === state.tsInstance.DiagnosticCategory.Error).length
          state.warningsCount += results.filter((_) =>
            _.category === state.tsInstance.DiagnosticCategory.Warning
          ).length
          state.messagesCount += results.filter((_) =>
            _.category === state.tsInstance.DiagnosticCategory.Message
          ).length

          yield* reporter.onDiagnostics(state, filePath, results)
        } finally {
          service.closeClientFile(filePath)
        }
      }
      yield* Effect.yieldNow
    }
    disposeIfLanguageServiceChanged(undefined)

    yield* reporter.onEnd(state)

    // Determine if we should fail based on errors (and warnings if --strict)
    const hasFailures = state.errorsCount > 0 || (strict && state.warningsCount > 0)
    if (hasFailures) return yield* Effect.sync(() => process.exit(1))
  })
).pipe(
  Command.withDescription("Gets the effect-language-service diagnostics on the given files or project.")
)
