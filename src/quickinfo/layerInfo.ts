import * as Array from "effect/Array"
import * as Encoding from "effect/Encoding"
import { pipe } from "effect/Function"
import * as Graph from "effect/Graph"
import * as Option from "effect/Option"
import * as pako from "pako"
import type * as ts from "typescript"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions"
import * as LayerGraph from "../core/LayerGraph"
import * as Nano from "../core/Nano"
import * as TypeCheckerApi from "../core/TypeCheckerApi"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils"
import * as TypeParser from "../core/TypeParser"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

interface LayerGraphContext {
  services: Map<string, ts.Type>
  serviceTypeToString: Map<string, string>
  nextId: () => string
}

class UnableToProduceLayerGraphError {
  readonly _tag = "@effect/language-service/UnableToProduceLayerGraphError"
  constructor(
    readonly message: string,
    readonly node?: ts.Node | undefined
  ) {}
}

class GraphNodeLeaf {
  readonly _tag = "GraphNodeLeaf"

  constructor(
    readonly id: string,
    readonly node: ts.Node,
    readonly rout: Array<string>,
    readonly rin: Array<string>
  ) {}
}

class GraphNodeCompoundTransform {
  readonly _tag = "GraphNodeCompoundTransform"

  constructor(
    readonly id: string,
    readonly node: ts.Node,
    readonly args: Array<LayerGraphNode>,
    readonly rout: Array<string>,
    readonly rin: Array<string>
  ) {}
}

type LayerGraphNode =
  | GraphNodeLeaf
  | GraphNodeCompoundTransform

function processLayerGraphNode(
  ctx: LayerGraphContext,
  node: ts.Node,
  pipedInGraphNode: LayerGraphNode | undefined
): Nano.Nano<
  LayerGraphNode,
  UnableToProduceLayerGraphError,
  | TypeCheckerApi.TypeCheckerApi
  | TypeScriptApi.TypeScriptApi
  | TypeParser.TypeParser
  | TypeCheckerUtils.TypeCheckerUtils
