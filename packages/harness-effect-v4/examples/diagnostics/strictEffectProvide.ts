// @effect-diagnostics strictEffectProvide:warning
import { ServiceMap, Effect, Layer } from "effect"

class MyService1 extends ServiceMap.Service<MyService1>()("MyService1", {
  make: Effect.succeed({ value: 1 })
}) {
  static Default = Layer.effect(this, this.make)
}

class MyService2 extends ServiceMap.Service<MyService2>()("MyService2", {
  make: Effect.succeed({ value: 2 })
}) {
  static Default = Layer.effect(this, this.make)
}

// Should report: Effect.provide with a Layer
export const shouldReport1 = Effect.void.pipe(
  Effect.provide(MyService1.Default)
)

// Should report: Effect.provide with multiple arguments including a Layer
export const shouldReport2 = Effect.provide(Effect.void, MyService1.Default)

// Should report: Effect.provide in a chain
export const shouldReport3 = Effect.void.pipe(
  Effect.map(() => 42),
  Effect.provide(MyService1.Default),
  Effect.map((n) => n + 1)
)

// Should report: Multiple layers provided
export const shouldReport4 = Effect.void.pipe(
  Effect.provide(Layer.mergeAll(MyService1.Default, MyService2.Default))
)

// Should NOT report: providing a plain service (not a layer)
export const shouldNotReport1 = Effect.void.pipe(
  Effect.provideService(MyService1, MyService1.of({ value: 1 }))
)

// Should NOT report: Layer.provide (not Effect.provide)
export const shouldNotReport2 = Layer.provide(
  MyService1.Default,
  MyService2.Default
)

// Should NOT report: Effect.provide without layer arguments
export const shouldNotReport3 = Effect.gen(function*() {
  const ctx = yield* Effect.services<MyService1>()
  return yield* Effect.provide(Effect.void, ctx)
})
