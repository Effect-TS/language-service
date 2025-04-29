import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../utils/TypeCheckerApi.js"
import * as TypeParser from "../utils/TypeParser.js"
import * as TypeScriptApi from "../utils/TypeScriptApi.js"

export const floatingEffect = LSP.createDiagnostic({
  name: "effect/floatingEffect",
  code: 3,
  apply: Nano.fn("floatingEffect.apply")(function*(sourceFile) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

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

    const effectDiagnostics: Array<LSP.ApplicableDiagnosticDefinition> = []

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }

    ts.forEachChild(sourceFile, appendNodeToVisit)
    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      if (!isFloatingExpression(node)) continue

      const type = typeChecker.getTypeAtLocation(node.expression)
      // if type is an effect
      const effect = yield* Nano.option(TypeParser.effectType(type, node.expression))
      if (Option.isSome(effect)) {
        // and not a fiber (we consider that a valid operation)
        const allowedFloatingEffects = yield* pipe(
          TypeParser.fiberType(type, node.expression),
          Nano.orElse(() => TypeParser.effectSubtype(type, node.expression)),
          Nano.option
        )
        if (Option.isNone(allowedFloatingEffects)) {
          effectDiagnostics.push({
            node,
            category: ts.DiagnosticCategory.Error,
            messageText: `Effect must be yielded or assigned to a variable.`,
            fix: Option.none()
          })
        }
      }
    }

    return effectDiagnostics
  })
})
