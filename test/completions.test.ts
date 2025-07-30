import { completions } from "@effect/language-service/completions"
import * as LanguageServicePluginOptions from "@effect/language-service/core/LanguageServicePluginOptions"
import * as LSP from "@effect/language-service/core/LSP"
import * as Nano from "@effect/language-service/core/Nano"
import * as TypeCheckerApi from "@effect/language-service/core/TypeCheckerApi"
import * as TypeParser from "@effect/language-service/core/TypeParser"
import * as TypeScriptApi from "@effect/language-service/core/TypeScriptApi"
import * as TypeScriptUtils from "@effect/language-service/core/TypeScriptUtils"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import { createServicesWithMockedVFS } from "./utils/mocks.js"

const getExamplesCompletionsDir = () => path.join(__dirname, "..", "examples", "completions")

function testCompletionOnExample(
  completion: LSP.CompletionDefinition,
  fileName: string,
  sourceText: string,
  textRangeString: string
) {
  const { program, sourceFile } = createServicesWithMockedVFS(
    fileName,
    sourceText
  )

  // gets the position to test
  let startPos = 0
  for (const lineAndCol of textRangeString.split("-")) {
    const [line, character] = lineAndCol.split(":")
    startPos = ts.getPositionOfLineAndCharacter(sourceFile, +line! - 1, +character! - 1)
  }

  // check and assert the completions is executable
  const maybeEntries = pipe(
    LSP.getCompletionsAtPosition(
      [completion],
      sourceFile,
      startPos,
      undefined,
      ts.getDefaultFormatCodeSettings("\n")
    ),
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

  if (Either.isLeft(maybeEntries)) {
    expect(sourceText).toMatchSnapshot()
    return
  }

  expect(maybeEntries.right).toMatchSnapshot()
}

function testAllCompletions() {
  // read all filenames
  const allExampleFiles = fs.readdirSync(getExamplesCompletionsDir())
  // for each definition
  for (const completion of completions) {
    // all files that start with the name and end with .ts
    const exampleFiles = allExampleFiles.filter((fileName) =>
      fileName === completion.name + ".ts" ||
      fileName.startsWith(completion.name + "_") && fileName.endsWith(".ts")
    )
    describe("Completion " + completion.name, () => {
      // for each example file
      for (const fileName of exampleFiles) {
        // first we extract from the first comment line all the positions where the refactor has to be tested
        const sourceWithMarker = fs.readFileSync(path.join(getExamplesCompletionsDir(), fileName))
          .toString("utf8")
        const firstLine = (sourceWithMarker.split("\n")[0] || "").trim()
        for (const [textRangeString] of firstLine.matchAll(/([0-9]+:[0-9]+(-[0-9]+:[0-9]+)*)/gm)) {
          it(fileName + " at " + textRangeString, () => {
            // create the language service
            const sourceText = "// Result of running completion " + completion.name +
              " at position " + textRangeString + sourceWithMarker.substring(firstLine.length)
            testCompletionOnExample(completion, fileName, sourceText, textRangeString)
          })
        }
      }
    })
  }
}

testAllCompletions()
