import { pipe } from "effect/Function"
import * as O from "effect/Option"
import * as Ch from "effect/ReadonlyArray"
import { createRefactor } from "../definition.js"
import * as AST from "../utils/AST.js"

export const toggleTypeAnnotation = createRefactor({
  name: "effect/toggleTypeAnnotation",
  description: "Toggle type annotation",
  apply: (ts, program) => (sourceFile, textRange) =>
    pipe(
      AST.getNodesContainingRange(ts)(sourceFile, textRange),
      Ch.filter(ts.isVariableDeclaration),
      Ch.filter((node) => AST.isNodeInRange(textRange)(node.name)),
      Ch.filter((node) => !!node.initializer),
      Ch.head,
      O.map(
        (node) => ({
          kind: "refactor.rewrite.effect.toggleTypeAnnotation",
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
              changeTracker.insertNodeAt(
                sourceFile,
                node.name.end,
                AST.simplifyTypeNode(ts)(initializerTypeNode),
                {
                  prefix: ": "
                }
              )
            }
          }
        })
      )
    )
})
