import { pipe } from "effect/Function"
import type * as ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const effectServiceToClassWithLayer = LSP.createRefactor({
  name: "effectServiceToClassWithLayer",
  description: "Convert Effect.Service to Context.Tag with Layer",
  apply: Nano.fn("effectServiceToClassWithLayer.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    if (typeParser.supportedEffect() !== "v3") {
      return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    }

    // Find class declaration at cursor position
    const parentNodes = tsUtils.getAncestorNodesInRange(sourceFile, textRange)

    const findClassAtCursor = (node: ts.Node): Nano.Nano<
      ts.ClassDeclaration,
      LSP.RefactorNotApplicableError,
      never
    > => {
      // Check if node is a class keyword or identifier name of a class declaration
      if (ts.isClassDeclaration(node)) {
        return Nano.succeed(node)
      }
      if (node.parent && ts.isClassDeclaration(node.parent)) {
        if (node.kind === ts.SyntaxKind.ClassKeyword || (ts.isIdentifier(node) && node === node.parent.name)) {
          return Nano.succeed(node.parent)
        }
      }
      return Nano.fail(new LSP.RefactorNotApplicableError())
    }

    const classDeclaration = yield* pipe(
      Nano.firstSuccessOf(parentNodes.map(findClassAtCursor)),
      Nano.orElse(() => Nano.fail(new LSP.RefactorNotApplicableError()))
    )

    // Parse the class as Effect.Service
    const parsed = yield* pipe(
      typeParser.extendsEffectService(classDeclaration),
      Nano.orElse(() => Nano.fail(new LSP.RefactorNotApplicableError()))
    )

    const { className, keyStringLiteral, options } = parsed

    // Options must be an object literal with an `effect` property
    if (!options || !ts.isObjectLiteralExpression(options)) {
      return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    }

    type CombinatorKind = "effect" | "scoped" | "sync" | "succeed"
    let combinatorKind: CombinatorKind | undefined
    let combinatorInitializer: ts.Expression | undefined
    let dependencies: Array<ts.Expression> = []
    for (const property of options.properties) {
      if (
        ts.isPropertyAssignment(property) && property.name && ts.isIdentifier(property.name)
      ) {
        const name = ts.idText(property.name)
        if (name === "effect" || name === "scoped" || name === "sync" || name === "succeed") {
          combinatorKind = name
          combinatorInitializer = property.initializer
        }
        if (name === "dependencies" && ts.isArrayLiteralExpression(property.initializer)) {
          dependencies = Array.from(property.initializer.elements)
        }
      }
    }
    if (!combinatorKind || !combinatorInitializer) {
      return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    }

    return {
      kind: "refactor.rewrite.effect.effectServiceToClassWithLayer",
      description: "Convert Effect.Service to Context.Tag with Layer",
      apply: pipe(
        Nano.fn("effectServiceToClassWithLayer.apply.inner")(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

          // Resolve import identifiers
          const contextIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
            sourceFile,
            "effect",
            "Context"
          ) || "Context"

          const layerIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
            sourceFile,
            "effect",
            "Layer"
          ) || "Layer"

          // Build Layer.<combinator>(this, <body>) expression
          const buildLayerCall = (body: ts.Expression, dependencies: Array<ts.Expression>) => {
            const base = ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier(layerIdentifier),
                combinatorKind!
              ),
              undefined,
              [
                ts.factory.createThis(),
                body
              ]
            )
            if (dependencies.length === 0) return base
            return ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                base,
                "pipe"
              ),
              undefined,
              [
                ts.factory.createCallExpression(
                  ts.factory.createPropertyAccessExpression(
                    ts.factory.createIdentifier(layerIdentifier),
                    "provide"
                  ),
                  undefined,
                  [
                    ts.factory.createCallExpression(
                      ts.factory.createPropertyAccessExpression(
                        ts.factory.createIdentifier(layerIdentifier),
                        "mergeAll"
                      ),
                      undefined,
                      dependencies
                    )
                  ]
                )
              ]
            )
          }

          let shapeTypeNode: ts.TypeNode | undefined
          let layerExpression: ts.Expression

          if (combinatorKind === "succeed") {
            const succeedType = typeChecker.getTypeAtLocation(combinatorInitializer!)
            if (!succeedType) return
            shapeTypeNode = typeChecker.typeToTypeNode(
              succeedType,
              classDeclaration,
              ts.NodeBuilderFlags.NoTruncation
            )
            if (!shapeTypeNode) return
            layerExpression = buildLayerCall(combinatorInitializer!, dependencies)
          } else if (combinatorKind === "sync") {
            const syncType = typeChecker.getTypeAtLocation(combinatorInitializer!)
            const syncSignatures = typeChecker.getSignaturesOfType(syncType, ts.SignatureKind.Call)
            const shapeType = syncSignatures.length > 0
              ? typeChecker.getReturnTypeOfSignature(syncSignatures[0])
              : syncType
            shapeTypeNode = typeChecker.typeToTypeNode(
              shapeType,
              classDeclaration,
              ts.NodeBuilderFlags.NoTruncation
            )
            if (!shapeTypeNode) return
            layerExpression = buildLayerCall(combinatorInitializer!, dependencies)
          } else {
            // effect / scoped: use factory detection and effectType parsing
            const combinatorInitializerType = typeChecker.getTypeAtLocation(combinatorInitializer!)
            const callSignatures = typeChecker.getSignaturesOfType(combinatorInitializerType, ts.SignatureKind.Call)
            const isFactory = callSignatures.length > 0

            const effectResultType = isFactory
              ? typeChecker.getReturnTypeOfSignature(callSignatures[0])
              : combinatorInitializerType

            const parsedEffect = yield* pipe(
              typeParser.effectType(effectResultType, classDeclaration),
              Nano.orUndefined
            )
            if (!parsedEffect) return
            shapeTypeNode = typeChecker.typeToTypeNode(
              parsedEffect.A,
              classDeclaration,
              ts.NodeBuilderFlags.NoTruncation
            )
            if (!shapeTypeNode) return

            if (isFactory && ts.isArrowFunction(combinatorInitializer!)) {
              const fn = combinatorInitializer as ts.ArrowFunction
              const effectBody = ts.isBlock(fn.body) ? fn.body as unknown as ts.Expression : fn.body
              layerExpression = ts.factory.createArrowFunction(
                fn.modifiers,
                fn.typeParameters,
                fn.parameters,
                undefined,
                fn.equalsGreaterThanToken,
                buildLayerCall(effectBody, dependencies)
              )
            } else if (isFactory && ts.isFunctionExpression(combinatorInitializer!)) {
              const fn = combinatorInitializer as ts.FunctionExpression
              layerExpression = ts.factory.createArrowFunction(
                undefined,
                fn.typeParameters,
                fn.parameters,
                undefined,
                ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                buildLayerCall(fn.body as unknown as ts.Expression, dependencies)
              )
            } else if (isFactory) {
              return
            } else {
              layerExpression = buildLayerCall(combinatorInitializer!, dependencies)
            }
          }

          // Build static layer property
          const layerProperty = ts.factory.createPropertyDeclaration(
            [ts.factory.createModifier(ts.SyntaxKind.StaticKeyword)],
            "layer",
            undefined,
            undefined,
            layerExpression
          )

          // Build heritage clause: extends Context.Tag(<keyString>)<ClassName, ShapeType>()
          const keyArg = keyStringLiteral
            ? keyStringLiteral
            : ts.factory.createStringLiteral(ts.idText(className))

          // Inner: Context.Tag(<keyString>)
          const contextTagCall = ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier(contextIdentifier),
              "Tag"
            ),
            undefined,
            [keyArg]
          )

          // Outer call: Context.Tag(<keyString>)<ClassName, ShapeType>()
          const outerCall = ts.factory.createCallExpression(
            contextTagCall,
            [
              ts.factory.createTypeReferenceNode(ts.idText(className)),
              shapeTypeNode
            ],
            []
          )

          const heritageClause = ts.factory.createHeritageClause(
            ts.SyntaxKind.ExtendsKeyword,
            [ts.factory.createExpressionWithTypeArguments(outerCall, undefined)]
          )

          // Build new class declaration — recreate modifiers to strip leading trivia
          const freshModifiers = classDeclaration.modifiers?.map((m) =>
            ts.isModifier(m) ? ts.factory.createModifier(m.kind) : m
          )
          const newClassDeclaration = ts.factory.createClassDeclaration(
            freshModifiers,
            ts.idText(className),
            undefined,
            [heritageClause],
            [layerProperty]
          )

          changeTracker.replaceNode(sourceFile, classDeclaration, newClassDeclaration)
        })(),
        Nano.provideService(TypeScriptUtils.TypeScriptUtils, tsUtils),
        Nano.provideService(TypeParser.TypeParser, typeParser),
        Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker),
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts)
      )
    }
  })
})
