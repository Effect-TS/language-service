// @effect-diagnostics *:off
// @effect-diagnostics anyUnknownInErrorContext:warning
import { Effect } from "effect"

export const preview = Effect.gen(function*() {
  yield* Effect.services<unknown>()
  return yield* Effect.fail<any>("boom")
})
