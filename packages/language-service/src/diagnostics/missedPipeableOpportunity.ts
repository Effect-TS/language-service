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
  description: "Enforces the use of pipeable style for nested function calls",
  severity: "off",
  apply: Nano.fn("missedPipeableOpportunity.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const options = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)

    /**
     * Checks if a callee expression is safe to use in a pipe without losing `this` context.
     * Safe cases:
     * - Identifiers pointing to standalone functions
     * - Call expressions (already evaluated)
     * - Property access on modules/namespaces (not instances)
     * - Arrow functions (no `this` binding)
     */
    const isSafelyPipeableCallee = (callee: ts.Expression): boolean => {
      // Call expressions are safe - they return a value
      if (ts.isCallExpression(callee)) {
        return true
      }

      // Arrow functions are safe - no `this` binding
      if (ts.isArrowFunction(callee)) {
        return true
      }

      // Function expressions are safe
      if (ts.isFunctionExpression(callee)) {
        return true
      }

      // Parenthesized expressions - check inner
      if (ts.isParenthesizedExpression(callee)) {
        return isSafelyPipeableCallee(callee.expression)
      }

      // Simple identifiers - check if it's a module/namespace or standalone function
      if (ts.isIdentifier(callee)) {
        const symbol = typeChecker.getSymbolAtLocation(callee)
        if (!symbol) return false
        // Module/namespace imports are safe
        if (symbol.flags & (ts.SymbolFlags.Module | ts.SymbolFlags.Namespace | ts.SymbolFlags.ValueModule)) {
          return true
        }
        // Check if the symbol's declaration is a function or variable (not a method)
        const declarations = symbol.declarations
        if (declarations && declarations.length > 0) {
          const decl = declarations[0]
          // Functions, variables, and imports are safe
          if (
            ts.isFunctionDeclaration(decl) ||
            ts.isVariableDeclaration(decl) ||
            ts.isImportSpecifier(decl) ||
            ts.isImportClause(decl) ||
            ts.isNamespaceImport(decl)
          ) {
            return true
          }
        }
        return false
      }

      // Property access - check if subject is a module/namespace
      if (ts.isPropertyAccessExpression(callee)) {
        const subject = callee.expression
        const symbol = typeChecker.getSymbolAtLocation(subject)
        if (!symbol) return false

        // Check if subject is a module/namespace
        if (symbol.flags & (ts.SymbolFlags.Module | ts.SymbolFlags.Namespace | ts.SymbolFlags.ValueModule)) {
          return true
        }

        // Check if the symbol's declaration indicates it's a module import
        const declarations = symbol.declarations
        if (declarations && declarations.length > 0) {
          const decl = declarations[0]
          if (
            ts.isNamespaceImport(decl) ||
            ts.isSourceFile(decl) ||
            ts.isModuleDeclaration(decl)
          ) {
            return true
          }
        }

        return false
      }

      return false
    }

    // Get all piping flows for the source file (excluding Effect.fn since it can't be reconstructed)
    const flows = yield* typeParser.pipingFlows(false)(sourceFile)

    for (const flow of flows) {
      // Skip flows with too few transformations
      if (flow.transformations.length < options.pipeableMinArgCount) {
        continue
      }

      // Skip if we produce a callable function in the end
      const finalType = flow.transformations[flow.transformations.length - 1].outType
      if (!finalType) {
        continue
      }
      const callSigs = typeChecker.getSignaturesOfType(finalType, ts.SignatureKind.Call)
      if (callSigs.length > 0) {
        continue
      }

      // Helper to check if a type at a given index is pipeable
      // Index 0 = subject, index > 0 = transformations[index - 1].outType
      const isPipeableAtIndex = function*(index: number) {
        if (index === 0) {
          const subjectType = flow.subject.outType
          if (!subjectType) return false
          const result = yield* pipe(
            typeParser.pipeableType(subjectType, flow.subject.node),
            Nano.option
          )
          return result._tag === "Some"
        } else {
          const t = flow.transformations[index - 1]
          if (!t.outType) return false
          const result = yield* pipe(
            typeParser.pipeableType(t.outType, flow.node),
            Nano.option
          )
          return result._tag === "Some"
        }
      }

      // Search for valid pipeable segments
      // A segment starts at a pipeable type and continues while callees are safely pipeable
      let searchStartIndex = 0

      while (searchStartIndex <= flow.transformations.length) {
        // Find the first pipeable type starting from searchStartIndex
        let firstPipeableIndex = -1

        for (let i = searchStartIndex; i <= flow.transformations.length; i++) {
          if (yield* isPipeableAtIndex(i)) {
            firstPipeableIndex = i
            break
          }
        }

        // If no pipeable type found, we're done with this flow
        if (firstPipeableIndex === -1) {
          break
        }

        // Collect transformations while their callees are safely pipeable
        const pipeableTransformations: Array<typeof flow.transformations[number]> = []

        for (let i = firstPipeableIndex; i < flow.transformations.length; i++) {
          const t = flow.transformations[i]
          // Check if this transformation's callee is safe to use in a pipe
          if (!isSafelyPipeableCallee(t.callee)) {
            // Hit an unsafe callee, stop collecting
            break
          }
          pipeableTransformations.push(t)
        }

        // Count "call" kind transformations
        const callKindCount = pipeableTransformations.filter((t) => t.kind === "call").length

        // If we have enough, report the diagnostic
        if (callKindCount >= options.pipeableMinArgCount) {
          // Calculate the end index of pipeable transformations
          const pipeableEndIndex = firstPipeableIndex + pipeableTransformations.length

          // Get the subject for the pipeable part (reconstructing the "before" portion if needed)
          const pipeableSubjectNode = firstPipeableIndex === 0
            ? flow.subject.node
            : typeParser.reconstructPipingFlow({
              subject: flow.subject,
              transformations: flow.transformations.slice(0, firstPipeableIndex)
            })

          // Get the remaining transformations after the pipeable range (the "after" portion)
          const afterTransformations = flow.transformations.slice(pipeableEndIndex)

          // Get the original source node for the pipeable subject by traversing from flow.node
          const getOriginalSubjectNode = (): ts.Expression | undefined => {
            if (firstPipeableIndex === 0) {
              return flow.subject.node
            }

            // Traverse from flow.node into arguments to find the node at the right depth
            // We need to go (transformations.length - firstPipeableIndex) levels deep
            let current: ts.Expression = flow.node
            for (let i = flow.transformations.length; i > firstPipeableIndex; i--) {
              const t = flow.transformations[i - 1]
              if (t.kind === "call" && ts.isCallExpression(current) && current.arguments.length > 0) {
                // For call transformations, the subject is the first argument
                current = current.arguments[0]
              } else {
                // For other kinds, we can't reliably traverse
                return undefined
              }
            }
            return current
          }

          const originalSubjectNode = getOriginalSubjectNode()
          const subjectText = originalSubjectNode ?
            sourceFile.text.slice(
              ts.getTokenPosOfNode(originalSubjectNode, sourceFile),
              originalSubjectNode.end
            ).trim() :
            ""

          report({
            location: flow.node,
            messageText:
              `Nested function calls can be converted to pipeable style for better readability; consider using ${subjectText}.pipe(...) instead.`,
            fixes: [{
              fixName: "missedPipeableOpportunity_fix",
              description: "Convert to pipe style",
              apply: Nano.gen(function*() {
                const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                // Build the pipe arguments from transformations
                const pipeArgs = pipeableTransformations.map((t) => {
                  if (t.args) {
                    // It's a function call like Effect.map((x) => x + 1)
                    return ts.factory.createCallExpression(
                      t.callee,
                      undefined,
                      t.args
                    )
                  } else {
                    // It's a constant like Effect.asVoid
                    return t.callee
                  }
                })

                // Create the pipe call: subject.pipe(...)
                const pipeNode = ts.factory.createCallExpression(
                  ts.factory.createPropertyAccessExpression(
                    pipeableSubjectNode,
                    "pipe"
                  ),
                  undefined,
                  pipeArgs
                )

                // Wrap the pipe call with the "after" transformations (if any)
                // This reconstructs the outer calls that weren't safe to include in the pipe
                const newNode = afterTransformations.length > 0
                  ? typeParser.reconstructPipingFlow({
                    subject: { node: pipeNode, outType: undefined },
                    transformations: afterTransformations
                  })
                  : pipeNode

                changeTracker.replaceNode(sourceFile, flow.node, newNode)
              })
            }]
          })

          // We found and reported a valid segment, move past it
          // (we don't want overlapping diagnostics for the same flow)
          break
        }

        // Not enough transformations accumulated, try starting from the next position
        // Move past the current firstPipeableIndex + accumulated transformations
        searchStartIndex = firstPipeableIndex + pipeableTransformations.length + 1
      }
    }
  })
})
