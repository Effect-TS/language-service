import * as LSP from "@effect/language-service/core/LSP"
import * as Nano from "@effect/language-service/core/Nano"
import * as TypeCheckerApi from "@effect/language-service/core/TypeCheckerApi"
import * as TypeScriptApi from "@effect/language-service/core/TypeScriptApi"
import { diagnostics } from "@effect/language-service/diagnostics"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import { applyEdits, createServicesWithMockedVFS } from "./utils/mocks.js"

const getExamplesDiagnosticsDir = () => path.join(__dirname, "..", "examples", "diagnostics")

function diagnosticToLogFormat(
  sourceFile: ts.SourceFile,
  sourceText: string,
  error: ts.Diagnostic
): string {
  const startPos = error.start || 0
  const start = ts.getLineAndCharacterOfPosition(sourceFile, startPos)
  const endPos = startPos + (error.length || 0)
  const end = ts.getLineAndCharacterOfPosition(
    sourceFile,
    endPos
  )
  const errorSourceCode = sourceText.substring(
    startPos,
    endPos
  )

  return errorSourceCode + "\n" +
    `${start.line + 1}:${start.character} - ${
      end.line + 1
    }:${end.character} | ${error.category} | ${error.messageText}`
}

function testDiagnosticOnExample(
  diagnostic: LSP.DiagnosticDefinition,
  fileName: string,
  sourceText: string
) {
  // create the language service with mocked services over a VFS
  const { program, sourceFile } = createServicesWithMockedVFS(fileName, sourceText)

  // create snapshot path
  const snapshotFilePath = path.join(
    __dirname,
    "__snapshots__",
    "diagnostics",
    fileName + ".output"
  )

  // attempt to run the diagnostic and get the output
  pipe(
    LSP.getSemanticDiagnosticsWithCodeFixes([diagnostic], sourceFile),
    Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
    Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
    Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
    Nano.provideService(
      TypeCheckerApi.TypeCheckerApiCache,
      TypeCheckerApi.makeTypeCheckerApiCache()
    ),
    Nano.provideService(LSP.PluginOptions, {
      diagnostics: true,
      quickinfo: false,
      completions: false,
      multipleEffectCheck: true
    }),
    Nano.map(({ diagnostics }) => {
      // sort by start position
      diagnostics.sort((a, b) => (a.start || 0) - (b.start || 0))
      // create human readable messages
      return diagnostics.length === 0 ?
        "// no diagnostics" :
        diagnostics.map((error) => diagnosticToLogFormat(sourceFile, sourceText, error))
          .join("\n\n")
    }),
    Nano.unsafeRun,
    (result) => {
      expect(Either.isRight(result), "should run with no error " + result).toEqual(true)
      expect(Either.getOrElse(result, () => "// no codefixes available")).toMatchFileSnapshot(
        snapshotFilePath
      )
    }
  )
}

function testDiagnosticQuickfixesOnExample(
  diagnostic: LSP.DiagnosticDefinition,
  fileName: string,
  sourceText: string
) {
  // create the language service with mocked services over a VFS
  const { languageServiceHost, program, sourceFile } = createServicesWithMockedVFS(
    fileName,
    sourceText
  )

  // create snapshot path
  const snapshotFilePathList = path.join(
    __dirname,
    "__snapshots__",
    "diagnostics",
    fileName + ".codefixes"
  )

  // attempt to run the diagnostic and get the output
  pipe(
    LSP.getSemanticDiagnosticsWithCodeFixes([diagnostic], sourceFile),
    Nano.flatMap(({ codeFixes, diagnostics }) =>
      Nano.sync(() => {
        // sort by start position
        diagnostics.sort((a, b) => (a.start || 0) - (b.start || 0))

        // loop through
        for (
          const codeFix of codeFixes
        ) {
          // create snapshot path
          const snapshotFilePath = path.join(
            __dirname,
            "__snapshots__",
            "diagnostics",
            fileName + "." + codeFix.fixName + ".from" + codeFix.start + "to" + codeFix.end +
              ".output"
          )
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
            (changeTracker) =>
              pipe(
                codeFix.apply,
                Nano.provideService(TypeScriptApi.ChangeTracker, changeTracker),
                Nano.unsafeRun,
                (result) => expect(Either.isRight(result), "should run with no error").toEqual(true)
              )
          )
          expect(
            "// code fix " + codeFix.fixName + "  output for range " + codeFix.start + " - " +
              codeFix.end + "\n" + applyEdits(edits, fileName, sourceText)
          ).toMatchFileSnapshot(snapshotFilePath)
        }

        return codeFixes.length === 0
          ? "no codefixes"
          : codeFixes.map((_) => _.fixName + " from " + _.start + " to " + _.end).join("\n")
      })
    ),
    Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
    Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
    Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
    Nano.provideService(
      TypeCheckerApi.TypeCheckerApiCache,
      TypeCheckerApi.makeTypeCheckerApiCache()
    ),
    Nano.provideService(LSP.PluginOptions, {
      diagnostics: true,
      quickinfo: false,
      completions: false,
      multipleEffectCheck: true
    }),
    Nano.unsafeRun,
    (result) => {
      expect(Either.isRight(result), "should run with no error " + result).toEqual(true)
      expect(Either.getOrElse(result, () => "// no codefixes available")).toMatchFileSnapshot(
        snapshotFilePathList
      )
    }
  )
}

function testAllDagnostics() {
  // read all filenames
  const allExampleFiles = fs.readdirSync(getExamplesDiagnosticsDir())
  // for each diagnostic definition
  for (const diagnostic of diagnostics) {
    // all files that start with the diagnostic name and end with .ts
    const exampleFiles = allExampleFiles.filter((fileName) =>
      fileName === diagnostic.name + ".ts" ||
      fileName.startsWith(diagnostic.name + "_") && fileName.endsWith(".ts")
    )
    describe("Diagnostic " + diagnostic.name, () => {
      // for each example file
      for (const fileName of exampleFiles) {
        const sourceText = fs.readFileSync(path.join(getExamplesDiagnosticsDir(), fileName))
          .toString("utf8")
        it(
          fileName,
          () => testDiagnosticOnExample(diagnostic, fileName, sourceText)
        )
      }
    })
    describe("Diagnostic quickfixes " + diagnostic.name, () => {
      // for each example file
      for (const fileName of exampleFiles) {
        const sourceText = fs.readFileSync(path.join(getExamplesDiagnosticsDir(), fileName))
          .toString("utf8")

        it(
          fileName,
          () => testDiagnosticQuickfixesOnExample(diagnostic, fileName, sourceText)
        )
      }
    })
  }
}

testAllDagnostics()
