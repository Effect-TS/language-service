/**
 * CLI command for type-checking files with gen-block syntax
 *
 * This command provides TypeScript type-checking support for files
 * that use the `gen {}` syntax, transforming them before type-checking
 * and mapping errors back to original positions.
 */

import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Path from "@effect/platform/Path"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { checkFile, checkProject, type GenBlockDiagnostic } from "../gen-block"
import { getTypeScript } from "./utils"

export class CheckError extends Data.TaggedError("CheckError")<{
  errorsCount: number
  warningsCount: number
}> {
  get message(): string {
    return `Type check failed: ${this.errorsCount} errors, ${this.warningsCount} warnings`
  }
}

const file = Options.file("file").pipe(
  Options.optional,
  Options.withDescription("A specific file to check (must contain gen {} syntax)")
)

const project = Options.file("project").pipe(
  Options.optional,
  Options.withDescription("Path to tsconfig.json")
)

const format = Options.choice("format", ["json", "pretty", "text"]).pipe(
  Options.withDefault("pretty" as const),
  Options.withDescription("Output format: json (machine-readable), pretty (colored), text (plain)")
)

const strict = Options.boolean("strict").pipe(
  Options.withDefault(false),
  Options.withDescription("Treat warnings as errors")
)

type OutputFormat = "json" | "pretty" | "text"

interface CheckSummary {
  filesChecked: number
  genBlockFiles: number
  errors: number
  warnings: number
  messages: number
}

const formatDiagnosticPretty = (d: GenBlockDiagnostic): string => {
  const colorCode = d.category === "error" ? "\x1b[31m" : d.category === "warning" ? "\x1b[33m" : "\x1b[36m"
  const reset = "\x1b[0m"
  const genMarker = d.isGenBlockFile ? " [gen-block]" : ""

  return `${d.file}:${d.line}:${d.column} - ${colorCode}${d.category}${reset} TS${d.code}${genMarker}: ${d.message}`
}

const formatDiagnosticText = (d: GenBlockDiagnostic): string => {
  const genMarker = d.isGenBlockFile ? " [gen-block]" : ""
  return `${d.file}:${d.line}:${d.column} - ${d.category} TS${d.code}${genMarker}: ${d.message}`
}

const outputDiagnostics = (
  diagnostics: Array<GenBlockDiagnostic>,
  summary: CheckSummary,
  outputFormat: OutputFormat
): void => {
  if (outputFormat === "json") {
    const output = {
      summary,
      diagnostics: diagnostics.map((d) => ({
        file: d.file,
        line: d.line,
        column: d.column,
        endLine: d.endLine,
        endColumn: d.endColumn,
        severity: d.category,
        code: d.code,
        message: d.message,
        isGenBlockFile: d.isGenBlockFile
      }))
    }
    console.log(JSON.stringify(output, null, 2))
  } else if (outputFormat === "pretty") {
    for (const d of diagnostics) {
      console.log(formatDiagnosticPretty(d))
    }
    console.log("")
    console.log(
      `Checked ${summary.filesChecked} files (${summary.genBlockFiles} with gen-blocks). ` +
        `${summary.errors} errors, ${summary.warnings} warnings.`
    )
  } else {
    for (const d of diagnostics) {
      console.log(formatDiagnosticText(d))
    }
    console.log("")
    console.log(
      `Checked ${summary.filesChecked} files (${summary.genBlockFiles} with gen-blocks). ` +
        `${summary.errors} errors, ${summary.warnings} warnings.`
    )
  }
}

export const check = Command.make(
  "check",
  { file, format, project, strict },
  Effect.fn("check")(function*({ file, format, project, strict }) {
    const pathService = yield* Path.Path
    const tsInstance = yield* getTypeScript

    let result

    if (Option.isSome(file)) {
      // Check a single file
      const filePath = pathService.resolve(file.value)
      result = checkFile(tsInstance, filePath)
    } else if (Option.isSome(project)) {
      // Check a project
      const configPath = pathService.resolve(project.value)
      result = checkProject({
        typescript: tsInstance,
        configPath
      })
    } else {
      // Default: look for tsconfig.json in current directory
      const configPath = pathService.resolve("tsconfig.json")
      result = checkProject({
        typescript: tsInstance,
        configPath
      })
    }

    // Count diagnostics by category
    const summary: CheckSummary = {
      filesChecked: result.filesChecked,
      genBlockFiles: result.genBlockFilesCount,
      errors: result.diagnostics.filter((d) => d.category === "error").length,
      warnings: result.diagnostics.filter((d) => d.category === "warning").length,
      messages: result.diagnostics.filter((d) => d.category === "message").length
    }

    // Output results
    outputDiagnostics(result.diagnostics, summary, format)

    // Determine exit status
    const hasFailures = summary.errors > 0 || (strict && summary.warnings > 0)
    if (hasFailures) {
      return yield* new CheckError({
        errorsCount: summary.errors,
        warningsCount: summary.warnings
      })
    }
  })
)
