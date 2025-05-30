// 4:22,8:1,12:22,13:19,19:27
import * as Effect from "effect/Effect"

export const test1 = Effect.gen(function* () {
    return yield* Effect.succeed(42)
})

Effect.gen(function* () {
    return yield* Effect.succeed(42)
})

export const test2 = Effect.gen(function* () {
    return yield* Effect.gen(function* () {
        return yield* Effect.succeed(42)
    })
})

export const test3 = Effect.succeed(42).pipe(
    Effect.andThen((a) => Effect.gen(function* () {
        return yield* Effect.succeed(a)
    })),
)
