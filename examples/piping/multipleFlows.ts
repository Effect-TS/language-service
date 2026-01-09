import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"

// Multiple independent piping flows in one file
const flow1 = pipe(
  Effect.succeed(1),
  Effect.map((n) => n + 1)
)

const flow2 = Effect.succeed("hello").pipe(
  Effect.map((s) => s.toUpperCase())
)

// Flows used together
export const combined = pipe(
  Effect.all([flow1, flow2]),
  Effect.map(([n, s]) => `${s}: ${n}`)
)
