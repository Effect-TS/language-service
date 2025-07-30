import * as LanguageServicePluginOptions from "@effect/language-service/core/LanguageServicePluginOptions"
import * as LSP from "@effect/language-service/core/LSP"
import * as Nano from "@effect/language-service/core/Nano"
import * as TypeCheckerApi from "@effect/language-service/core/TypeCheckerApi"
import * as TypeParser from "@effect/language-service/core/TypeParser"
import * as TypeScriptApi from "@effect/language-service/core/TypeScriptApi"
import * as TypeScriptUtils from "@effect/language-service/core/TypeScriptUtils"
import { refactors } from "@effect/language-service/refactors"
import * as Either from "effect/Either"
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
  let humanLineCol = ""
  let i = 0
  for (const lineAndCol of textRangeString.split("-")) {
    const [line, character] = lineAndCol.split(":")
    const pos = ts.getPositionOfLineAndCharacter(sourceFile, +line! - 1, +character! - 1)
    if (i === 1) humanLineCol += "-"
    humanLineCol += "ln" + line + "col" + character
    if (i === 0) startPos = pos
    if (i === 1) endPos = pos
    i += 1
  }
  if (endPos < startPos) endPos = startPos
  const textRange = { pos: startPos, end: endPos }

  // create snapshot path
  const snapshotFilePath = path.join(
    __dirname,
    "__snapshots__",
    "refactors",
    fileName + "." + humanLineCol + ".output"
  )

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
    TypeParser.nanoLayer,
    TypeScriptUtils.nanoLayer,
    Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
    Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
    Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
    Nano.provideService(LanguageServicePluginOptions.LanguageServicePluginOptions, {
      diagnostics: false,
      diagnosticSeverity: {},
      quickinfo: false,
      completions: false,
      goto: false,
      allowedDuplicatedPackages: [],
      namespaceImportPackages: [],
      barrelImportPackages: [],
      topLevelNamedReexports: "ignore"
    }),
    Nano.unsafeRun
  )

  if (!(Either.isRight(canApply) && canApply.right.length > 0)) {
    return expect(sourceText).toMatchFileSnapshot(snapshotFilePath)
  }

  // then get the actual edits to run it
  const applicableRefactor = pipe(
    LSP.getEditsForRefactor([refactor], sourceFile, textRange, canApply.right[0].name),
    TypeParser.nanoLayer,
    TypeScriptUtils.nanoLayer,
    Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
    Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
    Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
    Nano.provideService(LanguageServicePluginOptions.LanguageServicePluginOptions, {
      diagnostics: false,
      diagnosticSeverity: {},
      quickinfo: false,
      completions: false,
      goto: false,
      allowedDuplicatedPackages: [],
      namespaceImportPackages: [],
      barrelImportPackages: [],
      topLevelNamedReexports: "ignore"
    }),
    Nano.unsafeRun
  )

  if (Either.isLeft(applicableRefactor)) {
    return expect(sourceText).toMatchFileSnapshot(snapshotFilePath)
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

  return expect(applyEdits(edits, fileName, sourceText)).toMatchFileSnapshot(snapshotFilePath)
}

function testAllRefactors() {
  // read all filenames
  const allExampleFiles = fs.readdirSync(getExamplesRefactorsDir())
  // for each diagnostic definition
  for (const refactor of refactors) {
    // all files that start with the diagnostic name and end with .ts
    const exampleFiles = allExampleFiles.filter((fileName) =>
      fileName === refactor.name + ".ts" ||
      fileName.startsWith(refactor.name + "_") && fileName.endsWith(".ts")
    )
    describe("Refactor " + refactor.name, () => {
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
            return testRefactorOnExample(refactor, fileName, sourceText, textRangeString)
          })
        }
      }
    })
  }
}

testAllRefactors()
