import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const unknownInEffectCatch = LSP.createDiagnostic({
  name: "unknownInEffectCatch",
  code: 31,
  description: "Warns when catch callbacks return unknown instead of typed errors",
  severity: "warning",
  apply: Nano.fn("unknownInEffectCatch.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      // Check if this is a call expression
      if (ts.isCallExpression(node)) {
        const isEffectWithCatch = yield* pipe(
          typeParser.isNodeReferenceToEffectModuleApi("tryPromise")(node.expression),
          Nano.orElse(() => typeParser.isNodeReferenceToEffectModuleApi("try")(node.expression)),
          Nano.orElse(() => typeParser.isNodeReferenceToEffectModuleApi("tryMap")(node.expression)),
          Nano.orElse(() => typeParser.isNodeReferenceToEffectModuleApi("tryMapPromise")(node.expression)),
          Nano.orElse(() => Nano.void_)
        )

        if (isEffectWithCatch) {
          // Get the resolved signature of the call expression
          const signature = typeChecker.getResolvedSignature(node)
          if (signature) {
            // we get the object type
            const parameterType = typeChecker.getParameterType(signature, 0)
            for (const objectType of typeCheckerUtils.unrollUnionMembers(parameterType)) {
              // we get the catch symbol
              const catchFunctionSymbol = typeChecker.getPropertyOfType(objectType, "catch")
              if (catchFunctionSymbol) {
                // we get the catch function type
                const catchFunctionType = typeChecker.getTypeOfSymbolAtLocation(catchFunctionSymbol, node)
                const signatures = typeChecker.getSignaturesOfType(catchFunctionType, ts.SignatureKind.Call)
                if (signatures.length > 0) {
                  const returnType = typeChecker.getReturnTypeOfSignature(signatures[0])
                  if (returnType && (returnType.flags & ts.TypeFlags.Unknown || returnType.flags & ts.TypeFlags.Any)) {
                    const nodeText = sourceFile.text.substring(
                      ts.getTokenPosOfNode(node.expression, sourceFile),
                      node.expression.end
                    )

                    // Report diagnostic on the catch property
                    report({
                      location: node.expression,
                      messageText:
                        `The 'catch' callback in ${nodeText} returns 'unknown'. The catch callback should be used to provide typed errors.\nConsider wrapping unknown errors into Effect's Data.TaggedError for example, or narrow down the type to the specific error raised.`,
                      fixes: []
                    })
                  }
                }
              }
            }
          }
        }
      }
    }
  })
})
