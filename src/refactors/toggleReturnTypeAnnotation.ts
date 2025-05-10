import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as AST from "../core/AST.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const toggleReturnTypeAnnotation = LSP.createRefactor({
  name: "effect/toggleReturnTypeAnnotation",
  description: "Toggle return type annotation",
  apply: Nano.fn("toggleReturnTypeAnnotation.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    const maybeNode = pipe(
      yield* AST.getAncestorNodesInRange(sourceFile, textRange),
      ReadonlyArray.filter((node) =>
        ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) || ts.isMethodDeclaration(node)
      ),
      ReadonlyArray.head
    )

    if (Option.isNone(maybeNode)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    const node = maybeNode.value

    if (node.type) {
      return ({
        kind: "refactor.rewrite.effect.toggleReturnTypeAnnotation",
        description: "Toggle return type annotation",
        apply: pipe(
          AST.removeReturnTypeAnnotation(sourceFile, node),
          Nano.provideService(TypeScriptApi.TypeScriptApi, ts)
        )
      })
    }

    const returnType = yield* Nano.option(TypeCheckerApi.getInferredReturnType(node))
    if (Option.isNone(returnType)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())

    const returnTypeNode = typeChecker.typeToTypeNode(
      returnType.value,
      node,
      ts.NodeBuilderFlags.NoTruncation
    )

    if (!returnTypeNode) return yield* Nano.fail(new LSP.RefactorNotApplicableError())

    return ({
      kind: "refactor.rewrite.effect.toggleReturnTypeAnnotation",
      description: "Toggle return type annotation",
      apply: pipe(
        AST.addReturnTypeAnnotation(
          sourceFile,
          node,
          yield* AST.simplifyTypeNode(returnTypeNode)
        ),
        Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker),
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts)
      )
    })
  })
})
