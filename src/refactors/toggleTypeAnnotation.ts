import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const toggleTypeAnnotation = LSP.createRefactor({
  name: "toggleTypeAnnotation",
  description: "Toggle type annotation",
  apply: Nano.fn("toggleTypeAnnotation.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    const maybeNode = pipe(
      tsUtils.getAncestorNodesInRange(sourceFile, textRange),
      Array.filter((node) => ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)),
      Array.filter((node) => tsUtils.isNodeInRange(textRange)(node.name)),
      Array.filter((node) => !!node.initializer),
      Array.head
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
          const enclosingNode = ts.findAncestor(node, (_) => tsUtils.isDeclarationKind(_.kind)) || sourceFile
          const initializerTypeNode = Option.fromNullable(typeCheckerUtils.typeToSimplifiedTypeNode(
            initializerType,
            enclosingNode,
            ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.IgnoreErrors
          )).pipe(
            Option.getOrUndefined
          )
          if (initializerTypeNode) {
            changeTracker.insertNodeAt(
              sourceFile,
              node.name.end,
              initializerTypeNode,
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
