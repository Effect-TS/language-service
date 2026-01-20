// 4:24,8:24,12:24,18:24
import * as Effect from "effect/Effect"

export const test1 = Effect.gen(function*() {
  return yield* Effect.succeed(42)
})

export const test_ = Effect.gen(function*() {
  return yield* Effect.succeed(42)
})

export const test2 = Effect.gen(function*() {
  return yield* Effect.gen(function*() {
    return yield* Effect.succeed(42)
  })
})

export const test3 = Effect.succeed(42).pipe(
  Effect.andThen((a) =>
    Effect.gen(function*() {
      return yield* Effect.succeed(a)
    })
  )
)
