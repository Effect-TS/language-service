import * as LanguageServicePluginOptions from "@effect/language-service/core/LanguageServicePluginOptions"
import * as LayerGraph from "@effect/language-service/core/LayerGraph"
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
import { configFromSourceComment, createServicesWithMockedVFS } from "./utils/mocks.js"

const getExamplesLayerGraph = () => getExamplesSubdir("layer-graph")

async function testLayerGraphOnExample(fileName: string, sourceText: string) {
  const { languageService, program, sourceFile } = createServicesWithMockedVFS(
    getHarnessDir(),
    getExamplesDir(),
    fileName,
    sourceText
  )

  try {
    // get the node to test
    const nodes: Array<[name: string, node: ts.Node]> = []
    for (const statement of sourceFile.statements) {
      if (
        ts.isVariableStatement(statement) && statement.modifiers &&
        statement.modifiers.some((_) => _.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name) && declaration.initializer) {
            nodes.push([ts.idText(declaration.name), declaration.initializer])
          }
        }
      }
    }

    // at least one test
    expect(nodes.length).toBeGreaterThan(0)
    expect(nodes.map(([name]) => name)).toMatchSnapshot()

    // loop and test the nodes
    for (const [name, node] of nodes) {
      // create snapshot path
      const baseSnapshotFilePath = path.join(
        getSnapshotsSubdir("layer-graph"),
        fileName + "_" + name
      )

      const options = LanguageServicePluginOptions.parse({
        ...LanguageServicePluginOptions.defaults,
        completions: true,
        refactors: false,
        diagnostics: false,
        quickinfo: false,
        goto: false,
        ...configFromSourceComment(sourceText)
      })

      // check and assert the completions is executable
      const maybeGraph = pipe(
        Nano.gen(function*() {
          const layerGraph = yield* LayerGraph.extractLayerGraph(node, {
            arrayLiteralAsMerge: false,
            explodeOnlyLayerCalls: false,
            followSymbolsDepth: options.layerGraphFollowDepth
          })
          const outlineGraph = yield* LayerGraph.extractOutlineGraph(layerGraph)
          const providersAndRequirers = yield* LayerGraph.extractProvidersAndRequirers(layerGraph)
          return {
            layerGraph: yield* LayerGraph.formatLayerGraph(layerGraph, sourceFile),
            layerNestedGraph: yield* LayerGraph.formatNestedLayerGraph(layerGraph, sourceFile),
            outlineGraph: yield* LayerGraph.formatLayerOutlineGraph(outlineGraph, sourceFile),
            providersAndRequirers: yield* LayerGraph.formatLayerProvidersAndRequirersInfo(
              providersAndRequirers,
              sourceFile
            )
          }
        }),
        TypeParser.nanoLayer,
        TypeCheckerUtils.nanoLayer,
        TypeScriptUtils.nanoLayer,
        Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
        Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
        Nano.provideService(
          LanguageServicePluginOptions.LanguageServicePluginOptions,
          options
        ),
        Nano.unsafeRun
      )

      if (Result.isFailure(maybeGraph)) {
        await expect("no graph").toMatchFileSnapshot(baseSnapshotFilePath + ".output")
        return
      }

      await expect(maybeGraph.success.layerGraph, "layerGraph").toMatchFileSnapshot(baseSnapshotFilePath + ".output")
      await expect(maybeGraph.success.layerNestedGraph, "layerNestedGraph").toMatchFileSnapshot(
        baseSnapshotFilePath + ".nested"
      )
      await expect(maybeGraph.success.outlineGraph, "outlineGraph").toMatchFileSnapshot(
        baseSnapshotFilePath + ".outline"
      )
      await expect(maybeGraph.success.providersAndRequirers, "providersAndRequirers").toMatchFileSnapshot(
        baseSnapshotFilePath + ".quickinfo"
      )
    }
  } finally {
    languageService.dispose()
  }
}

function testAllCompletions() {
  // read all filenames
  const allExampleFiles = safeReaddirSync(getExamplesLayerGraph())

  // skip all tests if no example files exist for this harness
  if (allExampleFiles.length === 0) {
    describe("Layer Graph (skipped - no example files)", () => {
      it.skip("no example files for this harness", () => {})
    })
    return
  }

  describe("Layer Graph ", () => {
    // for each example file
    for (const fileName of allExampleFiles) {
      it(fileName, async () => {
        const sourceText = fs.readFileSync(path.join(getExamplesLayerGraph(), fileName))
          .toString("utf8")
        await testLayerGraphOnExample(fileName, sourceText)
      })
    }
  })
}

testAllCompletions()
