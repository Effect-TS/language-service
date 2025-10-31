import { pipe } from "effect"
import * as Array from "effect/Array"
import * as Graph from "effect/Graph"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import type * as ts from "typescript"
import * as Nano from "./Nano.js"
import * as TypeCheckerApi from "./TypeCheckerApi.js"
import * as TypeCheckerUtils from "./TypeCheckerUtils.js"
import * as TypeParser from "./TypeParser.js"
import * as TypeScriptApi from "./TypeScriptApi.js"
import * as TypeScriptUtils from "./TypeScriptUtils.js"

export class UnableToProduceLayerGraphError {
  readonly _tag = "@effect/language-service/UnableToProduceLayerGraphError"
  constructor(
    readonly message: string,
    readonly node?: ts.Node | undefined
  ) {}
}

export interface LayerGraphNodeInfo {
  node: ts.Node
  layerType: ts.Type | undefined
  provides: Array<ts.Type>
  requires: Array<ts.Type>
  layerTypes: undefined | {
    ROut: ts.Type
    E: ts.Type
    RIn: ts.Type
  }
}

export type LayerGraphEdgeInfo =
  | {
    relationship: "call"
    argumentIndex: number
  }
  | {
    relationship: "pipe"
  }
  | {
    relationship: "arrayLiteral"
    index: number
  }

export type LayerGraph = Graph.Graph<LayerGraphNodeInfo, LayerGraphEdgeInfo, "directed">

