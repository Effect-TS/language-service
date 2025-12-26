import { pipe } from "effect"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const nonObjectEffectServiceType = LSP.createDiagnostic({
  name: "nonObjectEffectServiceType",
  code: 24,
  description: "Ensures Effect.Service types are objects, not primitives",
  severity: "error",
  apply: Nano.fn("nonObjectEffectServiceType.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    function isPrimitiveType(type: ts.Type): boolean {
      return typeCheckerUtils.unrollUnionMembers(type).some((type) =>
        !!(
          type.flags & ts.TypeFlags.String ||
          type.flags & ts.TypeFlags.Number ||
          type.flags & ts.TypeFlags.Boolean ||
          type.flags & ts.TypeFlags.StringLiteral ||
          type.flags & ts.TypeFlags.NumberLiteral ||
          type.flags & ts.TypeFlags.BooleanLiteral ||
          type.flags & ts.TypeFlags.Undefined ||
          type.flags & ts.TypeFlags.Null
        )
      )
    }

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!

      if (ts.isClassDeclaration(node) && node.name && node.heritageClauses) {
        const serviceResult = yield* pipe(
          typeParser.extendsEffectService(node),
          Nano.orElse(() => Nano.void_)
        )

        if (serviceResult && serviceResult.options && ts.isObjectLiteralExpression(serviceResult.options)) {
          const options = serviceResult.options

          for (const property of options.properties) {
            if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
              continue
            }

            const propertyName = ts.idText(property.name)
            const propertyValue = property.initializer

            const errorToReport = {
              location: property.name,
              messageText:
                "Effect.Service requires the service type to be an object {} and not a primitive type. \nConsider wrapping the value in an object, or manually using Context.Tag or Effect.Tag if you want to use a primitive instead.",
              fixes: []
            }

            if (propertyName === "succeed") {
              const valueType = typeChecker.getTypeAtLocation(propertyValue)
              if (isPrimitiveType(valueType)) {
                report(errorToReport)
              }
            } else if (propertyName === "sync") {
              const valueType = typeChecker.getTypeAtLocation(propertyValue)
              const signatures = typeChecker.getSignaturesOfType(valueType, ts.SignatureKind.Call)

              for (const signature of signatures) {
                const returnType = typeChecker.getReturnTypeOfSignature(signature)
                if (isPrimitiveType(returnType)) {
                  report(errorToReport)
                  break
                }
              }
            } else if (propertyName === "effect" || propertyName === "scoped") {
              const valueType = typeChecker.getTypeAtLocation(propertyValue)

              const effectResult = yield* pipe(
                typeParser.effectType(valueType, propertyValue),
                Nano.orElse(() => Nano.void_)
              )

              if (effectResult) {
                if (isPrimitiveType(effectResult.A)) {
                  report(errorToReport)
                  continue
                }
              } else {
                const signatures = typeChecker.getSignaturesOfType(valueType, ts.SignatureKind.Call)
                for (const signature of signatures) {
                  const returnType = typeChecker.getReturnTypeOfSignature(signature)

                  const effectReturnResult = yield* pipe(
                    typeParser.effectType(returnType, propertyValue),
                    Nano.orElse(() => Nano.void_)
                  )

                  if (effectReturnResult && isPrimitiveType(effectReturnResult.A)) {
                    report(errorToReport)
                    break
                  }
                }
              }
            }
          }
        }
      }

      ts.forEachChild(node, appendNodeToVisit)
    }
  })
})
