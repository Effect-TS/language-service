import { Effect, Layer } from "effect"

class DatabaseContext extends Effect.Service<DatabaseContext>()("DatabaseContext", {
  succeed: {
    value: "DatabaseContext" as const
  }
}) {}

export const AppLive = Layer.effectDiscard(Effect.gen(function*() {
  const databaseContext = yield* DatabaseContext

  return yield* Effect.log(databaseContext.value)
})).pipe(Layer.provide(DatabaseContext.Default))
