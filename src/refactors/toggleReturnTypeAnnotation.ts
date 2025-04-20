import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import { createRefactor } from "../definition.js"
import * as AST from "../utils/AST.js"
import * as TypeCheckerApi from "../utils/TypeCheckerApi.js"

export const toggleReturnTypeAnnotation = createRefactor({
  name: "effect/toggleReturnTypeAnnotation",
  description: "Toggle return type annotation",
  apply: (ts, program) => (sourceFile, textRange) => {
    return Option.gen(function*() {
      const typeChecker = program.getTypeChecker()
      const node = yield* pipe(
        AST.getAncestorNodesInRange(ts)(sourceFile, textRange),
        ReadonlyArray.filter((node) =>
          ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) ||
          ts.isArrowFunction(node) || ts.isMethodDeclaration(node)
        ),
        ReadonlyArray.head
      )

      if (node.type) {
        return ({
          kind: "refactor.rewrite.effect.toggleReturnTypeAnnotation",
          description: "Toggle return type annotation",
          apply: (changeTracker) =>
            AST.removeReturnTypeAnnotation(ts, changeTracker)(sourceFile, node)
        })
      }

      const returnType = yield* TypeCheckerApi.getInferredReturnType(ts, typeChecker)(node)
      const returnTypeNode = yield* Option.fromNullable(
        typeChecker.typeToTypeNode(returnType, node, ts.NodeBuilderFlags.NoTruncation)
      )

      return ({
        kind: "refactor.rewrite.effect.toggleReturnTypeAnnotation",
        description: "Toggle return type annotation",
        apply: (changeTracker) => {
          AST.addReturnTypeAnnotation(ts, changeTracker)(
            sourceFile,
            node,
            AST.simplifyTypeNode(ts)(returnTypeNode)
          )
        }
      })
    })
  }
})