export const extractLayerGraph = Nano.fn("extractLayerGraph")(function*(node: ts.Node, opts: {
  arrayLiteralAsMerge: boolean
  explodeOnlyLayerCalls: boolean
}) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
  const typeParser = yield* Nano.service(TypeParser.TypeParser)
  const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
  const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

  const sourceFile = tsUtils.getSourceFileOfNode(node)!
  const layerModuleName = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(sourceFile, "effect", "Layer") ||
    "Layer"

  // keep track of the nodes we've visited
  const visitedNodes = new WeakSet<ts.Node>()
  const nodeInPipeContext = new WeakSet<ts.Node>()
  const nodeToGraph = new WeakMap<ts.Node, Graph.NodeIndex>()

  // do a DFS search to find all the layer nodes and wire them up properly
  const nodeToVisit: Array<ts.Node> = [node]
  const appendNodeToVisit = (node: ts.Node) => {
    nodeToVisit.push(node)
    return undefined
  }

  const mutableGraph = Graph.beginMutation(Graph.directed<LayerGraphNodeInfo, LayerGraphEdgeInfo>())

  const extractNodeInfo = Nano.fn("extractNodeInfo")(function*(node: ts.Node) {
    let provides: Array<ts.Type> = []
    let requires: Array<ts.Type> = []
    let layerType: ts.Type | undefined = undefined
    let layerTypes: LayerGraphNodeInfo["layerTypes"] | undefined = undefined
    if (nodeInPipeContext.has(node)) {
      if (ts.isExpression(node)) {
        const contextualType = typeChecker.getContextualType(node)
        if (contextualType) {
          const callSignatures = typeChecker.getSignaturesOfType(contextualType, ts.SignatureKind.Call)
          if (callSignatures.length === 1) {
            layerType = typeChecker.getReturnTypeOfSignature(callSignatures[0])
          }
        }
      }
    } else {
      layerType = typeChecker.getTypeAtLocation(node)
    }
    if (layerType) {
      layerTypes = yield* pipe(typeParser.layerType(layerType, node), Nano.orElse(() => Nano.void_))
    }
    if (!layerTypes) layerType = undefined

    if (layerTypes) {
      // just omit never, not useful at all.
      provides = typeCheckerUtils.unrollUnionMembers(layerTypes.ROut).filter((_) => !(_.flags & ts.TypeFlags.Never))
      requires = typeCheckerUtils.unrollUnionMembers(layerTypes.RIn).filter((_) => !(_.flags & ts.TypeFlags.Never))
    }

    return { node, layerType, layerTypes, provides, requires }
  })

  const addNode = Nano.fn("addNode")(function*(node: ts.Node, nodeInfo?: LayerGraphNodeInfo) {
    const graphNode = Graph.addNode(mutableGraph, nodeInfo ? nodeInfo : yield* extractNodeInfo(node))
    nodeToGraph.set(node, graphNode)
    return graphNode
  })

  while (nodeToVisit.length > 0) {
    const node = nodeToVisit.pop()!

    // iterate pipe members
    const pipeArgs = yield* pipe(typeParser.pipeCall(node), Nano.orElse(() => Nano.void_))
    if (pipeArgs) {
      if (!visitedNodes.has(node)) {
        // visit the pipe members, from last to first, then come back to the node
        appendNodeToVisit(node)
        appendNodeToVisit(pipeArgs.subject)
        pipeArgs.args.forEach(appendNodeToVisit)
        pipeArgs.args.forEach((_) => nodeInPipeContext.add(_))
        visitedNodes.add(node)
      } else {
        // already visited
        const childNodes = [pipeArgs.subject, ...pipeArgs.args].map((_) => nodeToGraph.get(_)).filter(
          Predicate.isNumber
        ).filter(
          (_) => Graph.hasNode(mutableGraph, _)
        )
        if (childNodes.length === pipeArgs.args.length + 1) {
          // all members are graph nodes, link them up in reverse order
          let lastNode: number | null = null
          for (const childNode of childNodes) {
            if (lastNode !== null) Graph.addEdge(mutableGraph, childNode, lastNode, { relationship: "pipe" })
            lastNode = childNode
          }
          if (lastNode !== null) {
            // and finally a node for the pipe call which links to the last one
            const graphNode = yield* addNode(node)
            Graph.addEdge(mutableGraph, graphNode, lastNode, { relationship: "pipe" })
          }
        } else {
          // not every member is a graph node, remove the nodes
          childNodes.forEach((_) => Graph.removeNode(mutableGraph, _))
          // and if I return a layer, add a node for it
          const nodeInfo = yield* extractNodeInfo(node)
          if (nodeInfo.layerTypes) yield* addNode(node, nodeInfo)
        }
      }
      continue
    }

    // a call expression must evaluate the args first
    if (ts.isCallExpression(node)) {
      // if we are exploding only layer api calls, we need to check if this is a layer api call
      let shouldExplode = !opts.explodeOnlyLayerCalls
      if (opts.explodeOnlyLayerCalls) {
        const isLayerCall = ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          ts.idText(node.expression.expression) === layerModuleName
        if (isLayerCall) shouldExplode = true
      }
      // if we should explode
      if (shouldExplode) {
        if (!visitedNodes.has(node)) {
          // visit the args first then come back
          appendNodeToVisit(node)
          node.arguments.forEach(appendNodeToVisit)
          visitedNodes.add(node)
        } else {
          const childNodes = node.arguments.map((_) => nodeToGraph.get(_)).filter(Predicate.isNumber).filter((_) =>
            Graph.hasNode(mutableGraph, _)
          )

          if (childNodes.length === node.arguments.length) {
            // all members are graph nodes to link
            const graphNode = yield* addNode(node)
            childNodes.forEach((_, argumentIndex) =>
              Graph.addEdge(mutableGraph, graphNode, _, { relationship: "call", argumentIndex })
            )
          } else {
            // not every member is a graph node, remove the nodes and keep only me
            childNodes.forEach((_) => Graph.removeNode(mutableGraph, _))
            const nodeInfo = yield* extractNodeInfo(node)
            if (nodeInfo.layerTypes) yield* addNode(node, nodeInfo)
          }
        }
        continue
      }
    }

    // array literal as merge, if enabled.
    if (opts.arrayLiteralAsMerge && ts.isArrayLiteralExpression(node)) {
      if (!visitedNodes.has(node)) {
        appendNodeToVisit(node)
        node.elements.forEach(appendNodeToVisit)
        visitedNodes.add(node)
      } else {
        const childNodes = node.elements.map((_) => nodeToGraph.get(_)).filter(Predicate.isNumber).filter((_) =>
          Graph.hasNode(mutableGraph, _)
        )
        if (childNodes.length > 0) {
          const graphNode = yield* addNode(node)
          childNodes.forEach((_, index) =>
            Graph.addEdge(mutableGraph, graphNode, _, { relationship: "arrayLiteral", index })
          )
        }
      }
      continue
    }

    // just a plain expression, so probably the most basic building block
    if (ts.isExpression(node)) {
      const nodeInfo = yield* extractNodeInfo(node)
      if (nodeInfo.layerTypes) {
        yield* addNode(node, nodeInfo)
      }
      continue
    }

    // PANIC! We got something we don't understand.
    return yield* Nano.fail(new UnableToProduceLayerGraphError("Unable to produce layer graph for node", node))
  }

  return Graph.endMutation(mutableGraph)
})

