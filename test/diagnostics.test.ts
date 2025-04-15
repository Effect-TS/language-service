import type { DiagnosticDefinition } from "@effect/language-service/definition"
import { diagnostics } from "@effect/language-service/diagnostics"
import * as Option from "effect/Option"
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import { applyEdits, createMockLanguageServiceHost } from "./utils/MockLanguageServiceHost.js"

const getExamplesDiagnosticsDir = () => path.join(__dirname, "..", "examples", "diagnostics")

function testDiagnosticOnExample(diagnostic: DiagnosticDefinition, fileName: string) {
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
    const canApply = diagnostic.apply(ts, program, { diagnostics: true, quickinfo: false })(
      sourceFile
    )

    if (canApply.length === 0) {
      expect("// no diagnostics").toMatchSnapshot()
      return
    }

    // sort by start position
    canApply.sort((a, b) => a.node.getStart(sourceFile) - b.node.getStart(sourceFile))

    // create human readable messages
    const humanMessages = canApply.map((error) => {
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

    // check fixes
    canApply.map((error) => {
      const position = ts.getLineAndCharacterOfPosition(sourceFile, error.node.getStart(sourceFile))
      let fixedCode = "// no-fixes"
      const fix = error.fix
      if (Option.isSome(fix)) {
        const formatContext = ts.formatting.getFormatContext(
          ts.getDefaultFormatCodeSettings("\n"),
          { getNewLine: () => "\n" }
        )
        const edits = ts.textChanges.ChangeTracker.with(
          {
            formatContext,
            host: languageServiceHost,
            preferences: {}
          },
          (changeTracker) => fix.value.apply(changeTracker)
        )
        fixedCode = applyEdits(edits, fileName, sourceText)
      }
      expect(fixedCode).toMatchSnapshot("codefixed at " + position.line + ":" + position.character)
    })
  })
}

function testFiles(diagnostic: DiagnosticDefinition, fileNames: Array<string>) {
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
