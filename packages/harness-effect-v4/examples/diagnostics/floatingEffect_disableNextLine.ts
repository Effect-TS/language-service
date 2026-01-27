import * as Effect from "effect/Effect"

Effect.succeed(true)
/** @effect-diagnostics-next-line floatingEffect:off */
Effect.succeed(42)
Effect.succeed(false)
// @effect-diagnostics-next-line floatingEffect:off
Effect.succeed(42)