> {
  return Nano.gen(function*() {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const excludeNever = (type: ts.Type) => Nano.succeed((type.flags & ts.TypeFlags.Never) !== 0)

    // expression.pipe(.....)
    // pipe(A, B, ...)
    const maybePipe = yield* Nano.option(typeParser.pipeCall(node))
    if (
      Option.isSome(maybePipe)
    ) {
      let graphNode = yield* processLayerGraphNode(ctx, maybePipe.value.subject, undefined)
      for (const entry of maybePipe.value.args) {
        graphNode = yield* processLayerGraphNode(ctx, entry, graphNode)
      }
      return graphNode
    }

    // this is function call that returns a layer
    if (
      ts.isCallExpression(node)
    ) {
      const type = typeChecker.getTypeAtLocation(node)
      const maybeLayer = yield* Nano.option(typeParser.layerType(type, node))

      if (Option.isSome(maybeLayer)) {
        const argNodes = yield* Nano.option(
          Nano.all(...node.arguments.map((_) => processLayerGraphNode(ctx, _, undefined)))
        )
        if (Option.isSome(argNodes) && argNodes.value.length === node.arguments.length) {
          const { allIndexes: outTypes } = yield* typeCheckerUtils.appendToUniqueTypesMap(
            ctx.services,
            maybeLayer.value.ROut,
            excludeNever
          )
          const { allIndexes: inTypes } = yield* typeCheckerUtils.appendToUniqueTypesMap(
            ctx.services,
            maybeLayer.value.RIn,
            excludeNever
          )
          return new GraphNodeCompoundTransform(
            ctx.nextId(),
            node,
            argNodes.value,
            outTypes,
            inTypes
          )
        }
      }
    }

    // we have a pipe in, and type is something like (_: Layer) => Layer since inside pipe chain
    if (pipedInGraphNode && ts.isExpression(node)) {
      const type = typeChecker.getContextualType(node)
      if (type) {
        const callSignatures = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call)
        if (callSignatures.length === 1) {
          const [signature] = callSignatures
          const returnType = typeChecker.getReturnTypeOfSignature(signature)
          const maybeLayer = yield* Nano.option(typeParser.layerType(returnType, node))
          if (Option.isSome(maybeLayer)) {
            const { allIndexes: outTypes } = yield* typeCheckerUtils.appendToUniqueTypesMap(
              ctx.services,
              maybeLayer.value.ROut,
              excludeNever
            )
            const { allIndexes: inTypes } = yield* typeCheckerUtils.appendToUniqueTypesMap(
              ctx.services,
              maybeLayer.value.RIn,
              excludeNever
            )
            // A.pipe(Layer.merge(B))
            if (ts.isCallExpression(node)) {
              const argNodes = yield* Nano.option(
                Nano.all(...node.arguments.map((_) => processLayerGraphNode(ctx, _, undefined)))
              )
              if (Option.isSome(argNodes) && argNodes.value.length === node.arguments.length) {
                return new GraphNodeCompoundTransform(
                  ctx.nextId(),
                  node,
                  [pipedInGraphNode, ...argNodes.value],
                  outTypes,
                  inTypes
                )
              }
            }
            const argNode = yield* Nano.option(processLayerGraphNode(ctx, node, undefined))
            if (Option.isSome(argNode)) {
              return new GraphNodeCompoundTransform(
                ctx.nextId(),
                node,
                [pipedInGraphNode, argNode.value],
                outTypes,
                inTypes
              )
            } else {
              return new GraphNodeCompoundTransform(
                ctx.nextId(),
                node,
                [pipedInGraphNode],
                outTypes,
                inTypes
              )
            }
          }
        }
      }
    }

    // if this is an expression that returns a layer, this is the most basic building block.
    if (ts.isExpression(node)) {
      const type = typeChecker.getTypeAtLocation(node)
      const maybeLayer = yield* Nano.option(typeParser.layerType(type, node))
      if (Option.isSome(maybeLayer)) {
        const { allIndexes: outTypes } = yield* typeCheckerUtils.appendToUniqueTypesMap(
          ctx.services,
          maybeLayer.value.ROut,
          excludeNever
        )
        const { allIndexes: inTypes } = yield* typeCheckerUtils.appendToUniqueTypesMap(
          ctx.services,
          maybeLayer.value.RIn,
          excludeNever
        )
        return new GraphNodeLeaf(ctx.nextId(), node, outTypes, inTypes)
      }
    }

    const nodeText = node.getText().trim().substr(0, 20)
    return yield* Nano.fail(new UnableToProduceLayerGraphError(nodeText))
  })
}

// returns the innermost node that provides that
function findInnermostGraphEdge(graph: LayerGraphNode, kind: "rin" | "rout", key: string): Array<LayerGraphNode> {
  switch (graph._tag) {
    case "GraphNodeLeaf":
      return (graph[kind].indexOf(key) > -1) ? [graph] : []
    case "GraphNodeCompoundTransform": {
      if (graph[kind].indexOf(key) > -1) {
        let result: Array<LayerGraphNode> = []
        for (const child of graph.args) {
          result = result.concat(findInnermostGraphEdge(child, kind, key))
        }
        if (result.length > 0) return result
        return [graph]
      }
      return []
    }
  }
}

interface MermaidGraphContext {
  seenIds: Set<string>
}

