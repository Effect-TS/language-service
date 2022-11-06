import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"
import { addReturnTypeAnnotation } from "@effect/language-service/utils"
import type ts from "typescript/lib/tsserverlibrary"

type ConvertibleDeclaration =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration

export default createRefactor({
  name: "effect/toggleReturnTypeAnnotation",
  description: "Toggle return type annotation",
  apply: (sourceFile, textRange) =>
    Do($ => {
      const ts = $(Effect.service(AST.TypeScriptApi))

      function isConvertibleDeclaration(node: ts.Node): node is ConvertibleDeclaration {
        switch (node.kind) {
          case ts.SyntaxKind.FunctionDeclaration:
          case ts.SyntaxKind.FunctionExpression:
          case ts.SyntaxKind.ArrowFunction:
          case ts.SyntaxKind.MethodDeclaration:
            return true
          default:
            return false
        }
      }

      const nodes = AST.getNodesContainingRange(ts)(sourceFile, textRange)
      const convertibleDeclaration = nodes.filter(isConvertibleDeclaration).head

      return convertibleDeclaration.map(
        node => ({
          description: "Toggle return type annotation",
          apply: Do($ => {
            const program = $(Effect.service(AST.TypeScriptProgram))
            const typeChecker = program.getTypeChecker()
            const changeTracker = $(Effect.service(AST.ChangeTrackerApi))

            if (node.type) {
              changeTracker.delete(sourceFile, node.type)
              return
            }

            const callableType = typeChecker.getTypeAtLocation(node)
            const returnTypes = callableType.getCallSignatures().map(s => s.getReturnType())
            const returnTypeNodes = returnTypes.map(type =>
              typeChecker.typeToTypeNode(type, node, ts.NodeBuilderFlags.NoTruncation)
            ).filter((node): node is ts.TypeNode => !!node)
            if (returnTypeNodes.length === 0) return
            const returnTypeNode = returnTypeNodes.length === 1 ?
              returnTypeNodes[0]! :
              ts.factory.createUnionTypeNode(returnTypeNodes)

            addReturnTypeAnnotation(ts, changeTracker)(sourceFile, node, returnTypeNode)
          })
        })
      )
    })
})
