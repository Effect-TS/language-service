import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import { createRefactor } from "../definition.js"
import * as AST from "../utils/AST.js"

type ConvertibleDeclaration =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration

export const toggleReturnTypeAnnotation = createRefactor({
  name: "effect/toggleReturnTypeAnnotation",
  description: "Toggle return type annotation",
  apply: (ts, program) => (sourceFile, textRange) => {
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

    return pipe(
      AST.getNodesContainingRange(ts)(sourceFile, textRange),
      ReadonlyArray.filter(isConvertibleDeclaration),
      ReadonlyArray.head,
      Option.map(
        (node) => ({
          kind: "refactor.rewrite.effect.toggleReturnTypeAnnotation",
          description: "Toggle return type annotation",
          apply: (changeTracker) => {
            const typeChecker = program.getTypeChecker()

            if (node.type) {
              AST.removeReturnTypeAnnotation(ts, changeTracker)(sourceFile, node)
              return
            }

            const callableType = typeChecker.getTypeAtLocation(node)
            const returnTypes = callableType.getCallSignatures().map((s) => s.getReturnType())
            const returnTypeNodes = returnTypes.map((type) =>
              typeChecker.typeToTypeNode(type, node, ts.NodeBuilderFlags.NoTruncation)
            ).filter((node): node is ts.TypeNode => !!node)
            if (returnTypeNodes.length === 0) return
            const returnTypeNode = returnTypeNodes.length === 1 ?
              returnTypeNodes[0]! :
              ts.factory.createUnionTypeNode(returnTypeNodes)

            AST.addReturnTypeAnnotation(ts, changeTracker)(
              sourceFile,
              node,
              AST.simplifyTypeNode(ts)(returnTypeNode)
            )
          }
        })
      )
    )
  }
})
