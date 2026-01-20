import { Effect } from "effect"

export const shouldWarn = Effect.gen(function*() {
  return Effect.fail("error")
})
