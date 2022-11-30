import * as T from "@effect/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"
import { addReturnTypeAnnotation, removeReturnTypeAnnotation } from "@effect/language-service/utils"
import * as Ch from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"
import * as O from "@fp-ts/data/Option"
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
    T.gen(function*($) {
      const ts = yield* $(T.service(AST.TypeScriptApi))

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
        Ch.filter(isConvertibleDeclaration),
        Ch.head,
        O.map(
          (node) => ({
            description: "Toggle return type annotation",
            apply: T.gen(function*($) {
              const program = yield* $(T.service(AST.TypeScriptProgram))
              const typeChecker = program.getTypeChecker()
              const changeTracker = yield* $(T.service(AST.ChangeTrackerApi))

              if (node.type) {
                removeReturnTypeAnnotation(ts, changeTracker)(sourceFile, node)
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

              addReturnTypeAnnotation(ts, changeTracker)(sourceFile, node, returnTypeNode)
            })
          })
        )
      )
    })
})