export const formatLayerGraph = Nano.fn("formatLayerGraph")(function*(layerGraph: LayerGraph) {
  const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
  const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

  return Graph.toMermaid(layerGraph, {
    edgeLabel: (edge) => JSON.stringify(edge),
    nodeLabel: (graphNode) => {
      const sourceFile = tsUtils.getSourceFileOfNode(graphNode.node)!
      let text = sourceFile.text.substring(graphNode.node.pos, graphNode.node.end).trim()
      text += "\nprovides: " +
        (graphNode.provides.map((_) => typeChecker.typeToString(_, undefined, ts.TypeFormatFlags.NoTruncation)).join(
          ", "
        ))
      text += "\nrequires: " +
        graphNode.requires.map((_) => typeChecker.typeToString(_, undefined, ts.TypeFormatFlags.NoTruncation)).join(
          ", "
        )
      return text
    }
  })
})

export const formatNestedLayerGraph = Nano.fn("formatNestedLayerGraph")(function*(layerGraph: LayerGraph) {
  const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
  const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

  const mermaidSafe = (value: string) =>
    value.replace(/\n/g, " ").replace(
      /\s+/g,
      " "
    ).substring(0, 50).replace(/"/g, "#quot;").replace(/</mg, "#lt;").replace(/>/mg, "#gt;").trim()

  const typeNameCache = new Map<ts.Type, string>()
  const typeName = (type: ts.Type) => {
    if (typeNameCache.has(type)) return typeNameCache.get(type)!
    const name = typeChecker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation)
    typeNameCache.set(type, name)
    return name
  }

  let result: Array<string> = []

  // create the boxes first
  for (const [graphNodeIndex, graphNode] of Graph.entries(Graph.nodes(layerGraph))) {
    let subgraphDefs: Array<string> = []
    for (const kind of ["requires", "provides"] as const) {
      const typesMermaidNodes: Array<string> = []
      for (let i = 0; i < graphNode[kind].length; i++) {
        typesMermaidNodes.push(`${graphNodeIndex}_${kind}_${i}["${mermaidSafe(typeName(graphNode[kind][i]))}"]`)
      }
      if (typesMermaidNodes.length > 0) {
        subgraphDefs = [
          ...subgraphDefs,
          `subgraph ${graphNodeIndex}_${kind} [${kind === "provides" ? "Provides" : "Requires"}]`,
          ...typesMermaidNodes.map((_) => `  ${_}`),
          `end`,
          `style ${graphNodeIndex}_${kind} stroke:none`
        ]
      }
    }
    subgraphDefs = [
      `subgraph ${graphNodeIndex}_wrap[" "]`,
      ...subgraphDefs.map((_) => `  ${_}`),
      `end`,
      `style ${graphNodeIndex}_wrap fill:transparent`,
      `style ${graphNodeIndex}_wrap stroke:none`
    ]
    const sourceFile = tsUtils.getSourceFileOfNode(graphNode.node)!
    const nodePosition = graphNode.node.getStart(sourceFile, false)
    const { character, line } = ts.getLineAndCharacterOfPosition(sourceFile, nodePosition)
    const nodeText = sourceFile.text.substring(graphNode.node.pos, graphNode.node.end).trim()
    result = [
      ...result,
      `subgraph ${graphNodeIndex} ["\`${mermaidSafe(nodeText)}<br/>_at ln ${line + 1} col ${character}_\`"]`,
      ...subgraphDefs.map((_) => `  ${_}`),
      `end`,
      `style ${graphNodeIndex} fill:transparent`
    ]
  }

  // and then the edges
  for (const edgeInfo of Graph.values(Graph.edges(layerGraph))) {
    const sourceData = layerGraph.nodes.get(edgeInfo.source)!
    const targetData = layerGraph.nodes.get(edgeInfo.target)!
    let connected: boolean = false
    for (const kind of ["requires", "provides"] as const) {
      for (let i = 0; i < sourceData[kind].length; i++) {
        const targetIdx = targetData[kind].indexOf(sourceData[kind][i])
        if (targetIdx > -1) {
          result.push(`${edgeInfo.source}_${kind}_${i} -.-> ${edgeInfo.target}_${kind}_${targetIdx}`)
          connected = true
        }
      }
    }
    if (!connected) {
      result.push(`${edgeInfo.source} -.-x ${edgeInfo.target}`)
    }
  }

  return [
    `flowchart TB`,
    ...result.map((_) => `  ${_}`)
  ].join("\n")
})

