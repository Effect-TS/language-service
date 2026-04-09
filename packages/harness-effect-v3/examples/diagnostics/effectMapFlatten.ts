import { Effect, pipe } from "effect"

// Should trigger: pipeable style
export const shouldTriggerPipeable = Effect.succeed(1).pipe(
  Effect.map((n) => Effect.succeed(n + 1)),
  Effect.flatten
)

// Should trigger: function pipe style
export const shouldTriggerPipe = pipe(
  Effect.succeed(1),
  Effect.map((n) => Effect.succeed(n + 1)),
  Effect.flatten
)

// Should trigger: preserve later steps in the flow
export const shouldTriggerLongerFlow = Effect.succeed(1).pipe(
  Effect.map((n) => Effect.succeed(n + 1)),
  Effect.flatten,
  Effect.map((n) => n * 2)
)

// Should NOT trigger: already using flatMap
export const shouldNotTriggerFlatMap = Effect.succeed(1).pipe(
  Effect.flatMap((n) => Effect.succeed(n + 1))
)

// Should NOT trigger: flatten is not immediately after map
export const shouldNotTriggerSeparated = Effect.succeed(1).pipe(
  Effect.map((n) => Effect.succeed(n + 1)),
  Effect.tap(() => Effect.void),
  Effect.flatten
)

// Should NOT trigger: no flatten step
export const shouldNotTriggerWithoutFlatten = Effect.succeed(1).pipe(
  Effect.map((n) => Effect.succeed(n + 1))
)
