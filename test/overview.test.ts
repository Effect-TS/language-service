import { collectExportedItems, renderOverview } from "@effect/language-service/cli/overview"
import * as Nano from "@effect/language-service/core/Nano"
import * as TypeCheckerApi from "@effect/language-service/core/TypeCheckerApi"
import * as TypeCheckerUtils from "@effect/language-service/core/TypeCheckerUtils"
import * as TypeParser from "@effect/language-service/core/TypeParser"
import * as TypeScriptApi from "@effect/language-service/core/TypeScriptApi"
import * as TypeScriptUtils from "@effect/language-service/core/TypeScriptUtils"
import * as Doc from "@effect/printer-ansi/AnsiDoc"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import { createServicesWithMockedVFS } from "./utils/mocks.js"

const getExamplesLayerGraphDir = () => path.join(__dirname, "..", "examples", "layer-graph")

async function testOverviewOnExample(fileName: string, sourceText: string) {
  const { program, sourceFile } = createServicesWithMockedVFS(fileName, sourceText)

  // create snapshot path
  const snapshotFilePath = path.join(
    __dirname,
    "__snapshots__",
    "overview",
    fileName + ".overview"
  )

  // attempt to run collectExportedItems and get the output
  const result = pipe(
    collectExportedItems(sourceFile, ts, program.getTypeChecker()),
    TypeParser.nanoLayer,
    TypeCheckerUtils.nanoLayer,
    TypeScriptUtils.nanoLayer,
    Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
    Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
    Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
    Nano.unsafeRun
  )

  expect(Either.isRight(result), "should run with no error " + result).toEqual(true)

  if (Either.isLeft(result)) {
    await expect("// error running collectExportedItems").toMatchFileSnapshot(snapshotFilePath)
    return
  }

  const items = result.right

  // Render the overview with the file's directory as cwd (so paths are relative)
  const cwd = path.dirname(path.resolve(fileName))
  const doc = renderOverview({ ...items, totalFilesCount: 1 }, cwd)
  const rendered = Doc.render(doc, { style: "pretty" })

  await expect(rendered).toMatchFileSnapshot(snapshotFilePath)
}

function testAllOverviewExamples() {
  // read all filenames from layer-graph examples
  const allExampleFiles = fs.readdirSync(getExamplesLayerGraphDir())

  describe("Overview", () => {
    // for each example file
    for (const fileName of allExampleFiles) {
      if (!fileName.endsWith(".ts")) continue

      it(fileName, async () => {
        const sourceText = fs.readFileSync(path.join(getExamplesLayerGraphDir(), fileName))
          .toString("utf8")
        await testOverviewOnExample(fileName, sourceText)
      })
    }
  })
}

testAllOverviewExamples()
