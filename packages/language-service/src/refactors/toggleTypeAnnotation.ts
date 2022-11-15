import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"

export default createRefactor({
  name: "effect/toggleTypeAnnotation",
  description: "Toggle type annotation",
  apply: (sourceFile, textRange) =>
    Do($ => {
      const ts = $(Effect.service(AST.TypeScriptApi))

      const nodes = AST.getNodesContainingRange(ts)(sourceFile, textRange)
      const variableDeclaration = nodes.filter(ts.isVariableDeclaration).filter(node =>
        AST.isNodeInRange(textRange)(node.name)
      ).filter(node => !!node.initializer).head

      return variableDeclaration.map(
        node => ({
          description: "Toggle type annotation",
          apply: Do($ => {
            const program = $(Effect.service(AST.TypeScriptProgram))
            const typeChecker = program.getTypeChecker()
            const changeTracker = $(Effect.service(AST.ChangeTrackerApi))

            if (node.type) {
              changeTracker.deleteRange(sourceFile, { pos: node.type.pos - 2, end: node.type.end })
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
    })
})
