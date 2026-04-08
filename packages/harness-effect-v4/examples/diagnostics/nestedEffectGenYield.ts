// @effect-diagnostics nestedEffectGenYield:warning
import { Effect } from "effect"

export const inEffectGen = Effect.gen(function*() {
  yield* Effect.gen(function*() {
    yield* Effect.succeed(1)
  })

  yield* Effect.gen(function*() {
    return 2
  }).pipe(Effect.asVoid)
})

export const inEffectFn = Effect.fn("inEffectFn")(function*() {
  yield* Effect.gen(function*() {
    yield* Effect.succeed(1)
  })
})

export const inEffectFnUntraced = Effect.fnUntraced(function*() {
  yield* Effect.gen(function*() {
    yield* Effect.succeed(1)
  })
})

export const nestedRegularFunction = Effect.gen(function*() {
  const deferred = () =>
    Effect.gen(function*() {
      yield* Effect.gen(function*() {
        yield* Effect.succeed(1)
      })
    })

  return deferred
})
