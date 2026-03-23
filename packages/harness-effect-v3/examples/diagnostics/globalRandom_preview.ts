// @effect-diagnostics *:off
// @effect-diagnostics globalRandom:warning
import { Effect } from "effect"

export const preview = Effect.gen(function*() {
  const r = Math.random()
  return r
})
