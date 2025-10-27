import { pipe } from "effect"
import * as Graph from "effect/Graph"
import * as Predicate from "effect/Predicate"
import type * as ts from "typescript"
import * as Nano from "./Nano.js"
import * as TypeCheckerApi from "./TypeCheckerApi.js"
import * as TypeCheckerUtils from "./TypeCheckerUtils.js"
import * as TypeParser from "./TypeParser.js"
import * as TypeScriptApi from "./TypeScriptApi.js"
import * as TypeScriptUtils from "./TypeScriptUtils.js"

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
        continue
      }
    }

    // PANIC! We got something we don't understand.
  }

  return Graph.endMutation(mutableGraph)
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

  const providers = new WeakMap<ts.Type, Array<Graph.NodeIndex>>()
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
      for (const providerNodeIndex of providers.get(requiredType) || []) {
        Graph.addEdge(mutableGraph, nodeIndex, providerNodeIndex, {})
      }
    }
  }

  return Graph.endMutation(mutableGraph)
})