export interface LayerOutlineGraphNodeInfo {
  node: ts.Node
  requires: Array<ts.Type>
  provides: Array<ts.Type>
}

export type LayerOutlineGraph = Graph.Graph<LayerOutlineGraphNodeInfo, {}, "directed">

// traverse the layer graph and create the outline graph
export const extractOutlineGraph = Nano.fn("extractOutlineGraph")(function*(layerGraph: LayerGraph) {
  const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

  const mutableGraph = Graph.beginMutation(Graph.directed<LayerOutlineGraphNodeInfo, {}>())

  const providers = new Map<ts.Type, Array<Graph.NodeIndex>>()
  const knownSymbols = new WeakSet<ts.Symbol>()

  const leafNodes = Graph.values(Graph.externals(layerGraph, { direction: "outgoing" }))
  const dedupedLeafNodes: Array<LayerGraphNodeInfo> = []

  for (const leafNode of leafNodes) {
    const symbol = typeChecker.getSymbolAtLocation(leafNode.node)
    if (!symbol) {
      dedupedLeafNodes.push(leafNode)
    } else if (symbol && !knownSymbols.has(symbol)) {
      dedupedLeafNodes.push(leafNode)
      knownSymbols.add(symbol)
    }
  }

  // dedupe leafNodes by using the type
  for (const leafNode of dedupedLeafNodes) {
    const nodeIndex = Graph.addNode(mutableGraph, {
      node: leafNode.node,
      requires: leafNode.requires,
      provides: leafNode.provides
    })
    for (const providedType of leafNode.provides) {
      // ignore provided and self-required
      if (leafNode.requires.indexOf(providedType) > -1) continue
      // add this node to providers
      const previousProviders = providers.get(providedType) || []
      providers.set(providedType, [...previousProviders, nodeIndex])
    }
  }

  // connect requires to providers
  for (const [nodeIndex, nodeInfo] of Graph.entries(Graph.nodes(mutableGraph))) {
    for (const requiredType of nodeInfo.requires) {
      for (const [providedType, providerNodeIndexes] of providers.entries()) {
        if (requiredType === providedType || typeChecker.isTypeAssignableTo(requiredType, providedType)) {
          for (const providerNodeIndex of providerNodeIndexes) {
            Graph.addEdge(mutableGraph, nodeIndex, providerNodeIndex, {})
          }
        }
      }
    }
  }

  return Graph.endMutation(mutableGraph)
})

