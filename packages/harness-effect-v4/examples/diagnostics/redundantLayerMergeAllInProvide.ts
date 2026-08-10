import { Context, Effect, Layer } from "effect"

const first = Layer.empty
const second = Layer.empty
const third = Layer.empty
const layers = [first, second] as const

export const shouldReportPipeable = Effect.void.pipe(
  Effect.provide(Layer.mergeAll(first, second))
)

export const shouldReportWithOptions = Effect.void.pipe(
  Effect.provide(Layer.mergeAll(first, second), { local: true })
)

export const shouldReportDataFirst = Effect.provide(
  Effect.void,
  Layer.mergeAll(first, second)
)

export const shouldReportSpread = Effect.void.pipe(
  Effect.provide(Layer.mergeAll(...[first, second]))
)

export const shouldReportTupleSpread = Effect.void.pipe(
  Effect.provide(Layer.mergeAll(...layers))
)

export const shouldNotReportTransformed = Effect.void.pipe(
  Effect.provide(
    Layer.mergeAll(first, second).pipe(Layer.provide(third))
  )
)

const combined = Layer.mergeAll(first, second)

export const shouldNotReportPrecomposed = Effect.void.pipe(
  Effect.provide(combined)
)

class Dependency extends Context.Service<Dependency>()("Dependency", {
  make: Effect.succeed({})
}) {
  static Default = Layer.effect(this, this.make)
}
class Consumer extends Context.Service<Consumer>()("Consumer", {
  make: Effect.as(Dependency, {})
}) {
  static Default = Layer.effect(this, this.make)
}

export const shouldNotReportWithDependencies = Effect.void.pipe(
  Effect.provide(Layer.mergeAll(Dependency.Default, Consumer.Default))
)
