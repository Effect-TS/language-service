import * as Effect from "effect/Effect"

export const shouldTrigger = Effect.gen(function*() {
  const _result = yield* Effect.context<unknown>()
})

export const shouldTriggerAny = Effect.gen(function*() {
  const _result = yield* Effect.context<any>()
})

export const shouldNotTriggerGenerics = <T>() =>
  Effect.gen(function*() {
    const _result = yield* Effect.context<T>()
  })

export const shouldTriggerAnyWithCast = Effect.gen(function*() {
  const _result = yield* Effect.context<any>()
}) as Effect.Effect<void>

export const shouldTriggerTypeNodes = <X extends Effect.Effect<any, any, any>>(_x: X) => Effect.void

export const shouldTriggerAnyWithCast2: Effect.Effect<void, never, never> = Effect.gen(function*() {
  const _result = yield* Effect.context<any>()
})
