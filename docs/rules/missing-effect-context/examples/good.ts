import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

// Define some services
class ServiceA extends Effect.Service<ServiceA>()("ServiceA", {
  succeed: { doA: () => "A" }
}) {}

class ServiceB extends Effect.Service<ServiceB>()("ServiceB", {
  succeed: { doB: () => "B" }
}) {}

class ServiceC extends Effect.Service<ServiceC>()("ServiceC", {
  succeed: { doC: () => "C" }
}) {}

// An effect that requires all three services
const effectWithServices: Effect.Effect<
  number,
  never,
  ServiceA | ServiceB | ServiceC
> = Effect.gen(function* () {
  const a = yield* ServiceA
  const b = yield* ServiceB
  const c = yield* ServiceC
  return a.doA().length + b.doB().length + c.doC().length
})

// Good: Type explicitly includes all required services
export const withAllServices: Effect.Effect<
  number,
  never,
  ServiceA | ServiceB | ServiceC
> = effectWithServices

// Good: Provide services to remove them from requirements
const ServiceLive = Layer.mergeAll(
  ServiceA.Default,
  ServiceB.Default,
  ServiceC.Default
)

export const provided: Effect.Effect<number> = effectWithServices.pipe(
  Effect.provide(ServiceLive)
)

// Good: Function return type properly includes services
function getEffect(): Effect.Effect<number, never, ServiceA | ServiceB | ServiceC> {
  return effectWithServices
}

// Good: Partial provision - remaining services still in type
export const partiallyProvided: Effect.Effect<number, never, ServiceC> =
  effectWithServices.pipe(
    Effect.provide(ServiceA.Default),
    Effect.provide(ServiceB.Default)
  )

export { getEffect }
