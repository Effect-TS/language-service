// @effect-diagnostics *:off
// @effect-diagnostics cryptoRandomUUIDInEffect:warning
import { Effect } from "effect"

export const preview = Effect.gen(function*() {
  return crypto.randomUUID()
})
