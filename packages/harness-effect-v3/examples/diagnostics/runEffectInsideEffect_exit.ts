import { Effect } from "effect"

const child = Effect.succeed(1)

export const sameScope = Effect.gen(function*() {
  Effect.runSync(child)
  Effect.runSyncExit(child)
  yield* Effect.void
})

export const nested = Effect.gen(function*() {
  yield* Effect.void
  setTimeout(() => {
    Effect.runPromise(child)
    Effect.runPromiseExit(child)
    Effect.runSync(child)
    Effect.runSyncExit(child)
  }, 0)
})
