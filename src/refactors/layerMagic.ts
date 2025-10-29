import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Graph from "effect/Graph"
import * as Option from "effect/Option"
import * as Order from "effect/Order"
import type ts from "typescript"
import * as LayerGraph from "../core/LayerGraph.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

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

    const adjustedNode = (node: ts.Node): ts.Node => {
      if (
        node.parent &&
        (ts.isVariableDeclaration(node.parent) || ts.isPropertyDeclaration(node.parent)) &&
        ts.isIdentifier(node) &&
        node.parent.initializer &&
        node.parent.name === node
      ) {
        return node.parent.initializer
      }
      return node
    }

    const computeAsAnyAsLayerRefactor = (node: ts.Node) => {
      const atLocation = adjustedNode(node)
      return pipe(
        LayerGraph.extractLayerGraph(atLocation, {
          arrayLiteralAsMerge: true,
          explodeOnlyLayerCalls: true
        }),
        Nano.flatMap(LayerGraph.extractOutlineGraph),
        Nano.flatMap((extractedLayer) =>
          Graph.nodeCount(extractedLayer) <= 1 ? TypeParser.TypeParserIssue.issue : Nano.succeed(extractedLayer)
        ),
        Nano.map((extractedLayers) => ({
          kind: "refactor.rewrite.effect.layerMagicPrepare",
          description: "Prepare layers for automatic composition",
          apply: pipe(
            Nano.gen(function*() {
              const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

              const layerOutputTypes = new Set<ts.Type>()
              for (const layer of Graph.values(Graph.nodes(extractedLayers))) {
                layer.provides.forEach((_) => layerOutputTypes.add(_))
              }
              const layerNodes = pipe(
                Graph.values(Graph.nodes(extractedLayers)),
                Array.fromIterable,
                Array.map((_) => _.node),
                Array.filter(ts.isExpression),
                Array.sort(Order.mapInput(
                  Order.number,
                  (_: ts.Node) => _.pos
                ))
              )

              const previouslyProvided = yield* pipe(
                typeParser.layerType(typeChecker.getTypeAtLocation(atLocation), atLocation),
                Nano.map((_) => _.ROut),
                Nano.option
              )

              const [existingBefore, newlyIntroduced] = pipe(
                Array.fromIterable(layerOutputTypes),
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
                  ts.factory.createArrayLiteralExpression(layerNodes),
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
      { castedStructure: ts.Expression; ROut: ts.Type },
      TypeParser.TypeParserIssue,
      never
    > = (node: ts.Node) => {
      if (ts.isAsExpression(node) && ts.isTypeReferenceNode(node.type)) {
        const expression = node.expression
        if (
          ts.isAsExpression(expression) && expression.type.kind === ts.SyntaxKind.AnyKeyword
        ) {
          const type = typeChecker.getTypeAtLocation(node.type)
          return pipe(
            typeParser.layerType(type, node.type),
            Nano.map((_) => ({ node, ..._, castedStructure: expression.expression }))
          )
        }
      }
      return TypeParser.TypeParserIssue.issue
    }

    const computeBuildRefactor = (node: ts.Node) => {
      const atLocation = adjustedNode(node)
      return pipe(
        parseAsAnyAsLayer(atLocation),
        Nano.flatMap((_targetLayer) =>
          pipe(
            LayerGraph.extractLayerGraph(_targetLayer.castedStructure, {
              arrayLiteralAsMerge: true,
              explodeOnlyLayerCalls: true
            }),
            Nano.flatMap(LayerGraph.extractOutlineGraph),
            Nano.flatMap((extractedLayer) =>
              Graph.nodeCount(extractedLayer) <= 1 ? TypeParser.TypeParserIssue.issue : Nano.succeed(extractedLayer)
            ),
            Nano.map((extractedLayers) => ({
              kind: "refactor.rewrite.effect.layerMagicBuild",
              description: "Compose layers automatically with target output services",
              apply: Nano.gen(function*() {
                const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                const { layerMagicNodes, missingOutputTypes } = yield* pipe(
                  LayerGraph.convertOutlineGraphToLayerMagic(
                    extractedLayers,
                    _targetLayer.ROut
                  ),
                  Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker),
                  Nano.provideService(TypeCheckerUtils.TypeCheckerUtils, typeCheckerUtils),
                  Nano.provideService(TypeScriptApi.TypeScriptApi, ts)
                )

                // Use sorted nodes for further processing
                const newDeclaration = ts.factory.createCallExpression(
                  ts.factory.createPropertyAccessExpression(
                    layerMagicNodes[0]!.layerExpression,
                    "pipe"
                  ),
                  [],
                  layerMagicNodes.slice(1).map((_) =>
                    ts.factory.createCallExpression(
                      ts.factory.createPropertyAccessExpression(
                        ts.factory.createIdentifier(layerIdentifier),
                        _.merges && _.provides ? "provideMerge" : _.merges ? "merge" : "provide"
                      ),
                      [],
                      [_.layerExpression]
                    )
                  )
                )

                const newDeclarationWithComment = missingOutputTypes.size > 0
                  ? ts.addSyntheticTrailingComment(
                    newDeclaration,
                    ts.SyntaxKind.MultiLineCommentTrivia,
                    " Unable to find " + Array.fromIterable(missingOutputTypes.values()).map((_) =>
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
