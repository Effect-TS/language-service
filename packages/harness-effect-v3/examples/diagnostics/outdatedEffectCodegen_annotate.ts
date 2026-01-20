import * as Effect from "effect/Effect"

export const shouldNotAnnotate = Effect.succeed(42)

// @effect-codegens annotate
export const test = Effect.gen(function*() {
  if (Math.random() < 0.5) {
    return yield* Effect.fail("error")
  }
  return 1 as const
})
