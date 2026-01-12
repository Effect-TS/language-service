import { collectLayerInfoByName, renderLayerInfo } from "@effect/language-service/cli/layerinfo"
import { collectExportedItems } from "@effect/language-service/cli/overview"
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

function testAllLayerInfoExamples() {
  // read all filenames from layer-graph examples
  const allExampleFiles = fs.readdirSync(getExamplesLayerGraphDir())

  describe("LayerInfo", () => {
    // for each example file
    for (const fileName of allExampleFiles) {
      if (!fileName.endsWith(".ts")) continue

      describe(fileName, () => {
        const sourceText = fs.readFileSync(path.join(getExamplesLayerGraphDir(), fileName))
          .toString("utf8")

        // Create services once for the entire file
        const { program, sourceFile } = createServicesWithMockedVFS(fileName, sourceText)
        const typeChecker = program.getTypeChecker()

        // Collect all layer names from the file (depth 0 = only directly exported)
        const layersResult = pipe(
          collectExportedItems(sourceFile, ts, typeChecker, 0, false),
          TypeParser.nanoLayer,
          TypeCheckerUtils.nanoLayer,
          TypeScriptUtils.nanoLayer,
          Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker),
          Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
          Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
          Nano.unsafeRun
        )

        if (Either.isLeft(layersResult)) {
          it("should collect layers without error", () => {
            expect(Either.isRight(layersResult)).toEqual(true)
          })
          return
        }

        const layerNames = layersResult.right.layers.map((l) => l.name)

        if (layerNames.length === 0) {
          it("has no layers to test", () => {
            expect(layerNames.length).toEqual(0)
          })
          return
        }

        // Create a test for each layer
        for (const layerName of layerNames) {
          it(layerName, async () => {
            await testLayerInfoByName(fileName, sourceText, layerName)
          })
        }
      })
    }
  })
}

async function testLayerInfoByName(
  fileName: string,
  sourceText: string,
  layerName: string
) {
  // Create services fresh for each test
  const { program, sourceFile } = createServicesWithMockedVFS(fileName, sourceText)
  const typeChecker = program.getTypeChecker()

  // create snapshot path with pattern: filename.ts.layerName.layerinfo
  const snapshotFilePath = path.join(
    __dirname,
    "__snapshots__",
    "layerinfo",
    `${fileName}.${layerName}.layerinfo`
  )

  // Collect layer info using the new Nano function
  const result = pipe(
    collectLayerInfoByName(sourceFile, layerName),
    TypeParser.nanoLayer,
    TypeCheckerUtils.nanoLayer,
    TypeScriptUtils.nanoLayer,
    Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker),
    Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
    Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
    Nano.run
  )

  if (Either.isLeft(result)) {
    await expect(`// error: ${String(result.left)}`).toMatchFileSnapshot(snapshotFilePath)
    return
  }

  const layerInfoResult = result.right
  if (!layerInfoResult) {
    await expect(`// error: layer "${layerName}" not found`).toMatchFileSnapshot(snapshotFilePath)
    return
  }

  // Render the layer info with the file's directory as cwd (so paths are relative)
  const cwd = path.dirname(path.resolve(fileName))
  const doc = renderLayerInfo(layerInfoResult, cwd)
  const rendered = Doc.render(doc, { style: "pretty" })

  await expect(rendered).toMatchFileSnapshot(snapshotFilePath)
}

testAllLayerInfoExamples()
