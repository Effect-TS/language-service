import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"

// Good: No pipe when no transformations needed
export const noUnnecessaryPipe = Effect.succeed(32)

// Good: Direct value when no transformations
export const directValue = 32

// Good: .pipe() with actual transformations
export const withTransformations = Effect.succeed("Hello").pipe(
  Effect.map((x) => x + " World")
)

// Good: pipe() with multiple arguments
export const pipeWithArgs = pipe(
  Effect.succeed("Hello"),
  Effect.map((x) => x + " World"),
  Effect.tap((x) => Effect.log(x))
)

// Good: Properly using pipe in Effect.gen
export const properGen = Effect.gen(function* () {
  const result = yield* Effect.succeed("hello").pipe(
    Effect.map((s) => s.toUpperCase())
  )
  return result
})
