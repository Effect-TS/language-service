import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Path from "@effect/platform/Path"
import { createProjectService } from "@typescript-eslint/project-service"
import * as Array from "effect/Array"
import * as Data from "effect/Data"
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
import { extractEffectLspOptions, getFileNamesInTsConfig, getTypeScript } from "./utils"

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

export type OutputFormat = "json" | "pretty" | "text"
export type SeverityLevel = "error" | "warning" | "message"

interface DiagnosticOutput {
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
): DiagnosticOutput | undefined => {
  if (!diagnostic.file || diagnostic.start === undefined) return undefined

  const { character, line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
  const endPos = diagnostic.start + (diagnostic.length ?? 0)
  const { character: endCharacter, line: endLine } = diagnostic.file.getLineAndCharacterOfPosition(endPos)

  const diagnosticName = Object.values(diagnosticsDefinitions).find((_) => _.code === diagnostic.code)?.name
    ?? `TS${diagnostic.code}`

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

const file = Options.file("file").pipe(
  Options.optional,
  Options.withDescription("The full path of the file to check for diagnostics.")
)

const project = Options.file("project").pipe(
  Options.optional,
  Options.withDescription("The full path of the project tsconfig.json file to check for diagnostics.")
)

const format = Options.choice("format", ["json", "pretty", "text"]).pipe(
  Options.withDefault("pretty" as const),
  Options.withDescription("Output format: json (machine-readable), pretty (colored with context), text (plain text)")
)

const strict = Options.boolean("strict").pipe(
  Options.withDefault(false),
  Options.withDescription("Treat warnings as errors (affects exit code)")
)

const severity = Options.text("severity").pipe(
  Options.optional,
  Options.withDescription("Filter by severity levels (comma-separated: error,warning,message)")
)

const progress = Options.boolean("progress").pipe(
  Options.withDefault(false),
  Options.withDescription("Show progress as files are checked (outputs to stderr)")
)

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

const BATCH_SIZE = 50

export const diagnostics = Command.make(
  "diagnostics",
  { file, progress, project, format, strict, severity },
  Effect.fn("diagnostics")(function*({ file, format, progress, project, severity, strict }) {
    const path = yield* Path.Path
    const tsInstance = yield* getTypeScript
    const severityFilter = parseSeverityFilter(severity)
    const allJsonDiagnostics: Array<DiagnosticOutput> = []
    const counts = { checked: 0, errors: 0, warnings: 0, messages: 0 }

    const filesToCheck = Option.isSome(project)
      ? yield* getFileNamesInTsConfig(project.value)
      : new Set<string>()

    if (Option.isSome(file)) {
      filesToCheck.add(path.resolve(file.value))
    }

    if (filesToCheck.size === 0) {
      return yield* new NoFilesToCheckError()
    }

    const filesToCheckArray = Array.fromIterable(filesToCheck)
    const batches = Array.chunksOf(filesToCheckArray, BATCH_SIZE)
    const totalFiles = filesToCheck.size
    const fileIndex = { current: 0 }

    if (progress) {
      process.stderr.write(`Starting diagnostics for ${totalFiles} files...\n`)
    }

    const serviceTracker = { last: undefined as ts.LanguageService | undefined }
    const disposeIfLanguageServiceChanged = (languageService: ts.LanguageService | undefined) => {
      if (serviceTracker.last !== languageService) {
        serviceTracker.last?.dispose()
        serviceTracker.last = languageService
      }
    }

    for (const batch of batches) {
      const { service } = createProjectService({ options: { loadTypeScriptPlugins: false } })

      for (const filePath of batch) {
        fileIndex.current++
        if (progress) {
          process.stderr.write(`\r[${fileIndex.current}/${totalFiles}] ${filePath.slice(-60).padStart(60)}`)
        }
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
            Nano.provideService(TypeScriptApi.TypeScriptApi, tsInstance),
            Nano.provideService(
              LanguageServicePluginOptions.LanguageServicePluginOptions,
              { ...LanguageServicePluginOptions.parse(pluginConfig), diagnosticsName: false }
            ),
            Nano.run,
            Either.map((_) => _.diagnostics),
            Either.map(
              Array.map((_) =>
                _.category === tsInstance.DiagnosticCategory.Suggestion
                  ? { ..._, category: tsInstance.DiagnosticCategory.Message }
                  : _
              )
            ),
            Either.getOrElse(() => [])
          )

          // Apply severity filter if specified
          const results = severityFilter
            ? rawResults.filter((d) => severityFilter.has(categoryToSeverity(d.category, tsInstance)))
            : rawResults

          counts.checked++
          counts.errors += results.filter((_) => _.category === tsInstance.DiagnosticCategory.Error).length
          counts.warnings += results.filter((_) => _.category === tsInstance.DiagnosticCategory.Warning).length
          counts.messages += results.filter((_) => _.category === tsInstance.DiagnosticCategory.Message).length

          if (results.length > 0) {
            if (format === "json") {
              // Collect JSON diagnostics for batch output at the end
              for (const diagnostic of results) {
                const jsonDiagnostic = formatDiagnosticForJson(diagnostic, tsInstance)
                if (jsonDiagnostic) {
                  allJsonDiagnostics.push(jsonDiagnostic)
                }
              }
            } else if (format === "pretty") {
              // Colored output with context (original behavior)
              const rawFormatted = tsInstance.formatDiagnosticsWithColorAndContext(results, {
                getCanonicalFileName: (fileName) => path.resolve(fileName),
                getCurrentDirectory: () => path.resolve("."),
                getNewLine: () => "\n"
              })
              const formattedResults = Object.values(diagnosticsDefinitions).reduce(
                (text, def) => text.replace(new RegExp(`TS${def.code}:`, "g"), `effect(${def.name}):`),
                rawFormatted
              )
              console.log(formattedResults)
            } else {
              // Plain text output (no colors)
              const rawFormatted = tsInstance.formatDiagnostics(results, {
                getCanonicalFileName: (fileName) => path.resolve(fileName),
                getCurrentDirectory: () => path.resolve("."),
                getNewLine: () => "\n"
              })
              const formattedResults = Object.values(diagnosticsDefinitions).reduce(
                (text, def) => text.replace(new RegExp(`TS${def.code}:`, "g"), `effect(${def.name}):`),
                rawFormatted
              )
              console.log(formattedResults)
            }
          }
        } finally {
          service.closeClientFile(filePath)
        }
      }
      yield* Effect.yieldNow()
    }
    disposeIfLanguageServiceChanged(undefined)

    if (progress) {
      process.stderr.write("\n")
    }

    // Output JSON format as a single array
    if (format === "json") {
      const output = {
        summary: {
          filesChecked: counts.checked,
          totalFiles: filesToCheck.size,
          errors: counts.errors,
          warnings: counts.warnings,
          messages: counts.messages
        },
        diagnostics: allJsonDiagnostics
      }
      console.log(JSON.stringify(output, null, 2))
    } else {
      console.log(
        `Checked ${counts.checked} files out of ${filesToCheck.size} files. \n${counts.errors} errors, ${counts.warnings} warnings and ${counts.messages} messages.`
      )
    }

    // Determine if we should fail based on errors (and warnings if --strict)
    const hasFailures = counts.errors > 0 || (strict && counts.warnings > 0)
    if (hasFailures) {
      return yield* new DiagnosticsFoundError({
        errorsCount: counts.errors,
        warningsCount: counts.warnings,
        messagesCount: counts.messages
      })
    }
  })
)
