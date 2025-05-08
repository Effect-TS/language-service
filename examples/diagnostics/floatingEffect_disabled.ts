/** @effect-diagnostics effect/floatingEffect:warning */
import * as Effect from "effect/Effect"

Effect.succeed(1)

/** @effect-diagnostics effect/floatingEffect:off */

Effect.succeed(1)

/** @effect-diagnostics effect/floatingEffect:error */

Effect.succeed(1)

/** @effect-diagnostics effect/floatingEffect:suggestion */

Effect.succeed(1)