function escapeMermaid(text: string) {
  return text.replace(/"/mg, "#quot;").replace(/\n/mg, " ").replace(/</mg, "#lt;").replace(/>/mg, "#gt;")
}

function processNodeMermaid(
  graph: LayerGraphNode,
  ctx: MermaidGraphContext,
  ctxL: LayerGraphContext
): Nano.Nano<Array<string>, never, TypeScriptApi.TypeScriptApi | TypeCheckerApi.TypeCheckerApi> {
  return Nano.gen(function*() {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    let subgraphDefs: Array<string> = []

    if (!ctx.seenIds.has(graph.id)) {
      const subgraphsIn: Array<string> = []
      for (const serviceId of graph.rin) {
        const type = ctxL.services.get(serviceId)!
        const typeString = typeChecker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation)
        subgraphsIn.push("subgraph " + graph.id + "_rin_" + serviceId + " [\"`" + escapeMermaid(typeString) + "`\"]")
        subgraphsIn.push("end")
      }

      const subgraphsOut: Array<string> = []
      for (const serviceId of graph.rout) {
        const type = ctxL.services.get(serviceId)!
        const typeString = typeChecker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation)
        subgraphsOut.push("subgraph " + graph.id + "_rout_" + serviceId + " [\"`" + escapeMermaid(typeString) + "`\"]")
        subgraphsOut.push("end")
      }

      const sourceFile = graph.node.getSourceFile()
      const nodePosition = graph.node.getStart(sourceFile, false)
      const { character, line } = ts.getLineAndCharacterOfPosition(sourceFile, nodePosition)

      if (subgraphsIn.length > 0) {
        subgraphDefs = [
          ...subgraphDefs,
          "subgraph " + graph.id + "_rin [Requires]",
          ...subgraphsIn,
          "end",
          "style " + graph.id + "_rin stroke:none"
        ]
      }

      if (subgraphsOut.length > 0) {
        subgraphDefs = [
          ...subgraphDefs,
          "subgraph " + graph.id + "_rout [Provides]",
          ...subgraphsOut,
          "end",
          "style " + graph.id + "_rout stroke:none"
        ]
      }

      const nodeText = graph.node.getText().trim().replace(/\n/g, " ").substr(0, 50)
      subgraphDefs = [
        "subgraph " + graph.id + " [\"`" + escapeMermaid(nodeText) + " _at ln " + (line + 1) + " col " +
        character +
        "_`\"]",
        ...subgraphDefs,
        "end",
        "style " + graph.id + " fill:transparent"
      ]
      ctx.seenIds.add(graph.id)
    }
    switch (graph._tag) {
      case "GraphNodeLeaf": {
        return subgraphDefs
      }
      case "GraphNodeCompoundTransform": {
        const childs = Array.flatten(yield* Nano.all(...graph.args.map((_) => processNodeMermaid(_, ctx, ctxL))))
        let currentEdges: Array<string> = []
        const connectedNodes = new Set<string>()
        for (const requiredServiceKey of graph.rin) {
          for (const childNode of graph.args.filter((childNode) => childNode.rin.indexOf(requiredServiceKey) > -1)) {
            currentEdges = [
              ...currentEdges,
              graph.id + "_rin_" + requiredServiceKey + " -.-> " + childNode.id + "_rin_" + requiredServiceKey
            ]
            connectedNodes.add(childNode.id)
          }
        }
        for (const providedServiceKey of graph.rout) {
          for (const childNode of graph.args.filter((childNode) => childNode.rout.indexOf(providedServiceKey) > -1)) {
            currentEdges = [
              ...currentEdges,
              graph.id + "_rout_" + providedServiceKey + " -.-> " + childNode.id + "_rout_" + providedServiceKey
            ]
            connectedNodes.add(childNode.id)
          }
        }
        for (const childNode of graph.args) {
          if (!connectedNodes.has(childNode.id)) {
            currentEdges = [...currentEdges, graph.id + " -.-x " + childNode.id]
          }
        }
        return [...subgraphDefs, ...childs, ...currentEdges]
      }
    }
  })
}

