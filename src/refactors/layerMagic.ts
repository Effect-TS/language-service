import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

interface DependencyNode {
  provides: Array<string>
  requires: Array<string>
  node: ts.Expression
}

interface DependencySortResult {
  sorted: Array<DependencyNode>
  cycles: Array<Array<string>>
  hasCycles: boolean
}

/**
 * Sorts dependency nodes using a modified depth-first approach with cycle detection.
 *
 * Rules:
 * 1. Nodes that provide services come before nodes that require them
 * 2. Multiple providers of the same service are ordered by fewer requirements first
 * 3. Cycles are detected and reported gracefully
 *
 * @param nodes Record of dependency nodes to sort, where keys are node identifiers
 * @returns Sorted nodes with cycle information
 */
export function sortDependencies(nodes: Record<string, DependencyNode>): DependencySortResult {
  const result: Array<DependencyNode> = []
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const cycles: Array<Array<string>> = []

  // Create a map of what each node provides for quick lookup
  const providesMap = new Map<string, Array<string>>()
  Object.entries(nodes).forEach(([nodeId, node]) => {
    node.provides.forEach((service) => {
      if (!providesMap.has(service)) {
        providesMap.set(service, [])
      }
      providesMap.get(service)!.push(nodeId)
    })
  })

  // Sort providers of the same service by number of requirements (ascending)
  providesMap.forEach((nodeIds) => {
    nodeIds.sort((a, b) => {
      const nodeA = nodes[a]!
      const nodeB = nodes[b]!
      return nodeA.requires.length - nodeB.requires.length
    })
  })

  const visit = (nodeId: string, path: Array<string>): void => {
    if (visited.has(nodeId)) {
      return
    }

    if (visiting.has(nodeId)) {
      // Cycle detected
      const cycleStart = path.indexOf(nodeId)
      const cycle = path.slice(cycleStart).concat([nodeId])
      const cycleServices = cycle.map((id) => {
        const node = nodes[id]!
        return `${node.provides.join(", ")} (requires: ${node.requires.join(", ")})`
      })
      cycles.push(cycleServices)
      return
    }

    visiting.add(nodeId)
    const currentPath = [...path, nodeId]

    // Find all nodes that this node depends on
    const dependencies = new Set<string>()
    const node = nodes[nodeId]!

    // For each requirement, find nodes that provide it
    node.requires.forEach((requiredService) => {
      const providers = providesMap.get(requiredService) || []
      providers.forEach((providerId) => {
        if (providerId !== nodeId) {
          dependencies.add(providerId)
        }
      })
    })

    // Visit dependencies first (depth-first)
    dependencies.forEach((depId) => {
      visit(depId, currentPath)
    })

    visiting.delete(nodeId)
    visited.add(nodeId)
    result.push(node)
  }

  // Visit all nodes
  Object.keys(nodes).forEach((nodeId) => {
    if (!visited.has(nodeId)) {
      visit(nodeId, [])
    }
  })

  return {
    sorted: result,
    cycles,
    hasCycles: cycles.length > 0
  }
}

interface LayerMagicExtractedLayer {
  node: ts.Expression
  RIn: ts.Type
  E: ts.Type
  ROut: ts.Type
}

