// @effect-diagnostics *:off
// @effect-diagnostics globalTimers:warning
import { Effect } from "effect"

export const preview = Effect.gen(function*() {
  setTimeout(() => {}, 100)
})
