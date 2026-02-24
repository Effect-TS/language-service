import { Effect } from "effect"

export const runtime = Effect.gen(function*() {
  return yield* Effect.runtime()
})
