import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import { createRefactor } from "../definition.js"
import * as AST from "../utils/AST.js"

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
export const removeUnnecessaryEffectGen = createRefactor({
  name: "effect/removeUnnecessaryEffectGen",
  description: "Remove unnecessary Effect.gen",
  apply: (_, program) => (sourceFile, textRange) => {
    const typeChecker = program.getTypeChecker()
    return pipe(
      AST.collectDescendantsAndAncestorsInRange(sourceFile, textRange),
      ReadonlyArray.findFirst((node) =>
        Option.gen(function*() {
          const returnedYieldedEffect = yield* AST.getSingleReturnEffectFromEffectGen(
            typeChecker,
            node
          )
          return { nodeToReplace: node, returnedYieldedEffect }
        })
      ),
      Option.map((a) => ({
        kind: "refactor.rewrite.effect.removeUnnecessaryEffectGen",
        description: "Remove unnecessary Effect.gen",
        apply: (changeTracker) => {
          changeTracker.replaceNode(sourceFile, a.nodeToReplace, a.returnedYieldedEffect)
        }
      }))
    )
  }
})
