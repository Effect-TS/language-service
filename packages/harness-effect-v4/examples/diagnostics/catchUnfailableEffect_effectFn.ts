// @effect-diagnostics catchUnfailableEffect:warning
import { Effect } from "effect"

// Effect.fn with pipe transformations
export const shouldReportEffectFn = Effect.fn(function*() {
  return yield* Effect.succeed(42)
}, Effect.catch(() => Effect.void)) // <- should report here

export const shouldNotReportEffectFn = Effect.fn(function*() {
  return yield* Effect.fail("error")
}, Effect.catch(() => Effect.succeed(42)))

export const shouldReportEffectFnTraced = Effect.fn("traced")(function*() {
  return yield* Effect.succeed(42)
}, Effect.catch(() => Effect.void)) // <- should report here

export const shouldReportEffectFnUntraced = Effect.fnUntraced(function*() {
  return yield* Effect.succeed(42)
}, Effect.catch(() => Effect.void)) // <- should report here