function generateMarmaidUri(
  code: string
): Nano.Nano<string, never, TypeScriptApi.TypeScriptApi | TypeCheckerApi.TypeCheckerApi> {
  return Nano.gen(function*() {
    const state = JSON.stringify({ code })
    const data = new TextEncoder().encode(state)
    const compressed = pako.deflate(data, { level: 9 })
    const pakoString = "pako:" + Encoding.encodeBase64Url(compressed)
    return "https://www.mermaidchart.com/play#" + pakoString
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
  sourceFile: ts.SourceFile,
  layerNode: ts.Node
) {
  return Nano.gen(function*() {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    let lastId = 0
    const graphCtx: LayerGraphContext = {
      services: new Map(),
      serviceTypeToString: new Map(),
      nextId: () => "id" + (lastId++)
    }
    const rootNode = yield* processLayerGraphNode(graphCtx, layerNode, undefined)
    const ctx: MermaidGraphContext = {
      seenIds: new Set()
    }
    const mermaidLines = yield* processNodeMermaid(rootNode, ctx, graphCtx)
    const mermaidCode = "flowchart TB\n" + mermaidLines.join("\n")

    const textualExplanation: Array<string> = []
    const appendInfo = (providesNode: Array<LayerGraphNode>, type: ts.Type, kindText: string) => {
      const typeString = typeChecker.typeToString(
        type,
        undefined,
        ts.TypeFormatFlags.NoTruncation
      )

      const positions = providesNode.map((_) => {
        const nodePosition = _.node.getStart(sourceFile, false)
        const { character, line } = ts.getLineAndCharacterOfPosition(sourceFile, nodePosition)
        const nodeText = _.node.getText().trim().replace(/\n/g, " ").substr(0, 50)
        return "ln " + (line + 1) + " col " + character + " by `" + nodeText + "`"
      })

      textualExplanation.push("- " + typeString + " " + kindText + " at " + positions.join(", "))
    }

    for (const providesKey of rootNode.rout) {
      const providesNode = findInnermostGraphEdge(rootNode, "rout", providesKey)
      appendInfo(providesNode, graphCtx.services.get(providesKey)!, "provided")
    }
    if (textualExplanation.length > 0) textualExplanation.push("")
    for (const requiresKey of rootNode.rin) {
      const requiresNode = findInnermostGraphEdge(rootNode, "rin", requiresKey)
      appendInfo(requiresNode, graphCtx.services.get(requiresKey)!, "required")
    }
    return { mermaidCode, textualExplanation }
  })
}

export function effectApiGetLayerGraph(
  sourceFile: ts.SourceFile,
  line: number,
  character: number
) {
  return pipe(
    Nano.gen(function*() {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
      const position = ts.getPositionOfLineAndCharacter(sourceFile, line, character)
      const maybeNodes = yield* getAdjustedNode(sourceFile, position)
      if (!maybeNodes) return yield* Nano.fail(new UnableToProduceLayerGraphError("No node found"))
      const { layerNode, node } = maybeNodes
      const { mermaidCode } = yield* parseLayerGraph(sourceFile, layerNode)
      return { start: node.pos, end: node.end, mermaidCode }
    })
  )
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

      const layerGraph = yield* LayerGraph.extractLayerGraph(layerNode, {
        arrayLiteralAsMerge: false,
        explodeOnlyLayerCalls: false
      })
      const outlineGraph = yield* LayerGraph.extractOutlineGraph(layerGraph)
      const outlineMermaidCode = Graph.toMermaid(outlineGraph, {
        nodeLabel: (node) => sourceFile.text.substring(node.node.pos, node.node.end).trim(),
        edgeLabel: () => ""
      })

      const layerInfoDisplayParts = yield* pipe(
        parseLayerGraph(sourceFile, layerNode),
        Nano.flatMap(({ mermaidCode, textualExplanation }) =>
          Nano.gen(function*() {
            const linkParts: Array<ts.SymbolDisplayPart> = []
            if (!options.noExternal) {
              const mermaidUri = yield* generateMarmaidUri(mermaidCode)
              const outlineMermaidUri = yield* generateMarmaidUri(outlineMermaidCode)
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
            if (textualExplanation.length === 0) return linkParts
            return [
              {
                kind: "text",
                text: (
                  "```\n" +
                  "/**\n" + textualExplanation.map((l) => " * " + l).join("\n") +
                  "\n */\n```\n"
                )
              },
              ...linkParts
            ]
          })
        ),
        Nano.orElse((e) =>
          Nano.succeed([{
            kind: "text",
            text: (
              "```\n" +
              "/** layer graph not created: " + e.message + " */" +
              "\n```\n"
            )
          }] as Array<ts.SymbolDisplayPart>)
        )
      )

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
