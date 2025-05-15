import * as Effect from "effect/Effect"
import * as Data from "effect/Data"

class DivisionByZeroError extends Data.TaggedError("DivisionByZeroError")<{}>{}

const divide = Effect.fn(function*(fa: number, divideBy: number){
    if(divideBy === 0) return yield* new DivisionByZeroError()
    return fa / divideBy
})

const program = Effect.gen(function*(){
    const result = yield* divide(42, 2)
})
