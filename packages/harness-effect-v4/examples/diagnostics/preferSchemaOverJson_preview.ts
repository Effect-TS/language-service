// @effect-diagnostics *:off
// @effect-diagnostics preferSchemaOverJson:warning
import { Effect } from "effect"

export const preview = Effect.gen(function*() {
  const text = yield* Effect.succeed('{"ok":true}')
  return JSON.parse(text)
})
