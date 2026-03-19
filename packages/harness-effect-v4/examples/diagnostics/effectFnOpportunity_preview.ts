// @effect-diagnostics *:off
// @effect-diagnostics effectFnOpportunity:warning
// @test-config { "effectFn": ["no-span"] }
import * as Effect from "effect/Effect"

export const preview = () => Effect.gen(function*() {
  return yield* Effect.succeed(1)
})
