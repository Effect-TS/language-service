import * as Array from "effect/Array"
import * as Encoding from "effect/Encoding"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as pako from "pako"
import type * as ts from "typescript"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions"
import * as LayerGraph from "../core/LayerGraph"
import * as Nano from "../core/Nano"
import * as TypeCheckerApi from "../core/TypeCheckerApi"
import * as TypeParser from "../core/TypeParser"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

function generateMarmaidUri(
  code: string,
  mermaidProvider: LanguageServicePluginOptions.LanguageServicePluginOptions["mermaidProvider"]
): Nano.Nano<string, never, TypeScriptApi.TypeScriptApi | TypeCheckerApi.TypeCheckerApi> {
  return Nano.gen(function*() {
    const state = JSON.stringify({ code })
    const data = new TextEncoder().encode(state)
    const compressed = pako.deflate(data, { level: 9 })
    const pakoString = "pako:" + Encoding.encodeBase64Url(compressed)
    if (mermaidProvider === "mermaid.com") {
      return "https://www.mermaidchart.com/play#" + pakoString
    } else if (mermaidProvider === "mermaid.live") {
      return "https://mermaid.live/edit#" + pakoString
    } else {
      return mermaidProvider + "/edit#" + pakoString
    }
  })
}

function getAdjustedNode(
  sourceFile: ts.SourceFile,
  position: number
) {
  return Nano.gen(function*() {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    // find the node we are hovering
    const range = tsUtils.toTextRange(position)
    const maybeNode = pipe(
      tsUtils.getAncestorNodesInRange(sourceFile, range),
      Array.filter((_) => ts.isVariableDeclaration(_) || ts.isPropertyDeclaration(_)),
      Array.filter((_) => tsUtils.isNodeInRange(range)(_.name)),
      Array.head
    )
    if (Option.isNone(maybeNode)) return undefined
    const node = maybeNode.value
    const layerNode = node.initializer
      ? node.initializer
      : node

    const layerType = typeChecker.getTypeAtLocation(layerNode)
    const maybeLayer = yield* Nano.option(typeParser.layerType(layerType, layerNode))

    if (Option.isNone(maybeLayer)) return undefined

    return { node, layerNode }
  })
}

function parseLayerGraph(
  layerNode: ts.Node
) {
  return Nano.gen(function*() {
    const options = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    const layerGraph = yield* LayerGraph.extractLayerGraph(layerNode, {
      arrayLiteralAsMerge: false,
      explodeOnlyLayerCalls: false,
      followSymbolsDepth: options.layerGraphFollowDepth
    })
    const sourceFile = tsUtils.getSourceFileOfNode(layerNode)!
    const nestedGraphMermaid = yield* LayerGraph.formatNestedLayerGraph(layerGraph, sourceFile)

    const outlineGraph = yield* LayerGraph.extractOutlineGraph(layerGraph)
    const outlineGraphMermaid = yield* LayerGraph.formatLayerOutlineGraph(outlineGraph, sourceFile)
    const providersAndRequirers = yield* LayerGraph.extractProvidersAndRequirers(layerGraph)
    const providersAndRequirersTextualExplanation = yield* LayerGraph.formatLayerProvidersAndRequirersInfo(
      providersAndRequirers,
      sourceFile
    )
    return { nestedGraphMermaid, outlineGraphMermaid, providersAndRequirersTextualExplanation }
  })
}

export function effectApiGetLayerGraph(
  sourceFile: ts.SourceFile,
  line: number,
  character: number
) {
  return Nano.gen(function*() {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const position = ts.getPositionOfLineAndCharacter(sourceFile, line, character)
    const maybeNodes = yield* getAdjustedNode(sourceFile, position)
    if (!maybeNodes) return yield* Nano.fail(new LayerGraph.UnableToProduceLayerGraphError("No node found"))
    const { layerNode, node } = maybeNodes
    const { nestedGraphMermaid } = yield* parseLayerGraph(layerNode)
    return { start: node.pos, end: node.end, mermaidCode: nestedGraphMermaid }
  })
}

export function layerInfo(
  sourceFile: ts.SourceFile,
  position: number,
  quickInfo: ts.QuickInfo | undefined
) {
  return pipe(
    Nano.gen(function*() {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
      const options = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)

      const maybeNodes = yield* getAdjustedNode(sourceFile, position)
      if (!maybeNodes) return quickInfo
      const { layerNode, node } = maybeNodes

      const layerInfoDisplayParts = yield* pipe(
        parseLayerGraph(layerNode),
        Nano.flatMap(({ nestedGraphMermaid, outlineGraphMermaid, providersAndRequirersTextualExplanation }) =>
          Nano.gen(function*() {
            const linkParts: Array<ts.SymbolDisplayPart> = []
            if (!options.noExternal) {
              const mermaidUri = yield* generateMarmaidUri(nestedGraphMermaid, options.mermaidProvider)
              const outlineMermaidUri = yield* generateMarmaidUri(outlineGraphMermaid, options.mermaidProvider)
              linkParts.push({ kind: "space", text: "\n" })
              linkParts.push({ kind: "link", text: "{@link " })
              linkParts.push({ kind: "linkText", text: mermaidUri + " Show full Layer graph" })
              linkParts.push({ kind: "link", text: "}" })
              linkParts.push({ kind: "text", text: " - " })
              linkParts.push({ kind: "link", text: "{@link " })
              linkParts.push({ kind: "linkText", text: outlineMermaidUri + " Show Layer outline" })
              linkParts.push({ kind: "link", text: "}" })
              linkParts.push({ kind: "space", text: "\n" })
            }
            if (providersAndRequirersTextualExplanation.length === 0) return linkParts
            return [
              {
                kind: "text",
                text: (
                  "```\n" +
                  providersAndRequirersTextualExplanation +
                  "\n```\n"
                )
              },
              ...linkParts
            ]
          })
        ),
        Nano.orElse(() => Nano.succeed([] as Array<ts.SymbolDisplayPart>))
      )

      // nothing to show
      if (layerInfoDisplayParts.length === 0) return quickInfo

      // there are cases where we create it from scratch
      if (!quickInfo) {
        const start = ts.getTokenPosOfNode(node, sourceFile)
        const end = node.end
        return {
          kind: ts.ScriptElementKind.callSignatureElement,
          kindModifiers: "",
          textSpan: { start, length: end - start },
          documentation: layerInfoDisplayParts
        } satisfies ts.QuickInfo
      }

      // add to existing documentation
      if (quickInfo.documentation) {
        return {
          ...quickInfo,
          documentation: quickInfo.documentation.concat([{ kind: "space", text: "\n" }]).concat(layerInfoDisplayParts)
        }
      }

      return {
        ...quickInfo,
        documentation: layerInfoDisplayParts
      }
    }),
    Nano.orElse(() => Nano.succeed(quickInfo))
  )
}
