// @effect-diagnostics *:off
// @effect-diagnostics runEffectInsideEffect:warning
import { Effect } from "effect"

export const preview = Effect.gen(function*() {
  const run = () => Effect.runSync(Effect.succeed(1))
  return run()
})
