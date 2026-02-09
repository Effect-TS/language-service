import * as Effect from "effect/Effect"

Effect.succeed(1) // should emit

/** @effect-diagnostics *:off */

Effect.succeed(1) // should be disabled

/** @effect-diagnostics floatingEffect:error */
Effect.succeed(1)

/** @effect-diagnostics *:off */
Effect.succeed(1) // should be disabled
