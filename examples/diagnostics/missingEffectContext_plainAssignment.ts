import * as Context from "effect/Context"
import * as Effect from "effect/Effect"

class ServiceA extends Effect.Service<ServiceB>()("ServiceA", {
    succeed: { a: 1}
}){}

class ServiceB extends Effect.Service<ServiceB>()("ServiceB", {
    succeed: { a: 2}
}){}

class ServiceC extends Effect.Service<ServiceB>()("ServiceC", {
    succeed: { a: 3}
}){}

declare const effectWithServices: Effect.Effect<number, never, ServiceA | ServiceB | ServiceC >

export const noError: Effect.Effect<number> = Effect.succeed(1)

export const missingAllServices: Effect.Effect<number> = effectWithServices

export const missingServiceC: Effect.Effect<number, never, ServiceA | ServiceB> = effectWithServices

export interface EffectSubtyping<A> extends Effect.Effect<A, never, ServiceA | ServiceB> {}

export const missingServiceCWithSubtyping: EffectSubtyping<number> = effectWithServices

export function missingServiceWithGenericType<A>(service: A){
    const missingServiceA: Effect.Effect<Context.Context<A>> = Effect.context<A>()
    return missingServiceA
}
