import { pipe } from "effect"
import * as Array from "effect/Array"
import * as Graph from "effect/Graph"
import * as Option from "effect/Option"
import * as Order from "effect/Order"
import * as Predicate from "effect/Predicate"
import type * as ts from "typescript"
import * as Nano from "./Nano.js"
import * as TypeCheckerApi from "./TypeCheckerApi.js"
import * as TypeCheckerUtils from "./TypeCheckerUtils.js"
import * as TypeParser from "./TypeParser.js"
import * as TypeScriptApi from "./TypeScriptApi.js"
import * as TypeScriptUtils from "./TypeScriptUtils.js"

const formatSourceFileName = (sourceFile: ts.SourceFile) => {
  let fileName = sourceFile.fileName
  if (fileName.indexOf("/") > -1) {
    fileName = fileName.split("/").pop()!
  }
  return fileName
}

const formatSourceFileNameLineAndColumn = (
  ts: TypeScriptApi.TypeScriptApi,
  tsUtils: TypeScriptUtils.TypeScriptUtils,
  node: ts.Node,
  fromSourceFile: ts.SourceFile | undefined
) => {
  const nodeSourceFile = tsUtils.getSourceFileOfNode(node)!
  const nodePosition = ts.getTokenPosOfNode(node, nodeSourceFile)
  const { character, line } = ts.getLineAndCharacterOfPosition(nodeSourceFile, nodePosition)
  if (!fromSourceFile || nodeSourceFile === fromSourceFile) return `ln ${line + 1} col ${character}`
  return `in ${formatSourceFileName(nodeSourceFile)} at ln ${line + 1} col ${character}`
}

export class UnableToProduceLayerGraphError {
  readonly _tag = "@effect/language-service/UnableToProduceLayerGraphError"
  constructor(
    readonly message: string,
    readonly node?: ts.Node | undefined
  ) {}
}

export interface LayerGraphNodeInfo {
  node: ts.Node
  displayNode: ts.Node
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
  | {
    relationship: "symbol"
  }

export type LayerGraph = Graph.Graph<LayerGraphNodeInfo, LayerGraphEdgeInfo, "directed">

export const extractLayerGraph = Nano.fn("extractLayerGraph")(function*(node: ts.Node, opts: {
  arrayLiteralAsMerge: boolean
  explodeOnlyLayerCalls: boolean
  followSymbolsDepth: number
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
  const depthBudget = new WeakMap<ts.Node, number>()

  // do a DFS search to find all the layer nodes and wire them up properly
  const nodeToVisit: Array<ts.Node> = []
  const appendNodeToVisit = (node: ts.Node, nodeDepthBudget: number) => {
    depthBudget.set(node, nodeDepthBudget)
    nodeToVisit.push(node)
    return undefined
  }
  appendNodeToVisit(node, opts.followSymbolsDepth)

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
    } else if (ts.isExpression(node)) {
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

    // for the display node, we want to use the name of the variable declaration if the node is the initializer
    let displayNode = node
    if (node.parent && ts.isVariableDeclaration(node.parent) && node.parent.initializer === node) {
      displayNode = node.parent.name
    }

    return { node, displayNode, layerType, layerTypes, provides, requires }
  })

  const addNode = Nano.fn("addNode")(function*(node: ts.Node, nodeInfo?: LayerGraphNodeInfo) {
    const graphNode = Graph.addNode(mutableGraph, nodeInfo ? nodeInfo : yield* extractNodeInfo(node))
    nodeToGraph.set(node, graphNode)
    return graphNode
  })

  const isSimpleIdentifier = (node: ts.Node): node is ts.Identifier | ts.PropertyAccessExpression => {
    return ts.isIdentifier(node) ||
      (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name) && isSimpleIdentifier(node.expression))
  }

  const getAdjustedNode = (node: ts.Node) =>
    ts.isPropertyDeclaration(node) || ts.isVariableDeclaration(node)
      ? node.initializer
      : (ts.isExpression(node) ? node : undefined)

