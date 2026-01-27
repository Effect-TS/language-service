import { Effect, Layer, ServiceMap } from "effect"

class DatabaseContext extends ServiceMap.Service<DatabaseContext>()("DatabaseContext", {
  make: Effect.succeed({
    value: "DatabaseContext" as const
  })
}) {
  static Default = Layer.effect(this, this.make)
}

export const AppLive = Layer.effectDiscard(Effect.gen(function*() {
  const databaseContext = yield* DatabaseContext.asEffect()

  return yield* Effect.log(databaseContext.value)
})).pipe(Layer.provide(DatabaseContext.Default))
