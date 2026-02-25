import { Effect } from "effect"

// Effect.succeed (unchanged - should NOT trigger diagnostic)
export const p1 = Effect.succeed(1)

// Effect.runtime (removed)
export const p2 = Effect.gen(function*(){
    const runtime = yield* Effect.runtime()
})

// --- Renamed APIs (v3 name → v4 name) ---

// Effect.catchAll → Effect.catch
export const p3 = Effect.catchAll(Effect.fail("err"), (_e) => Effect.succeed(0))

// Effect.catchAllCause → Effect.catchCause
export const p4 = Effect.catchAllCause(Effect.fail("err"), (_cause) => Effect.succeed(0))

// Effect.catchAllDefect → Effect.catchDefect
export const p5 = Effect.catchAllDefect(Effect.die("defect"), (_defect) => Effect.succeed(0))

// Effect.fork → Effect.forkChild
export const p6 = Effect.fork(Effect.succeed(1))

// Effect.forkDaemon → Effect.forkDetach
export const p7 = Effect.forkDaemon(Effect.succeed(1))

// --- Representative removed APIs ---

// Effect.Do (removed - use Effect.gen)
export const p8 = Effect.Do

// Effect.bind (removed - use Effect.gen)
export const p9 = Effect.bind(Effect.Do, "a", () => Effect.succeed(1))

// Effect.Tag (removed - use Context.Tag)
class MyTag extends Effect.Tag("MyTag")<MyTag, string>() {}

// Effect.either (removed - use Effect.exit)
export const p11 = Effect.either(Effect.succeed(1))

// Effect.zipLeft (removed - use Effect.tap)
export const p12 = Effect.zipLeft(Effect.succeed(1), Effect.succeed(2))

// Effect.zipRight (removed - use Effect.andThen)
export const p13 = Effect.zipRight(Effect.succeed(1), Effect.succeed(2))

// Effect.orElse (removed - use Effect.catchAll)
export const p14 = Effect.orElse(Effect.fail("err"), () => Effect.succeed(0))

// Effect.dieMessage (removed - use Effect.die with message)
export const p15 = Effect.dieMessage("something went wrong")

// Effect.dieSync (removed - use Effect.die)
export const p16 = Effect.dieSync(() => new Error("boom"))

// Effect.async (removed - use Effect.async from effect/Effect)
export const p17 = Effect.async<number>((resume) => {
    resume(Effect.succeed(42))
})
