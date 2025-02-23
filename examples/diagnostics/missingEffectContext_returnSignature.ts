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

export function testFn(): Effect.Effect<number> {
    return effectWithServices
}
 
export const conciseBody: () => Effect.Effect<number> = () => effectWithServices

export const conciseBodyMissingServiceC: () => Effect.Effect<number, never, ServiceA | ServiceB> = () => effectWithServices
