import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as AST from "../core/AST.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeParser from "../utils/TypeParser.js"

export const wrapWithEffectGen = LSP.createRefactor({
  name: "effect/wrapWithEffectGen",
  description: "Wrap with Effect.gen",
  apply: Nano.fn("wrapWithEffectGen.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    const findEffectToWrap = Nano.fn("wrapWithEffectGen.apply.findEffectToWrap")(
      function*(node: ts.Node) {
        if (!ts.isExpression(node)) return yield* Nano.fail("is not an expression")

        const parent = node.parent
        if (
          parent != null && ts.isVariableDeclaration(parent) && parent.initializer !== node
        ) return yield* Nano.fail("is LHS of variable declaration")

        const type = typeChecker.getTypeAtLocation(node)
        yield* TypeParser.effectType(type, node)

        return node
      }
    )

    const maybeNode = yield* pipe(
      yield* AST.getAncestorNodesInRange(sourceFile, textRange),
      ReadonlyArray.map(findEffectToWrap),
      Nano.firstSuccessOf,
      Nano.option
    )
    if (Option.isNone(maybeNode)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())

    return {
      kind: "refactor.rewrite.effect.wrapWithEffectGen",
      description: `Wrap with Effect.gen`,
      apply: pipe(
        Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

          const effectGen = yield* pipe(
            AST.createEffectGenCallExpressionWithBlock(
              yield* getEffectModuleIdentifierName(sourceFile),
              yield* AST.createReturnYieldStarStatement(maybeNode.value)
            )
          )

          changeTracker.replaceNode(sourceFile, maybeNode.value, effectGen)
        }),
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
        Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker)
      )
    }
  })
})

export const getEffectModuleIdentifierName = Nano.fn("getEffectModuleIdentifierName")(
  function*(sourceFile: ts.SourceFile) {
    return Option.match(
      yield* Nano.option(
        AST.findImportedModuleIdentifier(
          sourceFile,
          (node) =>
            pipe(
              TypeParser.importedEffectModule(node),
              Nano.option,
              Nano.map(Option.isSome)
            )
        )
      ),
      {
        onNone: () => "Effect",
        onSome: (node) => node.text
      }
    )
  }
)
