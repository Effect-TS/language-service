import { collectExportedItems, renderOverview } from "@effect/language-service/cli/overview"
import * as Nano from "@effect/language-service/core/Nano"
import * as TypeCheckerApi from "@effect/language-service/core/TypeCheckerApi"
import * as TypeCheckerUtils from "@effect/language-service/core/TypeCheckerUtils"
import * as TypeParser from "@effect/language-service/core/TypeParser"
import * as TypeScriptApi from "@effect/language-service/core/TypeScriptApi"
import * as TypeScriptUtils from "@effect/language-service/core/TypeScriptUtils"
import { pipe } from "effect/Function"
import * as Result from "effect/Result"
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import {
  getExamplesDir,
  getExamplesSubdir,
  getHarnessDir,
  getSnapshotsSubdir,
  safeReaddirSync
} from "./utils/harness.js"
import { createServicesWithMockedVFS } from "./utils/mocks.js"

const getExamplesLayerGraphDir = () => getExamplesSubdir("layer-graph")

async function testOverviewOnExample(fileName: string, sourceText: string) {
  const { languageService, program, sourceFile } = createServicesWithMockedVFS(
    getHarnessDir(),
    getExamplesDir(),
    fileName,
    sourceText
  )

  try {
    // create snapshot path
    const snapshotFilePath = path.join(
      getSnapshotsSubdir("overview"),
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

    expect(Result.isSuccess(result), "should run with no error " + result).toEqual(true)

    if (Result.isFailure(result)) {
      await expect("// error running collectExportedItems").toMatchFileSnapshot(snapshotFilePath)
      return
    }

    const items = result.success

    // Render the overview with the file's directory as cwd (so paths are relative)
    const cwd = path.dirname(path.resolve(fileName))
    const rendered = renderOverview({ ...items, totalFilesCount: 1 }, cwd)

    await expect(rendered).toMatchFileSnapshot(snapshotFilePath)
  } finally {
    languageService.dispose()
  }
}

function testAllOverviewExamples() {
  // read all filenames from layer-graph examples
  const allExampleFiles = safeReaddirSync(getExamplesLayerGraphDir())

  // skip all tests if no example files exist for this harness
  if (allExampleFiles.length === 0) {
    describe("Overview (skipped - no example files)", () => {
      it.skip("no example files for this harness", () => {})
    })
    return
  }

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
