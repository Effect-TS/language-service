import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"

// Bad: .pipe() with no arguments - does nothing
export const emptyMethodPipe = Effect.succeed(32).pipe()

// Bad: pipe() with single argument - just returns the value
export const singleArgPipe = pipe(32)

// Bad: Likely forgot to add transformations
export const forgotTransformations = Effect.gen(function* () {
  const result = yield* Effect.succeed("hello").pipe()
  return result
})
