import * as Option from "effect/Option"
import { createRefactor } from "../definition.js"
import * as AST from "../utils/AST.js"

/**
 * Refactor to wrap an `Effect` expression with `Effect.gen`.
 *
 * This refactor identifies an `Effect` expression at the specified position and wraps it
 * in an `Effect.gen` generator function. The original `Effect` expression is transformed
 * into a `yield*` statement within the generator function, and the resulting generator
 * function is returned as the new `Effect.gen` call.
 *
 * The function works by analyzing the AST within the specified `textRange` to locate
 * an `Effect` expression. It then constructs a new `Effect.gen` call that wraps the
 * original `Effect` expression, making it part of a generator function.
 *
 * @example
 * Input:
 * ```ts
 * const result = Effect.succeed(42)
 * ```
 * Output:
 * ```ts
 * const result = Effect.gen(function* () {
 *   return yield* Effect.succeed(42)
 * })
 * ```
 *
 * @param ts - The TypeScript API.
 * @param program - The TypeScript program instance, used for type checking.
 * @returns A refactor function that takes a `SourceFile` and a `TextRange`, analyzes the AST,
 *          and applies the refactor if applicable.
 */
export const wrapWithEffectGen = createRefactor({
  name: "effect/wrapWithEffectGen",
  description: "Wrap with Effect.gen",
  apply: (ts, program) => (sourceFile, textRange) => {
    return Option.gen(function*() {
      const [effectExpr] = yield* AST.findEffectExpressionAtPosition(
        sourceFile,
        program.getTypeChecker(),
        textRange.pos
      )
      const effectGen = AST.createEffectGenCallExpressionWithBlock(
        AST.getEffectModuleIdentifierName(ts, program, sourceFile),
        AST.createReturnYieldStarStatement(effectExpr)
      )
      return {
        kind: "refactor.rewrite.effect.wrapWithEffectGen",
        description: `Wrap with Effect.gen`,
        apply: (changeTracker) => {
          changeTracker.replaceNode(sourceFile, effectExpr, effectGen)
        }
      }
    })
  }
})
