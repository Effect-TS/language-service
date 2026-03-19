// @effect-diagnostics *:off
// @effect-diagnostics missingReturnYieldStar:warning
import * as Effect from "effect/Effect"

export const preview = Effect.gen(function*() {
  yield* Effect.log("before")
  yield* Effect.fail("boom")
})
