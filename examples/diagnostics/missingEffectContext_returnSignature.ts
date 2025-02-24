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

export function testFn(): Effect.Effect<number> {
    // @ts-expect-error
    return effectWithServices
}
 
// @ts-expect-error
export const conciseBody: () => Effect.Effect<number> = () => effectWithServices

// @ts-expect-error
export const conciseBodyMissingServiceC: () => Effect.Effect<number, never, ServiceA | ServiceB> = () => effectWithServices
