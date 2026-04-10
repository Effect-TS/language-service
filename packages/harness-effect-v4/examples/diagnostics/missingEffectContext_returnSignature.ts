import { Effect, Context} from "effect"

class ServiceA extends Context.Service<ServiceA>()("ServiceA", {
  make: Effect.succeed({ a: 1 })
}) {}

class ServiceB extends Context.Service<ServiceB>()("ServiceB", {
  make: Effect.succeed({ a: 2 })
}) {}

class ServiceC extends Context.Service<ServiceC>()("ServiceC", {
  make: Effect.succeed({ a: 3 })
}) {}

declare const effectWithServices: Effect.Effect<number, never, ServiceA | ServiceB | ServiceC>

export function testFn(): Effect.Effect<number> {
  // @ts-expect-error
  return effectWithServices
}

// @ts-expect-error
export const conciseBody: () => Effect.Effect<number> = () => effectWithServices

export const conciseBodyMissingServiceC: () => Effect.Effect<number, never, ServiceA | ServiceB> = () =>
  // @ts-expect-error
  effectWithServices
