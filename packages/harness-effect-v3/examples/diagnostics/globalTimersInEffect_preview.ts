// @effect-diagnostics *:off
// @effect-diagnostics globalTimersInEffect:warning
import { Effect } from "effect"

export const preview = Effect.gen(function*() {
  setTimeout(() => {}, 100)
})
