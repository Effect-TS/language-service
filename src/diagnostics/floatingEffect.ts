import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import type { ApplicableDiagnosticDefinition } from "../definition.js"
import { createDiagnostic } from "../definition.js"
import * as Nano from "../utils/Nano.js"
import * as TypeCheckerApi from "../utils/TypeCheckerApi.js"
import * as TypeParser from "../utils/TypeParser.js"
import * as TypeScriptApi from "../utils/TypeScriptApi.js"

export const floatingEffect = createDiagnostic({
  code: 3,
  apply: (sourceFile) =>
    Nano.gen(function*() {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
      const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

      const effectDiagnostics: Array<ApplicableDiagnosticDefinition> = []

      function isFloatingExpression(node: ts.Node): node is ts.ExpressionStatement {
        // should be an expression statement
        if (!ts.isExpressionStatement(node)) return false
        // parent is either block or source file
        if (!(ts.isBlock(node.parent) || ts.isSourceFile(node.parent))) return false
        const expression = node.expression
        // this.variable = Effect.succeed is a valid expression
        if (
          ts.isBinaryExpression(expression) && expression.operatorToken &&
          expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
        ) return false
        return true
      }

      const visit = (node: ts.Node) => {
        if (isFloatingExpression(node)) {
          const type = typeChecker.getTypeAtLocation(node.expression)
          // if type is an effect
          const effect = TypeParser.effectType(ts, typeChecker)(type, node.expression)
          if (Option.isSome(effect)) {
            // and not a fiber (we consider that a valid operation)
            const allowedFloatingEffects = pipe(
              TypeParser.fiberType(ts, typeChecker)(type, node.expression),
              Option.orElse(() => TypeParser.effectSubtype(ts, typeChecker)(type, node.expression))
            )
            if (Option.isNone(allowedFloatingEffects)) {
              effectDiagnostics.push({
                node,
                category: ts.DiagnosticCategory.Error,
                messageText: `Effect must be yielded or assigned to a variable.`
              })
            }
          }
        }
        ts.forEachChild(node, visit)
      }
      ts.forEachChild(sourceFile, visit)

      return effectDiagnostics
    })
})
