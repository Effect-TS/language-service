// @effect-diagnostics *:off
// @effect-diagnostics globalFetchInEffect:warning
import { Effect } from "effect"

export const preview = Effect.gen(function*() {
  return yield* Effect.promise(() => fetch("https://example.com"))
})
