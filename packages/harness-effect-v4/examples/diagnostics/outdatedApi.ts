import { Effect } from "effect"

export const runtime = Effect.gen(function*() {
  // @ts-expect-error - runtime was removed in v4, this tests the outdatedApi diagnostic
  return yield* Effect.runtime()
})
