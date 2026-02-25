import { Effect, ServiceMap } from "effect"

// Effect.succeed (unchanged - same in v4)
export const p1 = Effect.succeed(1)

// Effect.runtime (removed in v4 - no direct equivalent)
// In v4, runtime access patterns differ; this example shows Effect.gen is still available
export const p2 = Effect.gen(function*() {
    return 1
})

// --- Renamed APIs (v3 name → v4 name) ---

// Effect.catchAll → Effect.catch
export const p3 = Effect.catch(Effect.fail("err"), (_e) => Effect.succeed(0))

// Effect.catchAllCause → Effect.catchCause
export const p4 = Effect.catchCause(Effect.fail("err"), (_cause) => Effect.succeed(0))

// Effect.catchAllDefect → Effect.catchDefect
export const p5 = Effect.catchDefect(Effect.die("defect"), (_defect) => Effect.succeed(0))

// Effect.fork → Effect.forkChild
export const p6 = Effect.forkChild(Effect.succeed(1))

// Effect.forkDaemon → Effect.forkDetach
export const p7 = Effect.forkDetach(Effect.succeed(1))

// --- Representative removed APIs (v4 equivalents) ---

// Effect.Do (removed - use Effect.gen)
export const p8 = Effect.gen(function*() {
    const a = yield* Effect.succeed(1)
    return { a }
})

// Effect.bind (removed - use Effect.gen)
export const p9 = Effect.gen(function*() {
    const a = yield* Effect.succeed(1)
    return { a }
})

// Effect.Tag (removed - use ServiceMap.Service)
class MyTag extends ServiceMap.Service<MyTag, string>()("MyTag") {}

// Effect.either (removed - use Effect.exit)
export const p11 = Effect.exit(Effect.succeed(1))

// Effect.zipLeft (removed - use Effect.tap)
export const p12 = Effect.tap(Effect.succeed(1), () => Effect.succeed(2))

// Effect.zipRight (removed - use Effect.andThen)
export const p13 = Effect.andThen(Effect.succeed(1), () => Effect.succeed(2))

// Effect.orElse (removed - use Effect.catch)
export const p14 = Effect.catch(Effect.fail("err"), () => Effect.succeed(0))

// Effect.dieMessage (removed - use Effect.die with message)
export const p15 = Effect.die("something went wrong")

// Effect.dieSync (removed - use Effect.die)
export const p16 = Effect.die(new Error("boom"))

// Effect.async (removed in v4 - use Effect.promise or Effect.tryPromise)
export const p17 = Effect.promise<number>(() => Promise.resolve(42))
