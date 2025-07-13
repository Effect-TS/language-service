import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Terminal from "@effect/platform/Terminal"
import * as Ansi from "@effect/printer-ansi/Ansi"
import * as Doc from "@effect/printer-ansi/AnsiDoc"
import * as Array from "effect/Array"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import * as Predicate from "effect/Predicate"
import * as Runtime from "effect/Runtime"
import * as ts from "typescript"
import * as LanguageServicePluginOptions from "./core/LanguageServicePluginOptions"
import * as LSP from "./core/LSP"
import * as Nano from "./core/Nano"
import * as TypeCheckerApi from "./core/TypeCheckerApi"
import * as TypeParser from "./core/TypeParser"
import * as TypeScriptApi from "./core/TypeScriptApi"
import { diagnostics } from "./diagnostics"

const makePathWithLineCharacter = (
  cwd: string,
  sourceFile: ts.SourceFile,
  diagnostic: ts.Diagnostic
) => {
  if (!diagnostic.file) return ""
  const relativePath = sourceFile.fileName.startsWith(cwd)
    ? "." + sourceFile.fileName.slice(cwd.length)
    : sourceFile.fileName
  if (!diagnostic.start) return relativePath
  const { character, line } = ts.getLineAndCharacterOfPosition(sourceFile, diagnostic.start)
  return `${relativePath}:${line + 1}:${character + 1}`
}

const splitLinesMaxLength = (lines: Array<string>, maxLength: number) => {
  const current = lines.slice(0)
  const out: Array<string> = []
  while (current.length > 0) {
    const line = current.shift()!
    if (line.length <= maxLength) {
      out.push(line)
    } else {
      const lastSpaceIndex = line.slice(0, maxLength).lastIndexOf(" ")
      const splitIndex = lastSpaceIndex === -1 ? maxLength : lastSpaceIndex + 1
      out.push(line.slice(0, splitIndex))
      current.unshift(line.slice(splitIndex))
    }
  }
  return out
}

const printCodeSnippet = (sourceFile: ts.SourceFile, showStartPosition: number, showEndPosition: number) =>
  Effect.gen(function*() {
    const { line: startLine } = ts.getLineAndCharacterOfPosition(sourceFile, showStartPosition)
    const { line: endLine } = ts.getLineAndCharacterOfPosition(sourceFile, showEndPosition)
    const lineStarts = sourceFile.getLineStarts()
    const startPosition = lineStarts[startLine]
    const endPosition = (lineStarts[endLine + 1] || sourceFile.text.length) - 1
    const sourceText = sourceFile.text.slice(startPosition, endPosition)
    const lines = sourceText.split("\n")
    const lineNumberMaxLength = (endLine + 1).toFixed(0).length
    const out: Array<Doc.Doc<Ansi.Ansi>> = []
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineNumber = (startLine + 1 + lineIdx).toFixed(0)
      const lineCounterText = " ".repeat(lineNumberMaxLength - lineNumber.length) + lineNumber + "  "
      out.push(
        Doc.hcat([
          Doc.string(lineCounterText),
          Doc.space,
          Doc.string(lines[lineIdx])
        ]).pipe(Doc.annotate(Ansi.blackBright))
      )
    }
    return Doc.vcat(out)
  })

const applyColorBasedOnCategory = (severity: ts.DiagnosticCategory) => (doc: Doc.Doc<Ansi.Ansi>) => {
  switch (severity) {
    case ts.DiagnosticCategory.Error:
      return Doc.annotate(doc, Ansi.redBright)
    case ts.DiagnosticCategory.Warning:
      return Doc.annotate(doc, Ansi.yellow)
    case ts.DiagnosticCategory.Suggestion:
      return doc
    case ts.DiagnosticCategory.Message:
      return Doc.annotate(doc, Ansi.blueBright)
  }
}

const formatDiagnostic = (cwd: string, sourceFile: ts.SourceFile, diagnostic: ts.Diagnostic) =>
  Effect.gen(function*() {
    const terminal = yield* Terminal.Terminal
    const terminalColumns = yield* terminal.columns
    const pathWithLineCharacter = makePathWithLineCharacter(cwd, sourceFile, diagnostic)

    const ruleName = Object.values(diagnostics).find((_) => _.code === diagnostic.code)?.name || "unknown"
    const messageText = typeof diagnostic.messageText === "string"
      ? diagnostic.messageText
      : diagnostic.messageText.messageText

    const ruleMessages = Doc.vcat(splitLinesMaxLength(messageText.split("\n"), terminalColumns - 4).map(Doc.text)).pipe(
      applyColorBasedOnCategory(diagnostic.category)
    )

    const titleWidth = pathWithLineCharacter.length + ruleName.length + 2

    const title = Doc.hcat([
      Doc.string(pathWithLineCharacter).pipe(Doc.annotate(Ansi.underlined)),
      Doc.space,
      Doc.text(ruleName).pipe(
        Doc.annotate(Ansi.underlined),
        Doc.annotate(Ansi.italicized)
      ),
      Doc.space,
      Doc.string("━".repeat(terminalColumns - titleWidth))
    ])

    const codeSnippet = yield* printCodeSnippet(
      sourceFile,
      diagnostic.start || 0,
      (diagnostic.start || 0) + (diagnostic.length || 0)
    )

    const doc = Doc.vsep([
      title,
      Doc.vsep([
        Doc.empty,
        ruleMessages,
        Doc.empty,
        codeSnippet,
        Doc.empty
      ]).pipe(Doc.indent(2))
    ])

    console.log(Doc.render(doc, { style: "pretty", options: { lineWidth: terminalColumns } }))
  })

