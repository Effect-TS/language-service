import * as T from "@effect/core/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"
import * as Ch from "@tsplus/stdlib/collections/Chunk"
import { pipe } from "@tsplus/stdlib/data/Function"
import * as O from "@tsplus/stdlib/data/Maybe"

export default createRefactor({
  name: "effect/toggleTypeAnnotation",
  description: "Toggle type annotation",
  apply: (sourceFile, textRange) =>
    T.gen(function*($) {
      const ts = yield* $(T.service(AST.TypeScriptApi))

      return pipe(
        AST.getNodesContainingRange(ts)(sourceFile, textRange),
        Ch.filter(ts.isVariableDeclaration),
        Ch.filter((node) => AST.isNodeInRange(textRange)(node.name)),
        Ch.filter((node) => !!node.initializer),
        Ch.head,
        O.map(
          (node) => ({
            description: "Toggle type annotation",
            apply: T.gen(function*($) {
              const program = yield* $(T.service(AST.TypeScriptProgram))
              const typeChecker = program.getTypeChecker()
              const changeTracker = yield* $(T.service(AST.ChangeTrackerApi))

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
            })
          })
        )
      )
    })
})
