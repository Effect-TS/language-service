// @effect-diagnostics *:off
// @effect-diagnostics globalDate:warning
import { Effect } from "effect"

export const preview = Effect.gen(function*() {
  const now = Date.now()
  return now
})
