import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as AST from "../utils/AST.js"
import * as TypeParser from "../utils/TypeParser.js"
import * as TypeScriptApi from "../utils/TypeScriptApi.js"

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
  name: "effect/removeUnnecessaryEffectGen",
  description: "Remove unnecessary Effect.gen",
  apply: (sourceFile, textRange) =>
    Nano.gen(function*() {
      for (
        const nodeToReplace of yield* AST.getAncestorNodesInRange(sourceFile, textRange)
      ) {
        const maybeNode = yield* pipe(
          TypeParser.effectGen(nodeToReplace),
          Nano.flatMap(({ body }) => TypeParser.returnYieldEffectBlock(body)),
          Nano.option
        )

        if (Option.isNone(maybeNode)) continue
        const returnedYieldedEffect = maybeNode.value

        return ({
          kind: "refactor.rewrite.effect.removeUnnecessaryEffectGen",
          description: "Remove unnecessary Effect.gen",
          apply: Nano.gen(function*() {
            const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
            changeTracker.replaceNode(sourceFile, nodeToReplace, returnedYieldedEffect)
          })
        })
      }

      return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    })
})
