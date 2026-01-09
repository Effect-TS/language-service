import { pipe } from "effect/Function"
import * as Effect from "effect/Effect"

// Pipe with single value (no transformations)
const result1 = pipe(Effect.succeed(1))

// Pipeable with no args
const result2 = Effect.succeed(1).pipe()
