import { pipe } from "effect/Function"
import type * as ts from "typescript"
import * as AST from "../core/AST.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const writeTagClassAccessors = LSP.createRefactor({
  name: "writeTagClassAccessors",
  description: "Implement Service accessors",
  apply: Nano.fn("writeTagClassAccessors.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const createConstantProperty = (className: ts.Identifier, propertyName: string, type: ts.TypeNode) =>
      ts.factory.createPropertyDeclaration(
        [ts.factory.createModifier(ts.SyntaxKind.StaticKeyword)],
        propertyName,
        undefined,
        type,
        ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(
            ts.factory.createIdentifier("Effect"),
            "andThen"
          ),
          undefined,
          [
            ts.factory.createIdentifier(className.text),
            ts.factory.createArrowFunction(
              undefined,
              undefined,
              [ts.factory.createParameterDeclaration(
                undefined,
                undefined,
                "_"
              )],
              undefined,
              undefined,
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier("_"),
                propertyName
              )
            )
          ]
        )
      )

    const createFunctionProperty = (
      className: ts.Identifier,
      propertyName: string,
      type: ts.TypeNode,
      forceAny: boolean
    ) => {
      const arrowBody = ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
          ts.factory.createIdentifier("Effect"),
          "andThen"
        ),
        undefined,
        [
          ts.factory.createIdentifier(className.text),
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
        [ts.factory.createModifier(ts.SyntaxKind.StaticKeyword)],
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
            ts.factory.createTypeReferenceNode(className.text) :
            ts.factory.createUnionTypeNode(
              [
                ts.factory.createTypeReferenceNode(className.text),
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
              ts.factory.createIdentifier("Effect"),
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
                  ts.factory.createIdentifier("Effect"),
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
                  ts.factory.createTypeReferenceNode(className.text)
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
              ts.factory.createIdentifier("Effect"),
              ts.factory.createIdentifier("Effect")
            ),
            [
              successType,
              ts.factory.createTypeReferenceNode("never"),
              ts.factory.createTypeReferenceNode(className.text)
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
        const returnType = yield* generateReturnType(signature.getReturnType(), atLocation, className)

        // construct the new signature
        return ts.factory.createFunctionTypeNode(
          signatureDeclaration.typeParameters,
          signatureDeclaration.parameters,
          returnType
        )
      })

    const writeAccessors = Nano.fn("writeTagClassAccessors.writeAccessors")(
      function*(service: ts.Type, className: ts.Identifier, atLocation: ts.ClassDeclaration) {
        const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
        const insertLocation = atLocation.members.length > 0 ? atLocation.members[0].pos : atLocation.getEnd() - 1

        for (const property of typeChecker.getPropertiesOfType(service)) {
          const servicePropertyType = typeChecker.getTypeOfSymbolAtLocation(property, atLocation)
          const callSignatures: Array<ts.FunctionTypeNode> = []
          let propertyDeclaration: ts.PropertyDeclaration | undefined = undefined
          for (const signature of servicePropertyType.getCallSignatures()) {
            yield* pipe(
              proxySignature(signature, atLocation, className),
              Nano.map((sig) => {
                callSignatures.push(sig)
              }),
              Nano.ignore
            )
          }
          // based on the call signatures count, different approaches are used
          if (callSignatures.length === 0) {
            // this is a constant:
            // static property: Effect<number, never, Service> = Effect.andThen(Service, _ => _.property)
            yield* pipe(
              generateReturnType(servicePropertyType, atLocation, className),
              Nano.map((type) => {
                propertyDeclaration = createConstantProperty(className, property.getName(), type)
              }),
              Nano.ignore
            )
          } else {
            // this is a call signature:
            // static method: <A>(value: A) => Effect<A, never, Service> = (value) => Effect.andThen(Service, _ => _.method(value))
            const allSignatures = ts.factory.createIntersectionTypeNode(callSignatures)
            const type = yield* AST.simplifyTypeNode(allSignatures)
            propertyDeclaration = createFunctionProperty(className, property.getName(), type, callSignatures.length > 1)
          }

          // then we need to delete the old property (if present)
          if (propertyDeclaration) {
            const oldProperty = atLocation.members.filter(ts.isPropertyDeclaration).find((p) => {
              const symbol = typeChecker.getSymbolAtLocation(p.name)
              return symbol?.getName() === property.getName()
            })
            if (oldProperty) {
              changeTracker.deleteRange(sourceFile, {
                pos: oldProperty.getStart(sourceFile),
                end: oldProperty.getEnd()
              })
              changeTracker.insertNodeAt(sourceFile, oldProperty.getStart(sourceFile), propertyDeclaration)
            } else {
              changeTracker.insertNodeAt(sourceFile, insertLocation, propertyDeclaration, { suffix: "\n" })
            }
          }
        }
      }
    )

    const writeTagClassAccessors = (node: ts.Node) =>
      Nano.gen(function*() {
        // only applicable to class declarations
        if (!ts.isClassDeclaration(node)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())
        if (!node.name) return yield* Nano.fail(new LSP.RefactorNotApplicableError())
        // gets the type
        const classSym = typeChecker.getSymbolAtLocation(node.name)
        if (!classSym) return yield* Nano.fail(new LSP.RefactorNotApplicableError())
        const type = typeChecker.getTypeOfSymbol(classSym)
        // should be a tag
        const { Service } = yield* pipe(
          typeParser.contextTag(type, node),
          Nano.orElse(() => Nano.fail(new LSP.RefactorNotApplicableError()))
        )

        return ({
          kind: "refactor.rewrite.effect.writeTagClassAccessors",
          description: "Implement Service accessors",
          apply: pipe(
            writeAccessors(Service, node.name, node),
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker),
            Nano.provideService(TypeScriptApi.TypeScriptApi, ts)
          )
        })
      })

    const parentNodes = yield* AST.getAncestorNodesInRange(sourceFile, textRange)

    return yield* Nano.firstSuccessOf(parentNodes.map(writeTagClassAccessors))
  })
})
