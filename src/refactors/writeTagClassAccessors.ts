import { pipe } from "effect/Function"
import type * as ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const generate = Nano.fn("writeTagClassAccessors.generate")(function*(
  sourceFile: ts.SourceFile,
  service: ts.Type,
  className: ts.Identifier,
  atLocation: ts.ClassDeclaration,
  involvedMembers: Array<{ property: ts.Symbol; propertyType: ts.Type }>
) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
  const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
  const typeParser = yield* Nano.service(TypeParser.TypeParser)
  const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

  const insertLocation = atLocation.members.length > 0 ? atLocation.members[0].pos : atLocation.end - 1

  const effectIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
    sourceFile,
    "effect",
    "Effect"
  ) || "Effect"

  const createFunctionProperty = (
    className: ts.Identifier,
    propertyName: string,
    type: ts.TypeNode,
    forceAny: boolean
  ) => {
    const arrowBody = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier(effectIdentifier),
        "andThen"
      ),
      undefined,
      [
        ts.factory.createIdentifier(ts.idText(className)),
        ts.factory.createArrowFunction(
          undefined,
          undefined,
          [ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            "_",
            undefined,
            forceAny ? ts.factory.createTypeReferenceNode("any") : undefined
          )],
          undefined,
          undefined,
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier("_"),
              propertyName
            ),
            undefined,
            [
              ts.factory.createSpreadElement(ts.factory.createIdentifier("args"))
            ]
          )
        )
      ]
    )
    return ts.factory.createPropertyDeclaration(
      [
        ts.factory.createModifier(ts.SyntaxKind.StaticKeyword),
        ts.factory.createModifier(ts.SyntaxKind.OverrideKeyword)
      ],
      propertyName,
      undefined,
      type,
      ts.factory.createArrowFunction(
        undefined,
        undefined,
        [ts.factory.createParameterDeclaration(
          undefined,
          ts.factory.createToken(ts.SyntaxKind.DotDotDotToken),
          "args",
          undefined,
          forceAny ? ts.factory.createArrayTypeNode(ts.factory.createTypeReferenceNode("any")) : undefined
        )],
        undefined,
        undefined,
        forceAny ? ts.factory.createAsExpression(arrowBody, ts.factory.createTypeReferenceNode("any")) : arrowBody
      )
    )
  }

  const generateReturnType = (type: ts.Type, atLocation: ts.ClassDeclaration, className: ts.Identifier) =>
    pipe(
      typeParser.effectType(type, atLocation),
      Nano.flatMap((returnedEffect) => {
        // the type is an effect, so we just need to add the service type to the context type
        const contextType = (returnedEffect.R.flags & ts.TypeFlags.Never) ?
          ts.factory.createTypeReferenceNode(ts.idText(className)) :
          ts.factory.createUnionTypeNode(
            [
              ts.factory.createTypeReferenceNode(ts.idText(className)),
              typeChecker.typeToTypeNode(returnedEffect.R, atLocation, ts.NodeBuilderFlags.NoTruncation)!
            ]
          )

        const successType = typeChecker.typeToTypeNode(
          returnedEffect.A,
          atLocation,
          ts.NodeBuilderFlags.NoTruncation
        )
        if (!successType) return Nano.fail("error generating success type")

        const failureType = typeChecker.typeToTypeNode(
          returnedEffect.E,
          atLocation,
          ts.NodeBuilderFlags.NoTruncation
        )
        if (!failureType) return Nano.fail("error generating failure type")

        const typeNode = ts.factory.createTypeReferenceNode(
          ts.factory.createQualifiedName(
            ts.factory.createIdentifier(effectIdentifier),
            ts.factory.createIdentifier("Effect")
          ),
          [successType, failureType, contextType]
        )
        return Nano.succeed(typeNode)
      }),
      Nano.orElse(() =>
        pipe(
          typeParser.promiseLike(type, atLocation),
          Nano.flatMap(({ type }) => {
            const successType = typeChecker.typeToTypeNode(
              type,
              atLocation,
              ts.NodeBuilderFlags.NoTruncation
            )
            if (!successType) return Nano.fail("error generating success type")
            return Nano.succeed(ts.factory.createTypeReferenceNode(
              ts.factory.createQualifiedName(
                ts.factory.createIdentifier(effectIdentifier),
                ts.factory.createIdentifier("Effect")
              ),
              [
                successType,
                ts.factory.createTypeReferenceNode(
                  ts.factory.createQualifiedName(
                    ts.factory.createIdentifier("Cause"),
                    ts.factory.createIdentifier("UnknownException")
                  )
                ),
                ts.factory.createTypeReferenceNode(ts.idText(className))
              ]
            ))
          })
        )
      ),
      Nano.orElse(() => {
        // fallback to just converting A into a Effect<A, never, Service>
        const successType = typeChecker.typeToTypeNode(type, atLocation, ts.NodeBuilderFlags.NoTruncation)
        if (!successType) return Nano.fail("error generating success type")
        const typeNode = ts.factory.createTypeReferenceNode(
          ts.factory.createQualifiedName(
            ts.factory.createIdentifier(effectIdentifier),
            ts.factory.createIdentifier("Effect")
          ),
          [
            successType,
            ts.factory.createTypeReferenceNode("never"),
            ts.factory.createTypeReferenceNode(ts.idText(className))
          ]
        )

        return Nano.succeed(typeNode)
      })
    )

  const proxySignature = (signature: ts.Signature, atLocation: ts.ClassDeclaration, className: ts.Identifier) =>
    Nano.gen(function*() {
      // generate the signature
      const signatureDeclaration = typeChecker.signatureToSignatureDeclaration(
        signature,
        ts.SyntaxKind.FunctionType,
        atLocation,
        ts.NodeBuilderFlags.NoTruncation
      )

      if (!signatureDeclaration) return yield* Nano.fail("error generating signature")

      // wrap the return type as it would be in a Effect.andThen
      const returnType = yield* generateReturnType(
        typeChecker.getReturnTypeOfSignature(signature),
        atLocation,
        className
      )

      // construct the new signature
      return ts.factory.createFunctionTypeNode(
        signatureDeclaration.typeParameters,
        signatureDeclaration.parameters,
        returnType
      )
    })

  for (const { property, propertyType } of involvedMembers) {
    const callSignatures: Array<ts.FunctionTypeNode> = []
    let propertyDeclaration: ts.PropertyDeclaration | undefined = undefined
    for (const signature of typeChecker.getSignaturesOfType(propertyType, ts.SignatureKind.Call)) {
      yield* pipe(
        proxySignature(signature, atLocation, className),
        Nano.map((sig) => {
          callSignatures.push(sig)
        }),
        Nano.ignore
      )
    }
    // this is a call signature:
    // static method: <A>(value: A) => Effect<A, never, Service> = (value) => Effect.andThen(Service, _ => _.method(value))
    const allSignatures = ts.factory.createIntersectionTypeNode(callSignatures)
    const type = tsUtils.simplifyTypeNode(allSignatures)
    propertyDeclaration = createFunctionProperty(className, ts.symbolName(property), type, callSignatures.length > 1)

    // then we need to delete the old property (if present)
    const oldProperty = atLocation.members.filter(ts.isPropertyDeclaration).find((p) => {
      const symbol = typeChecker.getSymbolAtLocation(p.name)
      return symbol && ts.symbolName(symbol) === ts.symbolName(property)
    })
    if (oldProperty) {
      const start = ts.getTokenPosOfNode(oldProperty, sourceFile)
      changeTracker.deleteRange(sourceFile, {
        pos: start,
        end: oldProperty.end
      })
      changeTracker.insertNodeAt(sourceFile, start, propertyDeclaration)
    } else {
      changeTracker.insertNodeAt(sourceFile, insertLocation, propertyDeclaration, { suffix: "\n" })
    }
  }
})