  while (nodeToVisit.length > 0) {
    const node = nodeToVisit.pop()!
    const currentDepthBudget = depthBudget.get(node)!

    // iterate pipe members
    const pipeArgs = yield* pipe(typeParser.pipeCall(node), Nano.orElse(() => Nano.void_))
    if (pipeArgs) {
      if (!visitedNodes.has(node)) {
        // visit the pipe members, from last to first, then come back to the node
        appendNodeToVisit(node, currentDepthBudget)
        appendNodeToVisit(pipeArgs.subject, currentDepthBudget)
        pipeArgs.args.forEach((_) => appendNodeToVisit(_, currentDepthBudget))
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
          appendNodeToVisit(node, currentDepthBudget)
          node.arguments.forEach((_) => appendNodeToVisit(_, currentDepthBudget))
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
        appendNodeToVisit(node, currentDepthBudget)
        node.elements.forEach((_) => appendNodeToVisit(_, currentDepthBudget))
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

    // if we have budget and this is a simple identifier, we can follow the symbol
    if (currentDepthBudget > 0 && isSimpleIdentifier(node)) {
      let symbol = typeChecker.getSymbolAtLocation(node)
      if (symbol) {
        if (symbol.flags & ts.SymbolFlags.Alias) {
          symbol = typeChecker.getAliasedSymbol(symbol) || symbol
        }
        if (symbol.declarations && symbol.declarations.length === 1) {
          const declarationNode = getAdjustedNode(symbol.declarations[0])
          if (declarationNode) {
            if (!visitedNodes.has(declarationNode)) {
              appendNodeToVisit(node, currentDepthBudget)
              appendNodeToVisit(declarationNode, currentDepthBudget - 1)
              visitedNodes.add(node)
              continue
            }

            const childNode = nodeToGraph.get(declarationNode)
            if (Predicate.isNumber(childNode)) {
              const graphNode = yield* addNode(node)
              Graph.addEdge(mutableGraph, graphNode, childNode, { relationship: "symbol" })
              continue
            }
          }
        }
      }
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

export const formatLayerGraph = Nano.fn("formatLayerGraph")(
  function*(layerGraph: LayerGraph, _fromSourceFile: ts.SourceFile | undefined) {
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
  }
)

export const formatNestedLayerGraph = Nano.fn("formatNestedLayerGraph")(
  function*(layerGraph: LayerGraph, fromSourceFile: ts.SourceFile | undefined) {
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
      const tsNode = graphNode.displayNode
      const sourceFile = tsUtils.getSourceFileOfNode(tsNode)!
      const nodeText = sourceFile.text.substring(tsNode.pos, tsNode.end).trim()
      result = [
        ...result,
        `subgraph ${graphNodeIndex} ["\`${mermaidSafe(nodeText)}<br/><small>_${
          mermaidSafe(formatSourceFileNameLineAndColumn(ts, tsUtils, tsNode, fromSourceFile))
        }_</small>\`"]`,
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

    if (result.length === 0) return ""

    return [
      `flowchart TB`,
      ...result.map((_) => `  ${_}`)
    ].join("\n")
  }
)

export interface LayerOutlineGraphNodeInfo {
  node: ts.Node
  displayNode: ts.Node
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
      displayNode: leafNode.displayNode,
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
            if (!Graph.hasEdge(mutableGraph, nodeIndex, providerNodeIndex)) {
              Graph.addEdge(mutableGraph, nodeIndex, providerNodeIndex, {})
            }
          }
        }
      }
    }
  }

  return Graph.endMutation(mutableGraph)
})

