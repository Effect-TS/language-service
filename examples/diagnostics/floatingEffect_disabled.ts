/** @effect-diagnostics floatingEffect:warning */
import * as Effect from "effect/Effect"

Effect.succeed(1)

/** @effect-diagnostics floatingEffect:off */

Effect.succeed(1)

/** @effect-diagnostics floatingEffect:error */

Effect.succeed(1)

/** @effect-diagnostics floatingEffect:suggestion */

Effect.succeed(1)

