import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const catchUnfailableEffect = LSP.createDiagnostic({
  name: "catchUnfailableEffect",
  code: 2,
  severity: "suggestion",
  apply: Nano.fn("catchUnfailableEffect.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      // Check if this is a call expression (cold expression)
      if (ts.isCallExpression(node)) {
        // Check if the call expression references any of the catch functions
        const catchFunctions = ["catchAll", "catch", "catchIf", "catchSome", "catchTag", "catchTags"]
        const isCatchCall = yield* pipe(
          Nano.firstSuccessOf(
            catchFunctions.map((catchFn) => typeParser.isNodeReferenceToEffectModuleApi(catchFn)(node.expression))
          ),
          Nano.option
        )

        if (Option.isSome(isCatchCall)) {
          // Check if the parent is a pipe call
          const parent = node.parent
          if (parent && ts.isCallExpression(parent)) {
            const pipeCallResult = yield* pipe(
              typeParser.pipeCall(parent),
              Nano.option
            )

            if (Option.isSome(pipeCallResult)) {
              const { args, node: pipeCallNode, subject } = pipeCallResult.value

              // Find the index of this node in the pipe arguments
              const argIndex = args.findIndex((arg) => arg === node)

              if (argIndex !== -1) {
                let effectTypeToCheck: ts.Type | undefined

                // Get the effect type based on argument index
                if (argIndex === 0) {
                  // If argIndex is 0, get the type from the subject
                  effectTypeToCheck = typeChecker.getTypeAtLocation(subject)
                } else {
                  // If argIndex > 0, get the type from signature type arguments at argIndex
                  const signature = typeChecker.getResolvedSignature(pipeCallNode)
                  if (signature) {
                    const typeArguments = typeChecker.getTypeArgumentsForResolvedSignature(signature)
                    if (typeArguments && typeArguments.length > argIndex) {
                      effectTypeToCheck = typeArguments[argIndex]
                    }
                  }
                }

                // Check if the effect type has error type never
                if (effectTypeToCheck) {
                  const effectType = yield* pipe(
                    typeParser.effectType(effectTypeToCheck, node),
                    Nano.option
                  )

                  // Only report if we successfully parsed an effect type and E is never
                  if (Option.isSome(effectType)) {
                    const { E } = effectType.value

                    // Only report if E is exactly never
                    if (E.flags & ts.TypeFlags.Never) {
                      report({
                        location: node.expression,
                        messageText:
                          `Looks like the previous effect never fails, so probably this error handling will never be triggered.`,
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
    }
  })
})