export const layerMagic = LSP.createRefactor({
  name: "layerMagic",
  description: "Layer Magic",
  apply: Nano.fn("layerMagic.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    const layerIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "effect",
      "Layer"
    ) || "Layer"

    const extractArrayLiteral = (node: ts.Node): Nano.Nano<
      Array<LayerMagicExtractedLayer>,
      TypeParser.TypeParserIssue,
      never
    > => {
      if (ts.isArrayLiteralExpression(node)) {
        return pipe(
          Nano.all(...node.elements.map((element) => extractLayers(element, false))),
          Nano.map(Array.flatten)
        )
      }
      return TypeParser.TypeParserIssue.issue
    }

    const extractLayerExpression: (
      node: ts.Node
    ) => Nano.Nano<
      Array<LayerMagicExtractedLayer>,
      TypeParser.TypeParserIssue,
      never
    > = (node: ts.Node) => {
      if (ts.isExpression(node)) {
        return pipe(
          typeParser.layerType(typeChecker.getTypeAtLocation(node), node),
          Nano.map((_) => [{ node, ..._ }])
        )
      }
      return TypeParser.TypeParserIssue.issue
    }

    const extractLayerApi: (
      node: ts.Node
    ) => Nano.Nano<
      Array<LayerMagicExtractedLayer>,
      TypeParser.TypeParserIssue,
      never
    > = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) && ts.idText(node.expression.expression) === layerIdentifier &&
        ts.isIdentifier(node.expression.name) &&
        ["provide", "provideMerge", "merge", "mergeAll"].map((_) => _.toLowerCase()).indexOf(
            ts.idText(node.expression.name).toLowerCase()
          ) > -1
      ) {
        return pipe(
          Nano.all(...node.arguments.map((element) => extractLayers(element, false))),
          Nano.map(Array.flatten)
        )
      }
      return TypeParser.TypeParserIssue.issue
    }

    const extractPipeSequencing: (
      node: ts.Node
    ) => Nano.Nano<
      Array<LayerMagicExtractedLayer>,
      TypeParser.TypeParserIssue,
      never
    > = (node: ts.Node) => {
      return pipe(
        typeParser.pipeCall(node),
        Nano.flatMap((_) => {
          return Nano.all(...[_.subject, ..._.args].map((element) => extractLayers(element, true)))
        }),
        Nano.map(Array.flatten)
      )
    }

    const extractLayers: (
      node: ts.Node,
      inPipeContext: boolean
    ) => Nano.Nano<Array<LayerMagicExtractedLayer>, TypeParser.TypeParserIssue, never> = Nano
      .cachedBy(
        Nano.fn("layerMagic.apply.extractLayerArray")(function*(node: ts.Node, _inPipeContext: boolean) {
          return yield* pipe(
            extractArrayLiteral(node),
            Nano.orElse(() => extractLayerApi(node)),
            _inPipeContext ? (x) => x : Nano.orElse(() => extractPipeSequencing(node)),
            Nano.orElse(() => extractLayerExpression(node))
          )
        }),
        "layerMagic.apply.extractLayerArray",
        (node) => node
      )

    const adjustedNode = (node: ts.Node): ts.Node => {
      if (ts.isIdentifier(node) && ts.isVariableDeclaration(node.parent) && node.parent.initializer) {
        return adjustedNode(node.parent.initializer)
      }
      if (ts.isIdentifier(node) && ts.isPropertyDeclaration(node.parent) && node.parent.initializer) {
        return adjustedNode(node.parent.initializer)
      }
      return node
    }

    const computeAsAnyAsLayerRefactor: (
      node: ts.Node
    ) => Nano.Nano<
      LSP.ApplicableRefactorDefinition,
      TypeParser.TypeParserIssue,
      never
    > = (node: ts.Node) => {
      const atLocation = adjustedNode(node)
      return pipe(
        extractLayers(atLocation, false),
        Nano.flatMap((extractedLayer) =>
          extractedLayer.length <= 1 ? TypeParser.TypeParserIssue.issue : Nano.succeed(extractedLayer)
        ),
        Nano.map((extractedLayers) => ({
          kind: "refactor.rewrite.effect.layerMagicPrepare",
          description: "Prepare layers for automatic composition",
          apply: pipe(
            Nano.gen(function*() {
              const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

              const memory = new Map<string, ts.Type>()
              for (const layer of extractedLayers) {
                yield* typeCheckerUtils.appendToUniqueTypesMap(
                  memory,
                  layer.ROut,
                  (_) => Nano.succeed((_.flags & ts.TypeFlags.Never) !== 0)
                )
              }

              const previouslyProvided = yield* pipe(
                typeParser.layerType(typeChecker.getTypeAtLocation(atLocation), atLocation),
                Nano.map((_) => _.ROut),
                Nano.option
              )

              const [existingBefore, newlyIntroduced] = pipe(
                Array.fromIterable(memory.values()),
                Array.sort(typeCheckerUtils.deterministicTypeOrder),
                Array.partition((_) =>
                  Option.isNone(previouslyProvided) || typeChecker.isTypeAssignableTo(_, previouslyProvided.value)
                )
              )

              const typeReferences = pipe(
                newlyIntroduced,
                Array.map((_) => typeChecker.typeToTypeNode(_, undefined, ts.NodeBuilderFlags.NoTruncation)),
                Array.filter((_) => !!_)
              )

              const providesUnion = typeReferences.length === 0
                ? ts.factory.createTypeReferenceNode("never")
                : ts.factory.createUnionTypeNode(typeReferences)

              const typeStrings = pipe(
                existingBefore,
                Array.map((_) => typeChecker.typeToString(_, undefined, ts.TypeFormatFlags.NoTruncation)),
                Array.filter((_) => !!_)
              )

              const unionWithComment = typeStrings.length === 0
                ? providesUnion
                : ts.addSyntheticTrailingComment(
                  providesUnion,
                  ts.SyntaxKind.MultiLineCommentTrivia,
                  " " + typeStrings.join(" | ") + " ",
                  false
                )

              const newDeclaration = ts.factory.createAsExpression(
                ts.factory.createAsExpression(
                  ts.factory.createArrayLiteralExpression(extractedLayers.map((_) => _.node)),
                  ts.factory.createTypeReferenceNode("any")
                ),
                ts.factory.createTypeReferenceNode(
                  ts.factory.createQualifiedName(ts.factory.createIdentifier(layerIdentifier), "Layer"),
                  [unionWithComment]
                )
              )

              changeTracker.replaceNode(sourceFile, atLocation, newDeclaration, {
                leadingTriviaOption: ts.textChanges.LeadingTriviaOption.IncludeAll,
                trailingTriviaOption: ts.textChanges.TrailingTriviaOption.Exclude
              })
            }),
            Nano.provideService(TypeScriptApi.TypeScriptApi, ts)
          )
        }))
      )
    }

    const parseAsAnyAsLayer: (
      node: ts.Node
    ) => Nano.Nano<
      LayerMagicExtractedLayer & { castedStructure: ts.Expression },
      TypeParser.TypeParserIssue,
      never
    > = (node: ts.Node) => {
      if (ts.isAsExpression(node) && ts.isTypeReferenceNode(node.type)) {
        const expression = node.expression
        if (
          ts.isAsExpression(expression) && expression.type.kind === ts.SyntaxKind.AnyKeyword
        ) {
          return pipe(
            typeParser.layerType(typeChecker.getTypeAtLocation(node.type), node.type),
            Nano.map((_) => ({ node, ..._, castedStructure: expression.expression }))
          )
        }
      }
      return TypeParser.TypeParserIssue.issue
    }

    const computeBuildRefactor: (
      node: ts.Node
    ) => Nano.Nano<
      LSP.ApplicableRefactorDefinition,
      TypeParser.TypeParserIssue,
      never
    > = (node: ts.Node) => {
      const atLocation = adjustedNode(node)
      return pipe(
        parseAsAnyAsLayer(atLocation),
        Nano.flatMap((_targetLayer) =>
          pipe(
            extractArrayLiteral(_targetLayer.castedStructure),
            Nano.orElse(() => extractLayers(_targetLayer.castedStructure, false)),
            Nano.flatMap((extractedLayer) =>
              extractedLayer.length <= 1 ? TypeParser.TypeParserIssue.issue : Nano.succeed(extractedLayer)
            ),
            Nano.map((extractedLayers) => ({
              kind: "refactor.rewrite.effect.layerMagicBuild",
              description: "Compose layers automatically with target output services",
              apply: Nano.gen(function*() {
                const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                const memory = new Map<string, ts.Type>()
                // what do the user wants as output?
                const { allIndexes: outputIndexes } = yield* typeCheckerUtils.appendToUniqueTypesMap(
                  memory,
                  _targetLayer.ROut,
                  (_) => Nano.succeed((_.flags & ts.TypeFlags.Never) !== 0)
                )

                // and then what does each layer provide/requires?
                const nodes: Record<string, DependencyNode> = {}
                for (let i = 0; i < extractedLayers.length; i++) {
                  const layer = extractedLayers[i]
                  const { allIndexes: providedIndexes } = yield* typeCheckerUtils.appendToUniqueTypesMap(
                    memory,
                    layer.ROut,
                    (_) => Nano.succeed((_.flags & ts.TypeFlags.Never) !== 0)
                  )
                  const { allIndexes: requiredIndexes } = yield* typeCheckerUtils.appendToUniqueTypesMap(
                    memory,
                    layer.RIn,
                    (_) => Nano.succeed((_.flags & ts.TypeFlags.Never) !== 0)
                  )
                  nodes[`node_${i}`] = {
                    provides: providedIndexes.filter((_) => requiredIndexes.indexOf(_) === -1), // only provide indexes that are not required
                    requires: requiredIndexes,
                    node: layer.node
                  }
                }

                // Sort dependencies with cycle detection
                const sortResult = sortDependencies(nodes)
                const sortedNodes = sortResult.sorted.reverse()

                // now traverse in the reverse order and determine what requires merge/provide or both
                const missingOutput = new Set<string>(outputIndexes)
                const missingInternal = new Set<string>()
                const outputEntry: Array<{ merges: boolean; provides: boolean; node: ts.Expression }> = []
                for (let i = 0; i < sortedNodes.length; i++) {
                  const graphNode = sortedNodes[i]
                  const mergeOutput = graphNode.provides.filter((_) => missingOutput.has(_))
                  const provideInternal = graphNode.provides.filter((_) => missingInternal.has(_))
                  graphNode.requires.forEach((_) => missingInternal.add(_))
                  mergeOutput.forEach((_) => missingOutput.delete(_))
                  outputEntry.push({
                    merges: mergeOutput.length > 0,
                    provides: provideInternal.length > 0,
                    node: graphNode.node
                  })
                }

                // Use sorted nodes for further processing
                const newDeclaration = ts.factory.createCallExpression(
                  ts.factory.createPropertyAccessExpression(
                    outputEntry[0]!.node,
                    "pipe"
                  ),
                  [],
                  outputEntry.slice(1).map((_) =>
                    ts.factory.createCallExpression(
                      ts.factory.createPropertyAccessExpression(
                        ts.factory.createIdentifier(layerIdentifier),
                        _.merges && _.provides ? "provideMerge" : _.merges ? "merge" : "provide"
                      ),
                      [],
                      [_.node]
                    )
                  )
                )

                const newDeclarationWithComment = missingOutput.size > 0
                  ? ts.addSyntheticTrailingComment(
                    newDeclaration,
                    ts.SyntaxKind.MultiLineCommentTrivia,
                    " Unable to find " + Array.fromIterable(missingOutput).map((key) => memory.get(key)!).map((_) =>
                      typeChecker.typeToString(_, undefined, ts.TypeFormatFlags.NoTruncation)
                    ).join(", ") + " in the provided layers. ",
                    false
                  ) :
                  newDeclaration

                changeTracker.replaceNode(sourceFile, atLocation, newDeclarationWithComment, {
                  leadingTriviaOption: ts.textChanges.LeadingTriviaOption.IncludeAll,
                  trailingTriviaOption: ts.textChanges.TrailingTriviaOption.Exclude
                })
              })
            }))
          )
        )
      )
    }

    const parentNodes = tsUtils.getAncestorNodesInRange(sourceFile, textRange)
    if (parentNodes.length === 0) return yield* Nano.fail(new LSP.RefactorNotApplicableError())

    return yield* pipe(
      Nano.firstSuccessOf(parentNodes.map(computeBuildRefactor)),
      Nano.orElse(() => Nano.firstSuccessOf(parentNodes.map(computeAsAnyAsLayerRefactor))),
      Nano.orElse(() => Nano.fail(new LSP.RefactorNotApplicableError()))
    )
  })
})
