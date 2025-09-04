import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

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
        Nano.map((extractedLayers) => ({
          kind: "refactor.rewrite.effect.layerMagic",
          description: "Layer Magic: prepare",
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

              const typeReferences = pipe(
                Array.fromIterable(memory.values()),
                Array.sort(typeCheckerUtils.deterministicTypeOrder),
                Array.map((_) => typeChecker.typeToTypeNode(_, undefined, ts.NodeBuilderFlags.NoTruncation)),
                Array.filter((_) => !!_)
              )

              const newDeclaration = ts.factory.createAsExpression(
                ts.factory.createAsExpression(
                  ts.factory.createArrayLiteralExpression(extractedLayers.map((_) => _.node)),
                  ts.factory.createTypeReferenceNode("any")
                ),
                ts.factory.createTypeReferenceNode(
                  ts.factory.createQualifiedName(ts.factory.createIdentifier(layerIdentifier), "Layer"),
                  typeReferences.length === 0 ?
                    [
                      ts.factory.createTypeReferenceNode("never")
                    ] :
                    [ts.factory.createUnionTypeNode(typeReferences)]
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
      LayerMagicExtractedLayer,
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
            Nano.map((_) => ({ node, ..._ }))
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
        Nano.flatMap((targetLayer) =>
          pipe(
            extractArrayLiteral(atLocation),
            Nano.orElse(() => extractLayers(atLocation, false)),
            Nano.map((extractedLayers) => ({
              kind: "refactor.rewrite.effect.layerMagic",
              description: "Layer Magic: build",
              apply: pipe(
                Nano.gen(function*() {
                  const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                  const nodes: Array<{ provides: Array<string>; requires: Array<string>; node: ts.Expression }> = []

                  const memory = new Map<string, ts.Type>()
                  for (const layer of extractedLayers) {
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
                    nodes.push({ provides: providedIndexes, requires: requiredIndexes, node: layer.node })
                  }

                  const type = typeChecker.typeToTypeNode(targetLayer.ROut, undefined, ts.NodeBuilderFlags.NoTruncation)

                  if (type) {
                    const newDeclaration = ts.factory.createAsExpression(
                      ts.factory.createNumericLiteral(1),
                      type
                    )

                    changeTracker.replaceNode(sourceFile, atLocation, newDeclaration, {
                      leadingTriviaOption: ts.textChanges.LeadingTriviaOption.IncludeAll,
                      trailingTriviaOption: ts.textChanges.TrailingTriviaOption.Exclude
                    })
                  }
                }),
                Nano.provideService(TypeScriptApi.TypeScriptApi, ts)
              )
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
