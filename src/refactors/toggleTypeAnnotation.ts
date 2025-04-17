import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import { createRefactor } from "../definition.js"
import * as AST from "../utils/AST.js"

export const toggleTypeAnnotation = createRefactor({
  name: "effect/toggleTypeAnnotation",
  description: "Toggle type annotation",
  apply: (ts, program) => (sourceFile, textRange) =>
    pipe(
      AST.getAncestorNodesInRange(ts)(sourceFile, textRange),
      ReadonlyArray.filter((node) =>
        ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)
      ),
      ReadonlyArray.filter((node) => AST.isNodeInRange(textRange)(node.name)),
      ReadonlyArray.filter((node) => !!node.initializer),
      ReadonlyArray.head,
      Option.map(
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
            const initializerTypeNode = Option.fromNullable(typeChecker.typeToTypeNode(
              initializerType,
              node,
              ts.NodeBuilderFlags.NoTruncation
            )).pipe(
              Option.orElse(() =>
                Option.fromNullable(typeChecker.typeToTypeNode(
                  initializerType,
                  undefined,
                  ts.NodeBuilderFlags.NoTruncation
                ))
              ),
              Option.getOrUndefined
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
