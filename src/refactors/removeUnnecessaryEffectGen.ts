import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import { createRefactor } from "../definition.js"
import * as AST from "../utils/AST.js"
import * as TypeParser from "../utils/TypeParser.js"

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
  apply: (ts, program) => (sourceFile, textRange) =>
    pipe(
      AST.collectDescendantsAndAncestorsInRange(sourceFile, textRange),
      ReadonlyArray.findFirst((node) =>
        Option.gen(function*() {
          const typeChecker = program.getTypeChecker()
          const effectGen = yield* TypeParser.effectGen(ts, typeChecker)(node)

          const body = effectGen.body
          if (
            body.statements.length === 1 &&
            ts.isReturnStatement(body.statements[0]) &&
            body.statements[0].expression &&
            ts.isYieldExpression(body.statements[0].expression) &&
            body.statements[0].expression.expression
          ) {
            // get the type of the node
            const nodeToCheck = body.statements[0].expression.expression
            const type = typeChecker.getTypeAtLocation(nodeToCheck)
            const maybeEffect = TypeParser.effectType(ts, typeChecker)(type, nodeToCheck)
            if (Option.isSome(maybeEffect)) {
              return yield* Option.some({
                nodeToReplace: effectGen.node,
                returnedYieldedEffect: nodeToCheck
              })
            }
          }
          return yield* Option.none()
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
})
