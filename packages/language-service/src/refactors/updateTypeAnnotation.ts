import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"

export default createRefactor({
  name: "effect/updateTypeAnnotation",
  description: "Update type annotation",
  apply: (sourceFile, textRange) =>
    Do($ => {
      const ts = $(Effect.service(AST.TypeScriptApi))

      const nodes = AST.getNodesContainingRange(ts)(sourceFile, textRange)
      const variableDeclaration = nodes.filter(ts.isVariableDeclaration).filter(node =>
        AST.isNodeInRange(textRange)(node.name)
      ).filter(node => !!node.initializer).head

      return variableDeclaration.map(
        node => ({
          description: "Update type annotation",
          apply: Do($ => {
            const program = $(Effect.service(AST.TypeScriptProgram))
            const typeChecker = program.getTypeChecker()
            const changeTracker = $(Effect.service(AST.ChangeTrackerApi))

            const initializer = node.initializer!
            const initializerType = typeChecker.getTypeAtLocation(initializer)
            const initializerTypeNode = typeChecker.typeToTypeNode(
              initializerType,
              node,
              ts.NodeBuilderFlags.NoTruncation
            )

            const newDeclaration = ts.factory.updateVariableDeclaration(
              node,
              node.name,
              node.exclamationToken,
              initializerTypeNode,
              initializer
            )

            changeTracker.replaceNode(sourceFile, node, newDeclaration)
          })
        })
      )
    })
})
