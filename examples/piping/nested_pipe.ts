import { pipe } from "effect/Function"
import * as Effect from "effect/Effect"

// Nested pipe calls - inner pipeable in outer pipe
const result1 = pipe(
  Effect.succeed(1).pipe(Effect.map((n) => n + 1)),
  Effect.flatMap((n) => Effect.succeed(n * 2))
)

// Nested pipe calls - inner pipe in outer pipeable
const result2 = pipe(
  Effect.succeed(1),
  Effect.map((n) => n + 1)
).pipe(
  Effect.flatMap((n) => Effect.succeed(n * 2))
)

// Triple nesting
const result3 = pipe(
  Effect.succeed(1).pipe(Effect.map((n) => n + 1)).pipe(Effect.delay(1000)),
  Effect.flatMap((n) => Effect.succeed(n * 2))
)
