import * as Effect from "effect/Effect"

const noError = Effect.gen(function*(){
    yield* Effect.succeed(1)
})

// @ts-expect-error
const missingStarInYield = Effect.gen(function*(){
    yield Effect.succeed(1)
})

// @ts-expect-error
const missingStarInMultipleYield = Effect.gen(function*(){
    yield Effect.succeed(1)
    yield Effect.succeed(2)
})

const missingStarInInnerYield = Effect.gen(function*(){
    // @ts-expect-error
    yield* Effect.gen(function*(){
        yield Effect.succeed(1)
    })
})
