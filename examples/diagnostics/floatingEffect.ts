import * as Effect from "effect/Effect"

const noError = Effect.succeed(1)

Effect.succeed("floating")

Effect.never

Effect.runPromise(Effect.gen(function*(){
    const thisIsFine = Effect.succeed(1)
    Effect.never
}))
