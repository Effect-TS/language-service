import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const floatingEffect = LSP.createDiagnostic({
  name: "floatingEffect",
  code: 3,
  apply: Nano.fn("floatingEffect.apply")(function*(report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    return {
      [ts.SyntaxKind.ExpressionStatement]: (node) =>
        Nano.gen(function*() {
          // parent is either block or source file
          if (!(ts.isBlock(node.parent) || ts.isSourceFile(node.parent))) return
          const expression = node.expression
          // this.variable = Effect.succeed is a valid expression
          if (
            ts.isBinaryExpression(expression) && expression.operatorToken &&
            (expression.operatorToken.kind === ts.SyntaxKind.EqualsToken ||
              expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionEqualsToken ||
              expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
              expression.operatorToken.kind === ts.SyntaxKind.BarBarEqualsToken)
          ) return

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
              report({
                node,
                category: ts.DiagnosticCategory.Error,
                messageText: `Effect must be yielded or assigned to a variable.`,
                fixes: []
              })
            }
          }
        })
    }
  })
})
