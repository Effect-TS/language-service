import * as LanguageServicePluginOptions from "@effect/language-service/core/LanguageServicePluginOptions"
import * as Nano from "@effect/language-service/core/Nano"
import * as TypeCheckerApi from "@effect/language-service/core/TypeCheckerApi"
import * as TypeCheckerUtils from "@effect/language-service/core/TypeCheckerUtils"
import * as TypeParser from "@effect/language-service/core/TypeParser"
import * as TypeScriptApi from "@effect/language-service/core/TypeScriptApi"
import * as TypeScriptUtils from "@effect/language-service/core/TypeScriptUtils"
import * as keyStrings from "@effect/language-service/renames/keyStrings"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import { applyEdits, createServicesWithMockedVFS } from "./utils/mocks.js"

interface RenameRunner {
  (
    sourceFile: ts.SourceFile,
    position: number,
    _findInStrings: boolean,
    _findInComments: boolean,
    _preferences: ts.UserPreferences,
    renameLocations: ReadonlyArray<ts.RenameLocation> | undefined
  ): Nano.Nano<
    ReadonlyArray<ts.RenameLocation> | undefined,
    never,
    TypeScriptApi.TypeScriptApi | TypeScriptUtils.TypeScriptUtils | TypeParser.TypeParser
  >
}

const renames: Record<string, RenameRunner> = {
  keyStrings: keyStrings.renameKeyStrings
}

const getExamplesRenamesDir = () => path.join(__dirname, "..", "examples", "renames")

function testRenamesOnExample(
  runner: RenameRunner,
  fileName: string,
  sourceText: string,
  textRangeString: string
) {
  const { languageService, program, sourceFile } = createServicesWithMockedVFS(
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
    "renames",
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
    runner(sourceFile, textRange.pos, false, false, {}, undefined),
    TypeParser.nanoLayer,
    TypeCheckerUtils.nanoLayer,
    TypeScriptUtils.nanoLayer,
    Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
    Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
    Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
    Nano.provideService(LanguageServicePluginOptions.LanguageServicePluginOptions, {
      ...LanguageServicePluginOptions.defaults,
      refactors: true,
      diagnostics: false,
      quickinfo: false,
      completions: false,
      goto: false
    }),
    Nano.unsafeRun
  )

  if (!(Either.isRight(canApply))) {
    return expect(sourceText).toMatchFileSnapshot(snapshotFilePath)
  }

  const textChanges = (canApply.right || []).map((_) => ({ span: _.textSpan, newText: "NewText" }))

  return expect(applyEdits([{ fileName, textChanges }], fileName, sourceFile.text)).toMatchFileSnapshot(
    snapshotFilePath
  )
}

function testAllRenames() {
  // read all filenames
  const allExampleFiles = fs.readdirSync(getExamplesRenamesDir())
  // for each diagnostic definition
  for (const [name, runner] of Object.entries(renames)) {
    // all files that start with the diagnostic name and end with .ts
    const exampleFiles = allExampleFiles.filter((fileName) =>
      fileName === name + ".ts" ||
      fileName.startsWith(name + "_") && fileName.endsWith(".ts")
    )
    describe("Rename " + name, () => {
      // for each example file
      for (const fileName of exampleFiles) {
        // first we extract from the first comment line all the positions where the rename has to be tested
        const sourceWithMarker = fs.readFileSync(path.join(getExamplesRenamesDir(), fileName))
          .toString("utf8")
        const firstLine = (sourceWithMarker.split("\n")[0] || "").trim()
        for (const [textRangeString] of firstLine.matchAll(/([0-9]+:[0-9]+(-[0-9]+:[0-9]+)*)/gm)) {
          it(fileName + " at " + textRangeString, () => {
            // create the language service
            const sourceText = "// Result of running rename " + name +
              " at position " + textRangeString + sourceWithMarker.substring(firstLine.length)
            return testRenamesOnExample(runner, fileName, sourceText, textRangeString)
          })
        }
      }
    })
  }
}

testAllRenames()
