import { createDiagnostic } from "@effect/language-service/diagnostics/definition"
import * as AST from "@effect/language-service/utils/AST"
import { pipe } from "@effect/language-service/utils/Function"
import * as Ch from "@effect/language-service/utils/ReadonlyArray"

export default createDiagnostic({
  code: 1003,
  category: "none",
  apply: (ts, program) =>
    (sourceFile) => {
      const typeChecker = program.getTypeChecker()

      function isEffectType(type: ts.Type) {
        const symbol = type.getSymbol()
        if (!symbol) return false
        if (symbol.declarations) {
          return symbol.declarations.some((declaration) =>
            declaration.getSourceFile().fileName.includes("@effect/io/Effect")
          )
        }
      }

      function isPipeableCombinator(type: ts.Type) {
        const signatures = type.getCallSignatures()
        if (signatures.length === 0) return false
        return signatures.some(isPipeableCallSignatureReturningEffect)
      }

      function isPipeableCallSignatureReturningEffect(signature: ts.Signature) {
        if (signature.getParameters().length !== 1) return false
        return isEffectType(signature.getReturnType())
      }

      function shouldBeTraced(signature: ts.Signature) {
        const returnType = signature.getReturnType()
        return isEffectType(returnType) || isPipeableCombinator(returnType)
      }

      function isGetCallTraceCallExpression(node: ts.Node): node is ts.CallExpression {
        if (!ts.isCallExpression(node)) return false
        const expression = node.expression
        if (!ts.isIdentifier(expression)) return false
        return expression.text === "getCallTrace"
      }

      return pipe(
        AST.collectAll(ts)(sourceFile, ts.isArrowFunction),
        Ch.concat(AST.collectAll(ts)(sourceFile, ts.isFunctionDeclaration)),
        Ch.filter((node) => !!node.body),
        Ch.filter((node) => typeChecker.getTypeAtLocation(node).getCallSignatures().some(shouldBeTraced)),
        Ch.filter((node) => {
          const body = node.body!
          if (!ts.isBlock(body)) return true
          const firstStatement = body.statements[0]
          if (!firstStatement) return true
          return Ch.isEmpty(AST.collectAll(ts)(firstStatement, isGetCallTraceCallExpression))
        }),
        Ch.map((node) => ({
          node,
          messageText: `This function should be traced. getCallTrace() should be the first line of the body.`
        }))
      )
    }
})