export const formatLayerOutlineGraph = Nano.fn("formatLayerOutlineGraph")(
  function*(layerOutlineGraph: LayerOutlineGraph) {
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    return Graph.toMermaid(layerOutlineGraph, {
      edgeLabel: () => "",
      nodeLabel: (graphNode) => {
        const sourceFile = tsUtils.getSourceFileOfNode(graphNode.node)!
        return sourceFile.text.substring(graphNode.node.pos, graphNode.node.end).trim()
      }
    })
  }
)

export interface LayerMagicNode {
  merges: boolean
  provides: boolean
  layerExpression: ts.Expression
}

export interface LayerMagicResult {
  layerMagicNodes: Array<LayerMagicNode>
  missingOutputTypes: Set<ts.Type>
}

// converts an outline graph into a set of provide/provideMerge with target output
export const convertOutlineGraphToLayerMagic = Nano.fn("convertOutlineGraphToLayerMagic")(
  function*(outlineGraph: LayerOutlineGraph, targetOutput: ts.Type) {
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const result: Array<LayerMagicNode> = []

    const missingOutputTypes = new Set(typeCheckerUtils.unrollUnionMembers(targetOutput))
    const currentRequiredTypes = new Set<ts.Type>()

    // no need to filter because the outline graph is already deduplicated and only keeping childs
    const reversedGraph = Graph.mutate(outlineGraph, Graph.reverse)
    const rootIndexes = Array.fromIterable(Graph.indices(Graph.externals(reversedGraph, { direction: "incoming" })))
    const allNodes = Array.fromIterable(Graph.values(Graph.dfsPostOrder(reversedGraph, { start: rootIndexes })))
    for (const nodeInfo of allNodes) {
      if (!ts.isExpression(nodeInfo.node)) continue
      const reallyProvidedTypes = nodeInfo.provides.filter((_) => nodeInfo.requires.indexOf(_) === -1)
      const shouldMerge = reallyProvidedTypes.some((_) => missingOutputTypes.has(_))
      if (shouldMerge) {
        reallyProvidedTypes.forEach((_) => missingOutputTypes.delete(_))
      }
      nodeInfo.provides.forEach((_) => currentRequiredTypes.delete(_))
      nodeInfo.requires.forEach((_) => currentRequiredTypes.add(_))
      result.push({
        merges: shouldMerge,
        provides: true,
        layerExpression: nodeInfo.node
      })
    }

    return {
      layerMagicNodes: result,
      missingOutputTypes
    }
  }
)

// walk the graph and emit nodes matching the predicate, where no children match the predicate
export const walkLeavesMatching = <N, E, T extends Graph.Kind = "directed">(
  graph: Graph.Graph<N, E, T> | Graph.MutableGraph<N, E, T>,
  predicate: (node: N) => boolean,
  config: Graph.SearchConfig = {}
): Graph.NodeWalker<N> => {
  const start = config.start ?? []
  const direction = config.direction ?? "outgoing"

  return new Graph.Walker((f) => ({
    [Symbol.iterator]: () => {
      let queue = [...start]
      const discovered = new Set<Graph.NodeIndex>()

      const nextMapped = () => {
        while (queue.length > 0) {
          const current = queue.shift()!

          if (discovered.has(current)) continue
          discovered.add(current)

          const neighbors = Graph.neighborsDirected(graph, current, direction)
          const neighborsMatching: Array<Graph.NodeIndex> = []
          for (const neighbor of neighbors) {
            const neighborNode = Graph.getNode(graph, neighbor)
            if (Option.isSome(neighborNode) && predicate(neighborNode.value)) {
              neighborsMatching.push(neighbor)
            }
          }

          if (neighborsMatching.length > 0) {
            queue = [...queue, ...neighborsMatching]
          } else {
            const nodeData = Graph.getNode(graph, current)
            if (Option.isSome(nodeData) && predicate(nodeData.value)) {
              return { done: false, value: f(current, nodeData.value) }
            }
          }
        }

        return { done: true, value: undefined } as const
      }

      return { next: nextMapped }
    }
  }))
}