export const formatLayerOutlineGraph = Nano.fn("formatLayerOutlineGraph")(
  function*(layerOutlineGraph: LayerOutlineGraph, fromSourceFile: ts.SourceFile | undefined) {
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    return Graph.toMermaid(layerOutlineGraph, {
      edgeLabel: () => "",
      nodeLabel: (graphNode) => {
        const tsNode = graphNode.displayNode
        const sourceFile = tsUtils.getSourceFileOfNode(tsNode)!
        const nodeText = sourceFile.text.substring(tsNode.pos, tsNode.end).trim()
        if (sourceFile === fromSourceFile) return nodeText
        return `${nodeText}\n_${formatSourceFileNameLineAndColumn(ts, tsUtils, tsNode, fromSourceFile)}_`
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

export const dfsPostOrderWithOrder = <N, E, T extends Graph.Kind = "directed">(
  graph: Graph.Graph<N, E, T> | Graph.MutableGraph<N, E, T>,
  config: Graph.SearchConfig & { order: Order.Order<N> }
): Graph.NodeWalker<N> => {
  const start = config.start ?? []
  const direction = config.direction ?? "outgoing"
  const orderByIndex = Order.mapInput(config.order, (_: Graph.NodeIndex) => graph.nodes.get(_)!)

  return new Graph.Walker((f) => ({
    [Symbol.iterator]: () => {
      const stack: Array<{ node: Graph.NodeIndex; visitedChildren: boolean }> = []
      const discovered = new Set<Graph.NodeIndex>()
      const finished = new Set<Graph.NodeIndex>()

      const sortedStart = Array.sort(start, orderByIndex)

      // Initialize stack with start nodes
      for (let i = sortedStart.length - 1; i >= 0; i--) {
        stack.push({ node: sortedStart[i], visitedChildren: false })
      }

      const nextMapped = () => {
        while (stack.length > 0) {
          const current = stack[stack.length - 1]

          if (!discovered.has(current.node)) {
            discovered.add(current.node)
            current.visitedChildren = false
          }

          if (!current.visitedChildren) {
            current.visitedChildren = true
            const neighbors = Graph.neighborsDirected(graph, current.node, direction)
            const sortedNeighbors = Array.sort(neighbors, orderByIndex)
            for (let i = sortedNeighbors.length - 1; i >= 0; i--) {
              const neighbor = sortedNeighbors[i]
              if (!discovered.has(neighbor) && !finished.has(neighbor)) {
                stack.push({ node: neighbor, visitedChildren: false })
              }
            }
          } else {
            const nodeToEmit = stack.pop()!.node

            if (!finished.has(nodeToEmit)) {
              finished.add(nodeToEmit)

              const nodeData = Graph.getNode(graph, nodeToEmit)
              if (Option.isSome(nodeData)) {
                return { done: false, value: f(nodeToEmit, nodeData.value) }
              }
              return nextMapped()
            }
          }
        }

        return { done: true, value: undefined } as const
      }

      return { next: nextMapped }
    }
  }))
}

// converts an outline graph into a set of provide/provideMerge with target output
export const convertOutlineGraphToLayerMagic = Nano.fn("convertOutlineGraphToLayerMagic")(
  function*(outlineGraph: LayerOutlineGraph, targetOutput: ts.Type) {
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const result: Array<LayerMagicNode> = []

    const missingOutputTypes = new Set(typeCheckerUtils.unrollUnionMembers(targetOutput))
    const currentRequiredTypes = new Set<ts.Type>()
    const orderByProvidedCount = Order.mapInput(
      Order.reverse(Order.number),
      (_: LayerOutlineGraphNodeInfo) => _.provides.length
    )

    // no need to filter because the outline graph is already deduplicated and only keeping childs
    const reversedGraph = Graph.mutate(outlineGraph, Graph.reverse)
    const rootIndexes = Array.fromIterable(Graph.indices(Graph.externals(reversedGraph, { direction: "incoming" })))
    const allNodes = Array.fromIterable(
      Graph.values(dfsPostOrderWithOrder(reversedGraph, { start: rootIndexes, order: orderByProvidedCount }))
    )
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
  displayNodes: Array<ts.Node>
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
        const tsDisplayNodes: Array<ts.Node> = []
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
          tsDisplayNodes.push(layerNode.displayNode)
        }
        result.push({
          kind,
          type: layerType,
          nodes: tsNodes,
          displayNodes: tsDisplayNodes
        })
      }
    }

    walkTypes(new Set(rootNodes.flatMap((_) => _.provides)), "provided")
    walkTypes(new Set(rootNodes.flatMap((_) => _.requires)), "required")
    return result
  }
)

export const formatLayerProvidersAndRequirersInfo = Nano.fn("formatLayerProvidersAndRequirersInfo")(
  function*(info: LayerProvidersAndRequirersInfo, fromSourceFile: ts.SourceFile | undefined) {
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

      const positions = infoNode.displayNodes.map((_) => {
        const sourceFile = tsUtils.getSourceFileOfNode(_)!
        const nodeText = sourceFile.text.substring(_.pos, _.end).trim().replace(/\n/g, " ").substr(0, 50)
        return `${formatSourceFileNameLineAndColumn(ts, tsUtils, _, fromSourceFile)} by \`${nodeText}\``
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
