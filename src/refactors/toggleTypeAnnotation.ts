import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import { createRefactor, RefactorNotApplicableError } from "../definition.js"
import * as AST from "../utils/AST.js"
import * as Nano from "../utils/Nano.js"
import * as TypeCheckerApi from "../utils/TypeCheckerApi.js"
import * as TypeScriptApi from "../utils/TypeScriptApi.js"

export const toggleTypeAnnotation = createRefactor({
  name: "effect/toggleTypeAnnotation",
  description: "Toggle type annotation",
  apply: (sourceFile, textRange) =>
    Nano.gen(function*() {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
      const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

      const maybeNode = pipe(
        AST.getAncestorNodesInRange(ts)(sourceFile, textRange),
        ReadonlyArray.filter((node) =>
          ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)
        ),
        ReadonlyArray.filter((node) => AST.isNodeInRange(textRange)(node.name)),
        ReadonlyArray.filter((node) => !!node.initializer),
        ReadonlyArray.head
      )

      if (Option.isNone(maybeNode)) return yield* Nano.fail(new RefactorNotApplicableError())
      const node = maybeNode.value

      return ({
        kind: "refactor.rewrite.effect.toggleTypeAnnotation",
        description: "Toggle type annotation",
        apply: Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

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
        })
      })
    })
})
