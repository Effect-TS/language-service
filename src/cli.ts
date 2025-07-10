import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as NodeTerminal from "@effect/platform-node/NodeTerminal"
import * as Terminal from "@effect/platform/Terminal"
import * as Ansi from "@effect/printer-ansi/Ansi"
import * as Doc from "@effect/printer-ansi/AnsiDoc"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
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
      const lineCounterText = " ".repeat(lineNumberMaxLength - lineNumber.length) + lineNumber + " | "
      out.push(Doc.hcat([Doc.string(lineCounterText), Doc.space, Doc.string(lines[lineIdx])]))
    }
    return Doc.vcat(out)
  })

const withColor = (severity: ts.DiagnosticCategory) => (doc: Doc.Doc<Ansi.Ansi>) => {
  switch (severity) {
    case ts.DiagnosticCategory.Error:
      return Doc.annotate(doc, Ansi.redBright)
    case ts.DiagnosticCategory.Warning:
      return Doc.annotate(doc, Ansi.yellowBright)
    case ts.DiagnosticCategory.Suggestion:
      return doc
    case ts.DiagnosticCategory.Message:
      return Doc.annotate(doc, Ansi.blueBright)
  }
}

const printDiagnostic = (cwd: string, sourceFile: ts.SourceFile, diagnostic: ts.Diagnostic) =>
  Effect.gen(function*() {
    const terminal = yield* Terminal.Terminal
    const terminalColumns = yield* terminal.columns
    const pathWithLineCharacter = makePathWithLineCharacter(cwd, sourceFile, diagnostic)

    const ruleName = Object.values(diagnostics).find((_) => _.code === diagnostic.code)?.name || "unknown"
    const messageText = typeof diagnostic.messageText === "string"
      ? diagnostic.messageText
      : diagnostic.messageText.messageText

    const ruleMessages = Doc.vcat(splitLinesMaxLength(messageText.split("\n"), terminalColumns - 4).map(Doc.text)).pipe(
      withColor(diagnostic.category)
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

export const main = Effect.gen(function*() {
  // hack to disable emit
  ;((ts as unknown) as any).commonOptionsWithBuild.push(
    { name: "noEmit" }
  )

  // create a solution builder host
  const host = ts.createSolutionBuilderHost(
    ts.sys,
    ts.createSemanticDiagnosticsBuilderProgram,
    () => {},
    () => {},
    () => {}
  )
  const cwd = host.getCurrentDirectory()

  // create a solution builder
  const solution = ts.createSolutionBuilder(host, ["./tsconfig.json"], {
    force: true,
    noEmit: true
  })

  // loop through all the projects
  let project = solution.getNextInvalidatedProject()
  while (project) {
    // grab the program main files
    const program: ts.Program = (project as any).getProgram()!
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
          LanguageServicePluginOptions.parse({})
        ),
        Nano.run,
        Either.map((_) => _.diagnostics),
        Either.getOrElse(() => [])
      )
      yield* Effect.forEach(outputDiagnostics, (diagnostic) => printDiagnostic(cwd, sourceFile, diagnostic))
    }
    project.done(undefined, () => {})
    project = solution.getNextInvalidatedProject()
  }
})

main.pipe(Effect.provide(NodeTerminal.layer), NodeRuntime.runMain())
