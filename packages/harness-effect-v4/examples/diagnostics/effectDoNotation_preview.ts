// @effect-diagnostics *:off
// @effect-diagnostics effectDoNotation:warning
import { Effect } from "effect"
import { pipe } from "effect/Function"

export const preview = pipe(
  Effect.Do,
  Effect.bind("a", () => Effect.succeed(1)),
  Effect.let("b", ({ a }) => a + 1),
  Effect.bind("c", ({ b }) => Effect.succeed(b.toString()))
)
