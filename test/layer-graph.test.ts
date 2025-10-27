import * as LanguageServicePluginOptions from "@effect/language-service/core/LanguageServicePluginOptions"
import * as LayerGraph from "@effect/language-service/core/LayerGraph"
import * as Nano from "@effect/language-service/core/Nano"
import * as TypeCheckerApi from "@effect/language-service/core/TypeCheckerApi"
import * as TypeCheckerUtils from "@effect/language-service/core/TypeCheckerUtils"
import * as TypeParser from "@effect/language-service/core/TypeParser"
import * as TypeScriptApi from "@effect/language-service/core/TypeScriptApi"
import * as TypeScriptUtils from "@effect/language-service/core/TypeScriptUtils"
import { Graph } from "effect"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"
import { describe, expect, it } from "vitest"
import { configFromSourceComment, createServicesWithMockedVFS } from "./utils/mocks.js"

const getExamplesLayerGraph = () => path.join(__dirname, "..", "examples", "layer-graph")

async function testLayerGraphOnExample(fileName: string, sourceText: string) {
  const { program, sourceFile } = createServicesWithMockedVFS(
    fileName,
    sourceText
  )

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
      __dirname,
      "__snapshots__",
      "layer-graph",
      fileName + "_" + name
    )

    // check and assert the completions is executable
    const maybeGraph = pipe(
      Nano.gen(function*() {
        const layerGraph = yield* LayerGraph.extractLayerGraph(node, {
          arrayLiteralAsMerge: false,
          explodeOnlyLayerCalls: false
        })
        const outlineGraph = yield* LayerGraph.extractOutlineGraph(layerGraph)
        return {
          layerGraph: Graph.toMermaid(layerGraph, {
            edgeLabel: (edge) => JSON.stringify(edge),
            nodeLabel: (node) => sourceFile.text.substring(node.node.pos, node.node.end).trim()
          }),
          outlineGraph: Graph.toMermaid(outlineGraph, {
            nodeLabel: (node) => sourceFile.text.substring(node.node.pos, node.node.end).trim(),
            edgeLabel: () => ""
          })
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
        LanguageServicePluginOptions.parse({
          ...LanguageServicePluginOptions.defaults,
          completions: true,
          refactors: false,
          diagnostics: false,
          quickinfo: false,
          goto: false,
          ...configFromSourceComment(sourceText)
        })
      ),
      Nano.unsafeRun
    )

    if (Either.isLeft(maybeGraph)) {
      await expect("no graph").toMatchFileSnapshot(baseSnapshotFilePath + ".output")
      return
    }

    await expect(maybeGraph.right.layerGraph).toMatchFileSnapshot(baseSnapshotFilePath + ".output")
    await expect(maybeGraph.right.outlineGraph).toMatchFileSnapshot(baseSnapshotFilePath + ".outline")
  }
}

function testAllCompletions() {
  // read all filenames
  const allExampleFiles = fs.readdirSync(getExamplesLayerGraph())

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