export interface LayerProvidersAndRequirersInfoItem {
  kind: "provided" | "required"
  type: ts.Type
  nodes: Array<ts.Node>
}

export type LayerProvidersAndRequirersInfo = Array<LayerProvidersAndRequirersInfoItem>

// given a layer graph, return the root providers and a list of nodes that introduced them, and same with requires
export const extractProvidersAndRequirers = Nano.fn("extractProvidersAndRequirers")(
  function*(layerGraph: LayerGraph) {
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    const rootWalker = Graph.externals(layerGraph, { direction: "incoming" })
    const rootNodes = Array.fromIterable(Graph.values(rootWalker))
    const rootNodeIndexes = Array.fromIterable(Graph.indices(rootWalker))
    const result: LayerProvidersAndRequirersInfo = []

    const walkTypes = (rootTypes: Set<ts.Type>, kind: "provided" | "required") => {
      const sortedTypes = pipe(Array.fromIterable(rootTypes), Array.sort(typeCheckerUtils.deterministicTypeOrder))
      for (const layerType of sortedTypes) {
        const tsNodes: Array<ts.Node> = []
        for (
          const layerNode of Graph.values(
            walkLeavesMatching(
              layerGraph,
              (_) =>
                (kind === "provided" ? _.provides : _.requires).some((_) =>
                  _ === layerType || typeChecker.isTypeAssignableTo(_, layerType)
                ),
              { start: rootNodeIndexes }
            )
          )
        ) {
          tsNodes.push(layerNode.node)
        }
        result.push({
          kind,
          type: layerType,
          nodes: tsNodes
        })
      }
    }

    walkTypes(new Set(rootNodes.flatMap((_) => _.provides)), "provided")
    walkTypes(new Set(rootNodes.flatMap((_) => _.requires)), "required")
    return result
  }
)

export const formatLayerProvidersAndRequirersInfo = Nano.fn("formatLayerProvidersAndRequirersInfo")(
  function*(info: LayerProvidersAndRequirersInfo) {
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    if (info.length === 0) return ""

    const textualExplanation: Array<string> = []

    const appendInfo = (infoNode: LayerProvidersAndRequirersInfoItem) => {
      const typeString = typeChecker.typeToString(
        infoNode.type,
        undefined,
        ts.TypeFormatFlags.NoTruncation
      )

      const positions = infoNode.nodes.map((_) => {
        const sourceFile = tsUtils.getSourceFileOfNode(_)!
        const nodePosition = ts.getTokenPosOfNode(_, sourceFile)
        const { character, line } = ts.getLineAndCharacterOfPosition(sourceFile, nodePosition)
        const nodeText = sourceFile.text.substring(_.pos, _.end).trim().replace(/\n/g, " ").substr(0, 50)
        return `ln ${line + 1} col ${character} by \`${nodeText}\``
      })

      textualExplanation.push(`- ${typeString} ${infoNode.kind} at ${positions.join(", ")}`)
    }

    const providedItems = info.filter((_) => _.kind === "provided")
    const requiredItems = info.filter((_) => _.kind === "required")
    if (providedItems.length > 0) {
      for (const item of providedItems) {
        appendInfo(item)
      }
      if (textualExplanation.length > 0 && requiredItems.length > 0) textualExplanation.push("")
    }
    if (requiredItems.length > 0) {
      for (const item of requiredItems) {
        appendInfo(item)
      }
    }
    return "/**\n" + textualExplanation.map((l) => " * " + l).join("\n") +
      "\n */"
  }
)
