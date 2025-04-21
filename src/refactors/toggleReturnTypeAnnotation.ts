import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import { createRefactor, RefactorNotApplicableError } from "../definition.js"
import * as AST from "../utils/AST.js"
import * as Nano from "../utils/Nano.js"
import * as TypeCheckerApi from "../utils/TypeCheckerApi.js"
import * as TypeScriptApi from "../utils/TypeScriptApi.js"

export const toggleReturnTypeAnnotation = createRefactor({
  name: "effect/toggleReturnTypeAnnotation",
  description: "Toggle return type annotation",
  apply: (sourceFile, textRange) =>
    Nano.gen(function*() {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
      const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

      const maybeNode = pipe(
        AST.getAncestorNodesInRange(ts)(sourceFile, textRange),
        ReadonlyArray.filter((node) =>
          ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) ||
          ts.isArrowFunction(node) || ts.isMethodDeclaration(node)
        ),
        ReadonlyArray.head
      )

      if (Option.isNone(maybeNode)) return yield* Nano.fail(new RefactorNotApplicableError())
      const node = maybeNode.value

      if (node.type) {
        return ({
          kind: "refactor.rewrite.effect.toggleReturnTypeAnnotation",
          description: "Toggle return type annotation",
          apply: Nano.gen(function*() {
            const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
            AST.removeReturnTypeAnnotation(ts, changeTracker)(sourceFile, node)
          })
        })
      }

      const returnType = yield* Nano.option(TypeCheckerApi.getInferredReturnType(node))
      if (Option.isNone(returnType)) return yield* Nano.fail(new RefactorNotApplicableError())

      const returnTypeNode = typeChecker.typeToTypeNode(
        returnType.value,
        node,
        ts.NodeBuilderFlags.NoTruncation
      )

      if (!returnTypeNode) return yield* Nano.fail(new RefactorNotApplicableError())

      return ({
        kind: "refactor.rewrite.effect.toggleReturnTypeAnnotation",
        description: "Toggle return type annotation",
        apply: Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

          AST.addReturnTypeAnnotation(ts, changeTracker)(
            sourceFile,
            node,
            AST.simplifyTypeNode(ts)(returnTypeNode)
          )
        })
      })
    })
})
