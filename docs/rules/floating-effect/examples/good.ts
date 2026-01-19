import * as Effect from "effect/Effect"

// Good: Effect assigned to a variable
const stored = Effect.succeed(1)

// Good: Effect is yielded inside Effect.gen
const program = Effect.gen(function* () {
  yield* Effect.log("Starting operation")
  const result = yield* Effect.succeed(42)
  return result
})

// Good: Effect is run
Effect.runPromise(Effect.succeed("runs now"))

// Good: Effect is returned from a function
function createEffect() {
  return Effect.succeed("this is fine")
}

// Good: Forked effects return a Fiber (allowed to float)
Effect.runPromise(
  Effect.gen(function* () {
    yield* Effect.succeed(1).pipe(Effect.fork)
    // ^- Returns a Fiber, intentionally floating
  })
)

// Good: Assignment via this.property
class MyClass {
  boot: Effect.Effect<void> = Effect.void

  constructor() {
    this.boot = Effect.log("Initializing")
  }
}
