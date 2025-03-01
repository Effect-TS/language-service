import * as Effect from "effect/Effect"
import * as Data from "effect/Data"

class ErrorA extends Data.Error<{
    a: 1
}>{}

class ErrorB extends Data.Error<{
    a: 2
}>{}

class ErrorC extends Data.Error<{
    a: 3
}>{}

declare const effectWithErrors: Effect.Effect<number, ErrorA | ErrorB | ErrorC>

function testFn(effect: Effect.Effect<number>){
    return effect
}

// @ts-expect-error
testFn(effectWithErrors)

function testFnWithServiceAB(effect: Effect.Effect<number, ErrorA | ErrorB>){
    return effect
}

// @ts-expect-error
testFnWithServiceAB(effectWithErrors)
