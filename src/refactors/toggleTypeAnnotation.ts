import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as AST from "../core/AST.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const toggleTypeAnnotation = LSP.createRefactor({
  name: "toggleTypeAnnotation",
  description: "Toggle type annotation",
  apply: Nano.fn("toggleTypeAnnotation.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    const maybeNode = pipe(
      yield* AST.getAncestorNodesInRange(sourceFile, textRange),
      ReadonlyArray.filter((node) => ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)),
      ReadonlyArray.filter((node) => AST.isNodeInRange(textRange)(node.name)),
      ReadonlyArray.filter((node) => !!node.initializer),
      ReadonlyArray.head
    )

    if (Option.isNone(maybeNode)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    const node = maybeNode.value

    return ({
      kind: "refactor.rewrite.effect.toggleTypeAnnotation",
      description: "Toggle type annotation",
      apply: pipe(
        Nano.gen(function*() {
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
              yield* AST.simplifyTypeNode(initializerTypeNode),
              {
                prefix: ": "
              }
            )
          }
        }),
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts)
      )
    })
  })
})
