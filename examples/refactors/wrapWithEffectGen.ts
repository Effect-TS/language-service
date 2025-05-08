// 5:22;7:22;9:22;9:22-12:1;14:22;15:5
import * as Effect from "effect/Effect"
import { pipe } from "effect"

export const test1 = Effect.succeed(42)

export const test3 = test1

export const test2 = Effect.succeed(42).pipe(
    Effect.map((n) => n + 1),
    Effect.map((n) => n - 1),
)

export const test4 = pipe(
    Effect.succeed(42),
    Effect.map((n) => n + 1),
    Effect.map((n) => n - 1),
)