export const parse = Nano.fn("writeTagClassAccessors.parse")(function*(node: ts.Node) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
  const typeParser = yield* Nano.service(TypeParser.TypeParser)
  const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

  // only applicable to class declarations
  if (!ts.isClassDeclaration(node)) return yield* Nano.fail("not a class declaration")

  const { Service, accessors, className, kind } = yield* pipe(
    Nano.map(typeParser.extendsEffectService(node), (_) => ({ kind: "effectService", ..._ })),
    Nano.orElse(() =>
      Nano.map(typeParser.extendsEffectTag(node), (_) => ({ kind: "effectTag", accessors: true, ..._ }))
    ),
    Nano.orElse(() => Nano.fail("not a class extending Effect.Service call"))
  )
  if (accessors !== true) return yield* Nano.fail("accessors are not enabled in the Effect.Service call")

  const involvedMembers: Array<{ property: ts.Symbol; propertyType: ts.Type }> = []

  const nonPrimitiveServices = typeCheckerUtils.unrollUnionMembers(Service).filter((_) =>
    !((_.flags & ts.TypeFlags.Number) || (_.flags & ts.TypeFlags.String) || (_.flags & ts.TypeFlags.Boolean) ||
      (_.flags & ts.TypeFlags.Literal))
  )

  if (nonPrimitiveServices.length === 0) return yield* Nano.fail("Service type is a primitive type")

  for (const serviceShape of nonPrimitiveServices) {
    for (const property of typeChecker.getPropertiesOfType(serviceShape)) {
      const propertyType = typeChecker.getTypeOfSymbolAtLocation(property, node)
      const callSignatures = typeChecker.getSignaturesOfType(propertyType, ts.SignatureKind.Call)
      if (callSignatures.length > 0) {
        const withTypeParameters = callSignatures.filter((_) => _.typeParameters && _.typeParameters.length > 0)
        if (callSignatures.length > 1 || withTypeParameters.length > 0) involvedMembers.push({ property, propertyType })
      }
    }
  }

  const hash = involvedMembers.map(({ property, propertyType }) => {
    return ts.symbolName(property) + ": " + typeChecker.typeToString(propertyType)
  }).concat([ts.idText(className)]).join("\n")

  return { Service, className, atLocation: node, hash: LSP.cyrb53(hash), involvedMembers, kind }
})

export const writeTagClassAccessors = LSP.createRefactor({
  name: "writeTagClassAccessors",
  description: "Implement accessors methods with generics or multiple signatures",
  apply: Nano.fn("writeTagClassAccessors.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const parseNode = (node: ts.Node) =>
      pipe(
        parse(node),
        Nano.map(({ Service, atLocation, className, involvedMembers }) => ({
          kind: "refactor.rewrite.effect.writeTagClassAccessors",
          description: "Implement Service accessors",
          apply: pipe(
            generate(sourceFile, Service, className, atLocation, involvedMembers),
            Nano.provideService(TypeScriptUtils.TypeScriptUtils, tsUtils),
            Nano.provideService(TypeParser.TypeParser, typeParser),
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker),
            Nano.provideService(TypeScriptApi.TypeScriptApi, ts)
          )
        }))
      )

    const parentNodes = tsUtils.getAncestorNodesInRange(sourceFile, textRange)

    return yield* pipe(
      Nano.firstSuccessOf(parentNodes.map(parseNode)),
      Nano.orElse(() => Nano.fail(new LSP.RefactorNotApplicableError()))
    )
  })
})
