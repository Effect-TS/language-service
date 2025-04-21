// 4:22;6:22
import * as Effect from "effect/Effect"

export const test1 = Effect.succeed(42)

export const test2 = Effect.succeed(42).pipe(
    Effect.map((n) => n + 1), 
    Effect.map((n) => n - 1)
)
