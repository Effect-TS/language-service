import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const floatingEffect = LSP.createDiagnostic({
  name: "floatingEffect",
  code: 3,
  description: "Ensures Effects are yielded or assigned to variables, not left floating",
  severity: "error",
  apply: Nano.fn("floatingEffect.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    function isFloatingExpression(node: ts.Node): node is ts.ExpressionStatement {
      // should be an expression statement
      if (!ts.isExpressionStatement(node)) return false
      // parent is either block or source file
      if (!(ts.isBlock(node.parent) || ts.isSourceFile(node.parent))) return false
      const expression = node.expression
      // this.variable = Effect.succeed is a valid expression
      if (
        ts.isBinaryExpression(expression) && expression.operatorToken &&
        (expression.operatorToken.kind === ts.SyntaxKind.EqualsToken ||
          expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionEqualsToken ||
          expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
          expression.operatorToken.kind === ts.SyntaxKind.BarBarEqualsToken)
      ) return false
      return true
    }

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
      const effect = yield* Nano.option(typeParser.effectType(type, node.expression))
      if (Option.isSome(effect)) {
        // and not a fiber (we consider that a valid operation)
        const allowedFloatingEffects = yield* pipe(
          typeParser.fiberType(type, node.expression),
          Nano.orElse(() => typeParser.effectSubtype(type, node.expression)),
          Nano.option
        )
        if (Option.isNone(allowedFloatingEffects)) {
          // check if strictly an effect or a subtype to change the error message
          const isStrictEffect = yield* Nano.option(typeParser.strictEffectType(type, node.expression))
          const name = Option.isSome(isStrictEffect) ? "Effect" : "Effect-able " + typeChecker.typeToString(type)
          report({
            location: node,
            messageText: `${name} must be yielded or assigned to a variable.`,
            fixes: []
          })
        }
      }
    }
  })
})
