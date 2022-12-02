import * as T from "@effect/io/Effect"
import * as AST from "@effect/language-service/ast"
import type { DiagnosticDefinition } from "@effect/language-service/diagnostics/definition"
import diagnostics from "@effect/language-service/diagnostics/index"
import { createMockLanguageServiceHost } from "@effect/language-service/test/utils"
import * as Ch from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"
import * as fs from "fs"
import * as path from "path"
import ts from "typescript/lib/tsserverlibrary"

export function testDiagnosticOnExample(diagnostic: DiagnosticDefinition, fileName: string) {
  const sourceText = fs.readFileSync(path.join(__dirname, "..", "examples", "diagnostics", fileName))
    .toString("utf8")

  // create the language service
  const languageServiceHost = createMockLanguageServiceHost(fileName, sourceText)
  const languageService = ts.createLanguageService(languageServiceHost, undefined, ts.LanguageServiceMode.Semantic)
  const program = languageService.getProgram()
  if (!program) throw new Error("No typescript program!")
  const sourceFile = program.getSourceFile(fileName)
  if (!sourceFile) throw new Error("No source file " + fileName + " in VFS")

  // ensure there are no errors in TS file
  const diagnostics = languageService.getCompilerOptionsDiagnostics()
    .concat(languageService.getSyntacticDiagnostics(fileName))
    .concat(languageService.getSemanticDiagnostics(fileName)).map((diagnostic) => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
      if (diagnostic.file) {
        const { character, line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!)
        return `  Error ${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
      } else {
        return `  Error: ${message}`
      }
    })
  expect(diagnostics).toEqual([])

  // check and assert the diagnostic runs
  const resultMessages = pipe(
    diagnostic
      .apply(sourceFile),
    T.provideService(AST.TypeScriptApi)(ts),
    T.provideService(AST.TypeScriptProgram)(program),
    T.unsafeRunSync
  )

  // create human readable messages
  const humanMessages = pipe(
    resultMessages,
    Ch.map((error) => {
      const start = ts.getLineAndCharacterOfPosition(sourceFile, error.node.pos)
      const end = ts.getLineAndCharacterOfPosition(sourceFile, error.node.end)
      const errorSourceCode = sourceText.substring(error.node.pos, error.node.end)

      return errorSourceCode + "\n" +
        `${start.line + 1}:${start.character} - ${end.line + 1}:${end.character} | ${error.messageText}`
    }),
    Ch.join("\n\n")
  )
  expect(humanMessages).toMatchSnapshot()
}

function testFiles(name: string, refactor: DiagnosticDefinition, fileNames: Array<string>) {
  for (const fileName of fileNames) {
    describe(fileName, () => {
      it(fileName, () => {
        testDiagnosticOnExample(refactor, fileName)
      })
    })
  }
}

Object.keys(diagnostics).map((diagnosticName) =>
  testFiles(diagnosticName, diagnostics[diagnosticName]!, [diagnosticName + ".ts"])
)
