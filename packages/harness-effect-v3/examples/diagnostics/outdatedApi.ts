import { Effect } from "effect"

// Effect.succeed
export const p1 = Effect.succeed(1)

// Effect.runtime 
export const p2 = Effect.gen(function*(){
    const runtime = yield* Effect.runtime()
})
