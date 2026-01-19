import { Effect } from "effect"

// Helper functions for demonstration
const addOne = (n: number) => Effect.succeed(n + 1)
const double = (e: Effect.Effect<number>) => Effect.map(e, (n) => n * 2)
const triple = (e: Effect.Effect<number>) => Effect.map(e, (n) => n * 3)
const toString = (e: Effect.Effect<number>) => Effect.map(e, (n) => String(n))

// Bad: Two-level nesting - hard to read
export const twoLevels = double(addOne(5))

// Bad: Three-level nesting - even harder to read
export const threeLevels = toString(double(addOne(10)))

// Bad: Four-level nesting - very confusing
export const fourLevels = toString(triple(double(addOne(7))))

// Bad: Nested runPromise call
export const nestedRun = Effect.runPromise(Effect.log("Hello"))
