// @effect-diagnostics catchUnfailableEffect:warning
import { Effect } from "effect"

// Effect.fn with regular (non-generator) function
export const shouldReportEffectFnRegular = Effect.fn(
  () => Effect.succeed(42),
  Effect.catchAll(() => Effect.void)
) // <- should report here

export const shouldNotReportEffectFnRegular = Effect.fn(
  () => Effect.fail("error"),
  Effect.catchAll(() => Effect.succeed(42))
)

export const shouldReportEffectFnRegularTraced = Effect.fn("traced")(
  () => Effect.succeed(42),
  Effect.catchAll(() => Effect.void)
) // <- should report here
