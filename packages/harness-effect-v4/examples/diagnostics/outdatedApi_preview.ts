// @effect-diagnostics *:off
// @effect-diagnostics outdatedApi:warning
import { Effect } from "effect"

export const preview = Effect.gen(function*() {
  // @ts-expect-error
  return yield* Effect.runtime()
})
