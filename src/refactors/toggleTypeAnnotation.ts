import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"
import * as Ch from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"
import * as O from "@fp-ts/data/Option"

export default createRefactor({
  name: "effect/toggleTypeAnnotation",
  description: "Toggle type annotation",
  apply: (ts, program) =>
    (sourceFile, textRange) =>
      pipe(
        AST.getNodesContainingRange(ts)(sourceFile, textRange),
        Ch.filter(ts.isVariableDeclaration),
        Ch.filter((node) => AST.isNodeInRange(textRange)(node.name)),
        Ch.filter((node) => !!node.initializer),
        Ch.head,
        O.map(
          (node) => ({
            description: "Toggle type annotation",
            apply: (changeTracker) => {
              const typeChecker = program.getTypeChecker()

              if (node.type) {
                changeTracker.deleteRange(sourceFile, { pos: node.name.end, end: node.type.end })
                return
              }

              const initializer = node.initializer!
              const initializerType = typeChecker.getTypeAtLocation(initializer)
              const initializerTypeNode = typeChecker.typeToTypeNode(
                initializerType,
                node,
                ts.NodeBuilderFlags.NoTruncation
              )
              if (initializerTypeNode) {
                changeTracker.insertNodeAt(sourceFile, node.name.end, initializerTypeNode, { prefix: ": " })
              }
            }
          })
        )
      )
})
