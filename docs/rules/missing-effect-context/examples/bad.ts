import * as Effect from "effect/Effect"

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

// Bad: Missing all services in expected type
// @ts-expect-error - Demonstrates the issue
export const missingAllServices: Effect.Effect<number> = effectWithServices

// Bad: Missing ServiceC in expected type
// @ts-expect-error - Demonstrates the issue
export const missingServiceC: Effect.Effect<
  number,
  never,
  ServiceA | ServiceB
> = effectWithServices

// Bad: Function return type doesn't include required services
function getEffect(): Effect.Effect<number> {
  // @ts-expect-error - Demonstrates the issue
  return effectWithServices
}

export { getEffect }
