import * as Effect from "effect/Effect"
import * as Context from "effect/Context"


class ServiceA extends Effect.Service<ServiceB>()("ServiceA", {
    succeed: { a: 1}
}){}

class ServiceB extends Effect.Service<ServiceB>()("ServiceB", {
    succeed: { a: 1}
}){}

class ServiceC extends Effect.Service<ServiceB>()("ServiceC", {
    succeed: { a: 1}
}){}

declare const eff: Effect.Effect<number, never, ServiceA | ServiceB | ServiceC >

function test<A extends Effect.Effect<number, never, ServiceC>>(value: A){
    const eff: Effect.Effect<number, never, ServiceA | ServiceB> = value
}

Effect.runPromise(Effect.gen(function*(){
    const service = yield* ServiceB
    yield* Effect.fail("error")
}))


export const test3: Effect.Effect<number> = eff 

interface Subtyping<A> extends Effect.Effect<number, A, ServiceB> {}
export const test4: Subtyping<boolean> = eff

interface ResultObject {
    eff: Effect.Effect<number, never, ServiceA | ServiceB>
    "-test": Effect.Effect<number, never, ServiceA | ServiceB>
}

function a(): ResultObject {
    return {
        eff: eff,
        "-test": eff
    }
}

