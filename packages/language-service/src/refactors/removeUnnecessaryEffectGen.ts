import * as Option from "effect/Option"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

/**
 * Refactor to remove unnecessary `Effect.gen` calls.
 *
 * This refactor identifies `Effect.gen` calls that are redundant because they only wrap
 * a single `yield*` statement returning an `Effect`. In such cases, the `Effect.gen` wrapper
 * can be removed, and the inner `Effect` can be returned directly.
 *
 * The function works by analyzing the AST within the specified `textRange` to locate
 * `Effect.gen` calls. It checks if the body of the generator function contains only a single
 * `yield*` statement that directly returns an `Effect`. If such a pattern is found, the
 * `Effect.gen` wrapper is replaced with the inner `Effect`.
 *
 * @example
 * Input:
 * ```ts
 * const result = Effect.gen(function* () {
 *   return yield* Effect.succeed(42)
 * })
 * ```
 * Output:
 * ```ts
 * const result = Effect.succeed(42)
 * ```
 *
 * @param ts - The TypeScript API.
 * @param program - The TypeScript program instance, used for type checking.
 * @returns A refactor function that takes a `SourceFile` and a `TextRange`, analyzes the AST,
 *          and applies the refactor if applicable.
 */
export const removeUnnecessaryEffectGen = LSP.createRefactor({
  name: "removeUnnecessaryEffectGen",
  description: "Remove unnecessary Effect.gen",
  apply: Nano.fn("removeUnnecessaryEffectGen.apply")(function*(sourceFile, textRange) {
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    for (
      const nodeToReplace of tsUtils.getAncestorNodesInRange(sourceFile, textRange)
    ) {
      const maybeNode = yield* Nano.option(typeParser.unnecessaryEffectGen(nodeToReplace))

      if (Option.isNone(maybeNode)) continue
      const replacementNode = maybeNode.value.replacementNode

      return ({
        kind: "refactor.rewrite.effect.removeUnnecessaryEffectGen",
        description: "Remove unnecessary Effect.gen",
        apply: Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
          changeTracker.replaceNode(sourceFile, nodeToReplace, yield* replacementNode)
        })
      })
    }

    return yield* Nano.fail(new LSP.RefactorNotApplicableError())
  })
})
