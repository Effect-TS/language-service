// @effect-diagnostics *:off
// @effect-diagnostics globalInEffect:warning
import { Effect } from "effect"

export const preview = Effect.gen(function*() {
  const now = Date.now()
  console.log("hello")
  return now
})
