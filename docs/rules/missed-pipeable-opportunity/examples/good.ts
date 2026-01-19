import { Effect } from "effect"

// Helper functions for demonstration
const addOne = (n: number) => Effect.succeed(n + 1)
const double = Effect.map((n: number) => n * 2)
const triple = Effect.map((n: number) => n * 3)
const toString = Effect.map((n: number) => String(n))

// Good: Using pipe style - reads left to right
export const twoLevels = addOne(5).pipe(double)

// Good: Three transformations with pipe
export const threeLevels = addOne(10).pipe(double, toString)

// Good: Four transformations - still readable
export const fourLevels = addOne(7).pipe(double, triple, toString)

// Good: runPromise with pipe
export const pipeRun = Effect.log("Hello").pipe(Effect.runPromise)

// Good: Complex transformations are easy to follow
export const complexPipeline = addOne(1).pipe(
  double,
  Effect.flatMap((n) => Effect.succeed(n + 100)),
  triple,
  toString,
  Effect.tap((s) => Effect.log(`Result: ${s}`))
)
