import * as LSP from "@effect/language-service/core/LSP"
import * as Nano from "@effect/language-service/core/Nano"
import * as TypeCheckerApi from "@effect/language-service/core/TypeCheckerApi"
import * as TypeScriptApi from "@effect/language-service/core/TypeScriptApi"
import { refactors } from "@effect/language-service/refactors"
import { Either } from "effect"
import { pipe } from "effect/Function"
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import { applyEdits, createServicesWithMockedVFS } from "./utils/mocks.js"

const getExamplesRefactorsDir = () => path.join(__dirname, "..", "examples", "refactors")

function testRefactorOnExample(
  refactor: LSP.RefactorDefinition,
  fileName: string,
  sourceText: string,
  textRangeString: string
) {
  const { languageService, languageServiceHost, program, sourceFile } = createServicesWithMockedVFS(
    fileName,
    sourceText
  )

  // gets the position to test
  let startPos = 0
  let endPos = 0
  let i = 0
  for (const lineAndCol of textRangeString.split("-")) {
    const [line, character] = lineAndCol.split(":")
    const pos = ts.getPositionOfLineAndCharacter(sourceFile, +line! - 1, +character! - 1)
    if (i === 0) startPos = pos
    if (i === 1) endPos = pos
    i += 1
  }
  if (endPos < startPos) endPos = startPos
  const textRange = { pos: startPos, end: endPos }

  // ensure there are no errors in TS file
  const diagnostics = languageService.getCompilerOptionsDiagnostics()
    .concat(languageService.getSyntacticDiagnostics(fileName))
    .concat(languageService.getSemanticDiagnostics(fileName)).map((diagnostic) => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
      if (diagnostic.file) {
        const { character, line } = diagnostic.file.getLineAndCharacterOfPosition(
          diagnostic.start!
        )
        return `  Error ${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
      } else {
        return `  Error: ${message}`
      }
    })
  expect(diagnostics).toEqual([])

  // check and assert the refactor is executable
  const canApply = pipe(
    LSP.getApplicableRefactors([refactor], sourceFile, textRange),
    Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
    Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
    Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
    Nano.provideService(
      TypeCheckerApi.TypeCheckerApiCache,
      TypeCheckerApi.makeTypeCheckerApiCache()
    ),
    Nano.provideService(LSP.PluginOptions, {
      diagnostics: false,
      quickinfo: false,
      completions: false,
      multipleEffectCheck: false
    }),
    Nano.unsafeRun
  )

  if (Either.isLeft(canApply)) {
    expect(sourceText).toMatchSnapshot()
    return
  }

  // then get the actual edits to run it
  const applicableRefactor = pipe(
    LSP.getEditsForRefactor([refactor], sourceFile, textRange, refactor.name),
    Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
    Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
    Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
    Nano.provideService(
      TypeCheckerApi.TypeCheckerApiCache,
      TypeCheckerApi.makeTypeCheckerApiCache()
    ),
    Nano.provideService(LSP.PluginOptions, {
      diagnostics: false,
      quickinfo: false,
      completions: false,
      multipleEffectCheck: false
    }),
    Nano.unsafeRun
  )

  if (Either.isLeft(applicableRefactor)) {
    expect(sourceText).toMatchSnapshot()
    return
  }

  // run the refactor and ensure it matches the snapshot
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
        applicableRefactor.right.apply,
        Nano.provideService(TypeScriptApi.ChangeTracker, changeTracker),
        Nano.unsafeRun
      )
  )

  expect(applyEdits(edits, fileName, sourceText)).toMatchSnapshot()
}

function testAllRefactors() {
  // read all filenames
  const allExampleFiles = fs.readdirSync(getExamplesRefactorsDir())
  // for each diagnostic definition
  for (const refactor of refactors) {
    const refactorName = refactor.name.substring("effect/".length)
    // all files that start with the diagnostic name and end with .ts
    const exampleFiles = allExampleFiles.filter((fileName) =>
      fileName === refactorName + ".ts" ||
      fileName.startsWith(refactorName + "_") && fileName.endsWith(".ts")
    )
    describe("Refactor " + refactorName, () => {
      // for each example file
      for (const fileName of exampleFiles) {
        // first we extract from the first comment line all the positions where the refactor has to be tested
        const sourceWithMarker = fs.readFileSync(path.join(getExamplesRefactorsDir(), fileName))
          .toString("utf8")
        const firstLine = (sourceWithMarker.split("\n")[0] || "").trim()
        for (const [textRangeString] of firstLine.matchAll(/([0-9]+:[0-9]+(-[0-9]+:[0-9]+)*)/gm)) {
          it(fileName + " at " + textRangeString, () => {
            // create the language service
            const sourceText = "// Result of running refactor " + refactor.name +
              " at position " + textRangeString + sourceWithMarker.substring(firstLine.length)
            testRefactorOnExample(refactor, fileName, sourceText, textRangeString)
          })
        }
      }
    })
  }
}

testAllRefactors()
