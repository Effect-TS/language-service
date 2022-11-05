import * as T from "@effect/core/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createDiagnostic } from "@effect/language-service/diagnostics/definition"

export default createDiagnostic({
  code: 1003,
  apply: (sourceFile) =>
    Do($ => {
      const ts = $(T.service(AST.TypeScriptApi))
      const program = $(T.service(AST.TypeScriptProgram))
      const typeChecker = program.getTypeChecker()

      function isEffectType(type: ts.Type) {
        const symbol = type.getSymbol()
        if (!symbol) return false
        return symbol.getDocumentationComment(typeChecker).some(i =>
          i.text.indexOf("Effects model resourceful interaction") > -1
        )
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

      const definitions = AST.collectAll(ts)(sourceFile, ts.isArrowFunction).concat(
        AST.collectAll(ts)(sourceFile, ts.isFunctionDeclaration)
      )

      return definitions.filter(node => !!node.body).filter(node =>
        typeChecker.getTypeAtLocation(node).getCallSignatures().some(shouldBeTraced)
      ).filter(node => {
        const body = node.body!
        if (!ts.isBlock(body)) return true
        const firstStatement = body.statements[0]
        if (!firstStatement) return true
        return AST.collectAll(ts)(firstStatement, isGetCallTraceCallExpression).isEmpty
      }).map((node) => ({
        node,
        category: ts.DiagnosticCategory.Warning,
        messageText: `This function should be traced. getCallTrace() should be the first line of the body.`
      }))
    })
})
