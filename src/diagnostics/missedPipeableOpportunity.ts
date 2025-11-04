import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const missedPipeableOpportunity = LSP.createDiagnostic({
  name: "missedPipeableOpportunity",
  code: 26,
  severity: "off",
  apply: Nano.fn("missedPipeableOpportunity.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const options = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)

    const nodeToVisit: Array<ts.Node> = [sourceFile]
    const prependNodeToVisit = (node: ts.Node) => {
      nodeToVisit.unshift(node)
      return undefined
    }

    const callChainNodes = new WeakMap<ts.Node, Array<ts.CallExpression>>()

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!

      if (ts.isCallExpression(node) && node.arguments.length === 1) {
        // ensure this is not a pipe call
        const isPipeCall = yield* pipe(typeParser.pipeCall(node), Nano.orElse(() => Nano.void_))
        if (!isPipeCall) {
          // resolved signature should not be callable
          const resolvedSignature = typeChecker.getResolvedSignature(node)
          if (resolvedSignature) {
            const returnType = typeChecker.getReturnTypeOfSignature(resolvedSignature)
            if (returnType) {
              const callSignatures = typeChecker.getSignaturesOfType(returnType, ts.SignatureKind.Call)
              if (callSignatures.length === 0) {
                // this node contributes to the chain.
                const parentChain = callChainNodes.get(node) || []
                callChainNodes.set(node.arguments[0], parentChain.concat(node))
              }
            }
          }
        }
      } else if (callChainNodes.has(node) && ts.isExpression(node)) {
        // we broke the chain.
        const parentChain: Array<ts.Expression> = (callChainNodes.get(node) || []).slice()
        const originalParentChain = parentChain.slice()
        while (parentChain.length > options.pipeableMinArgCount) {
          const subject = parentChain.pop()!
          const resultType = typeChecker.getTypeAtLocation(subject)
          const pipeableType = yield* pipe(typeParser.pipeableType(resultType, subject), Nano.orElse(() => Nano.void_))
          if (pipeableType) {
            report({
              location: parentChain[0],
              messageText: `Nested function calls can be converted to pipeable style for better readability.`,
              fixes: [{
                fixName: "missedPipeableOpportunity_fix",
                description: "Convert to pipe style",
                apply: Nano.gen(function*() {
                  const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                  // Create the new pipe call: innermostCall.pipe(c, b, a)
                  changeTracker.replaceNode(
                    sourceFile,
                    parentChain[0],
                    ts.factory.createCallExpression(
                      ts.factory.createPropertyAccessExpression(
                        subject,
                        "pipe"
                      ),
                      undefined,
                      pipe(
                        parentChain,
                        Array.filter(ts.isCallExpression),
                        Array.map((call) => call.expression),
                        Array.reverse
                      )
                    )
                  )
                })
              }]
            })
            // delete the parent chain nodes that were affected by the fix, so we don't report the same issue again.
            originalParentChain.forEach((node) => callChainNodes.delete(node))
            break
          }
        }
      }

      // we always visit the children
      ts.forEachChild(node, prependNodeToVisit)
    }
  })
})
