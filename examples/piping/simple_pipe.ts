import { pipe } from "effect/Function"
import * as Effect from "effect/Effect"

// Simple pipe call with multiple arguments
const result1 = pipe(
  Effect.succeed(1),
  Effect.map((n) => n + 1),
  Effect.flatMap((n) => Effect.succeed(n * 2))
)

// Simple pipeable style
const result2 = Effect.succeed(1).pipe(
  Effect.map((n) => n + 1),
  Effect.flatMap((n) => Effect.succeed(n * 2))
)
