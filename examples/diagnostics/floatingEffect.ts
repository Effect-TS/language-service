import * as Effect from "effect/Effect"

const noError = Effect.succeed(1)

Effect.succeed("floating")

Effect.never

Effect.runPromise(Effect.gen(function*(){
    const thisIsFine = Effect.succeed(1)
    Effect.never
}))

Effect.runPromise(Effect.gen(function*(){
    yield* Effect.succeed(1).pipe(Effect.fork)
    // ^- This is fine, returns a fiber runtime
}))

export function constructorFunction(this: { boot: Effect.Effect<void>}){
    this.boot = Effect.void
}

