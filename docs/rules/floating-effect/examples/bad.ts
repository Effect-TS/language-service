import * as Effect from "effect/Effect"

// Bad: Effect is created but never used
Effect.succeed("floating")

// Bad: Effect.never is floating
Effect.never

// Bad: Inside Effect.gen, forgetting to yield
Effect.runPromise(
  Effect.gen(function* () {
    const stored = Effect.succeed(1) // This is fine (assigned)
    Effect.never // Bad: forgot to yield*
  })
)

// Bad: Logging effect that never executes
function doSomething() {
  Effect.log("Starting operation") // This never runs!
  return Effect.succeed(42)
}
