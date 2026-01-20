import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"

// Pipe with single value (no transformations)
export const result1 = pipe(Effect.succeed(1))

// Pipeable with no args
export const result2 = Effect.succeed(1).pipe()
