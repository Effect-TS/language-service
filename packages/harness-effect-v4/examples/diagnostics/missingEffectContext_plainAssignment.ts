import { Context} from "effect"
import * as Effect from "effect/Effect"

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

export const noError: Effect.Effect<number> = Effect.succeed(1)

// @ts-expect-error
export const missingAllServices: Effect.Effect<number> = effectWithServices

// @ts-expect-error
export const missingServiceC: Effect.Effect<number, never, ServiceA | ServiceB> = effectWithServices

export interface EffectSubtyping<A> extends Effect.Effect<A, never, ServiceA | ServiceB> {}

// @ts-expect-error
export const missingServiceCWithSubtyping: EffectSubtyping<number> = effectWithServices

export function missingServiceWithGenericType<A>(service: A) {
  // @ts-expect-error
  const missingServiceA: Effect.Effect<Context.Context<A>> = Effect.context<A>()
  return missingServiceA
}

// @ts-expect-error
const _ = effectWithServices satisfies Effect.Effect<number, never, never>