interface JsonDiagnostic {
  file: string
  line: number
  column: number
  severity: "error" | "warning" | "suggestion" | "message"
  code: number
  rule: string
  message: string
}

const formatDiagnosticAsJson = (cwd: string, sourceFile: ts.SourceFile, diagnostic: ts.Diagnostic): JsonDiagnostic => {
  const ruleName = Object.values(diagnostics).find((_) => _.code === diagnostic.code)?.name || "unknown"
  const messageText = typeof diagnostic.messageText === "string"
    ? diagnostic.messageText
    : diagnostic.messageText.messageText

  const relativePath = sourceFile.fileName.startsWith(cwd)
    ? "." + sourceFile.fileName.slice(cwd.length)
    : sourceFile.fileName

  const { character, line } = diagnostic.start
    ? ts.getLineAndCharacterOfPosition(sourceFile, diagnostic.start)
    : { character: 0, line: 0 }

  const severityMap: Record<ts.DiagnosticCategory, JsonDiagnostic["severity"]> = {
    [ts.DiagnosticCategory.Error]: "error",
    [ts.DiagnosticCategory.Warning]: "warning",
    [ts.DiagnosticCategory.Suggestion]: "suggestion",
    [ts.DiagnosticCategory.Message]: "message"
  }

  return {
    file: relativePath,
    line: line + 1,
    column: character + 1,
    severity: severityMap[diagnostic.category],
    code: diagnostic.code,
    rule: ruleName,
    message: messageText
  }
}

const checkEffect = (format: "default" | "json") =>
  Effect.gen(function*() {
    // create a solution builder host
    const host = ts.createSolutionBuilderHost(
      ts.sys,
      ts.createSemanticDiagnosticsBuilderProgram
    )
    const cwd = host.getCurrentDirectory()

    // track the emitted diagnostics
    const runtime = yield* Effect.runtime<Terminal.Terminal>()
    host.afterProgramEmitAndDiagnostics = (_) => {
      const program = _.getProgram()
      const compilerOptions = program.getCompilerOptions()
      const pluginOptions =
        Predicate.hasProperty(compilerOptions, "plugins") && Array.isArray(compilerOptions.plugins) &&
          compilerOptions.plugins.find((_) =>
            Predicate.hasProperty(_, "name") && _.name === "@effect/language-service"
          ) || {}

      // loop through all source files in the program
      const rootNames = program.getRootFileNames()
      const sourceFiles = program.getSourceFiles().filter((_) => rootNames.indexOf(_.fileName) !== -1)
      for (const sourceFile of sourceFiles) {
        // run the diagnostics and pipe them into addDiagnostic
        const outputDiagnostics = pipe(
          LSP.getSemanticDiagnosticsWithCodeFixes(diagnostics, sourceFile),
          Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
          Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
          Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
          Nano.provideService(TypeParser.TypeParser, TypeParser.make(ts, program.getTypeChecker())),
          Nano.provideService(
            TypeCheckerApi.TypeCheckerApiCache,
            TypeCheckerApi.makeTypeCheckerApiCache()
          ),
          Nano.provideService(
            LanguageServicePluginOptions.LanguageServicePluginOptions,
            LanguageServicePluginOptions.parse(pluginOptions)
          ),
          Nano.run,
          Either.map((_) => _.diagnostics),
          Either.getOrElse(() => [])
        )

        if (format === "json") {
          for (const diagnostic of outputDiagnostics) {
            allDiagnostics.push(formatDiagnosticAsJson(cwd, sourceFile, diagnostic))
          }
        } else {
          Runtime.runSync(
            runtime,
            Effect.forEach(outputDiagnostics, (diagnostic) => formatDiagnostic(cwd, sourceFile, diagnostic))
          )
        }
      }
    }

    const allDiagnostics: Array<JsonDiagnostic> = []

    // create a solution builder
    const solution = ts.createSolutionBuilder(host, ["./tsconfig.json"], {
      force: true,
      emitDeclarationOnly: true
    })

    let project = solution.getNextInvalidatedProject()
    while (project) {
      project.done(
        undefined,
        (fileName, text, bom) => {
          if (fileName.endsWith(".d.ts") || fileName.endsWith(".map")) return
          return ts.sys.writeFile(fileName, text, bom)
        }
      )
      project = solution.getNextInvalidatedProject()
    }
  })

const formatOption = Options.choice("format", ["default", "json"]).pipe(
  Options.withDefault("default" as const),
  Options.withDescription("Output format for diagnostics (default or json)")
)

const checkCommand = Command.make("check", { format: formatOption }, ({ format }) => checkEffect(format))

const cliCommand = Command.make(
  "effect-language-service",
  {},
  () => Console.log("Please select a command or run --help.")
).pipe(Command.withSubcommands([checkCommand]))

const main = Command.run(cliCommand, {
  name: "effect-language-service",
  version: "0.0.1"
})

main(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain())
