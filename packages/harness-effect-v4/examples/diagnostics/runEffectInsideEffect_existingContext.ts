import { Effect } from "effect"

export const program = Effect.gen(function*() {
  const context = yield* Effect.context<never>()
  const run = () => Effect.runSync(Effect.succeed(1))
  return [context, run()] as const
})
