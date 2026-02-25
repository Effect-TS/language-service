import { Cause, Chunk, Context, Duration, Effect, HashMap, LogLevel, Option, Schedule, Scope, Tracer } from "effect"

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

// Effect.ensureErrorType → Effect.satisfiesErrorType
export const p_ensureErrorType = Effect.ensureErrorType<string>()(Effect.fail("err"))

// Effect.ensureSuccessType → Effect.satisfiesSuccessType
export const p_ensureSuccessType = Effect.ensureSuccessType<number>()(Effect.succeed(1))

// Effect.ensureRequirementsType → Effect.satisfiesServicesType
export const p_ensureRequirementsType = Effect.ensureRequirementsType<never>()(Effect.succeed(1))

// Effect.scopeWith → Effect.scopedWith
export const p_scopeWith = Effect.scopeWith((_scope) => Effect.succeed("in scope"))

// Effect.serviceOptional → Effect.serviceOption
export const p_serviceOptional = Effect.serviceOptional(Context.GenericTag<{ value: number }>("SvcOpt"))

// Effect.tapErrorCause → Effect.tapCause
export const p_tapErrorCause = Effect.tapErrorCause(Effect.fail("err"), (_cause) => Effect.void)

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

// Effect.async (renamed to Effect.callback - behavioral differences)
export const p17 = Effect.async<number>((resume) => {
    resume(Effect.succeed(42))
})

// =============================================================================
// Unchanged APIs (asUnchanged) — should NOT trigger diagnostic
// =============================================================================

// --- Creation / Constructors ---

// Effect.succeed
export const uc_succeed = Effect.succeed(1)

// Effect.sync
export const uc_sync = Effect.sync(() => 42)

// Effect.promise
export const uc_promise = Effect.promise(() => Promise.resolve(42))

// Effect.try
export const uc_try = Effect.try(() => JSON.parse("{}"))

// Effect.tryPromise
export const uc_tryPromise = Effect.tryPromise(() => fetch("https://example.com"))

// Effect.fail
export const uc_fail = Effect.fail("error")

// Effect.failSync
export const uc_failSync = Effect.failSync(() => new Error("boom"))

// Effect.failCause
export const uc_failCause = Effect.failCause(Cause.die("defect"))

// Effect.failCauseSync
export const uc_failCauseSync = Effect.failCauseSync(() => Cause.die("defect"))

// Effect.die
export const uc_die = Effect.die("unexpected")

// Effect.suspend
export const uc_suspend = Effect.suspend(() => Effect.succeed(1))

// Effect.void
export const uc_void = Effect.void

// Effect.never
export const uc_never = Effect.never

// Effect.interrupt
export const uc_interrupt = Effect.interrupt

// Effect.gen
export const uc_gen = Effect.gen(function* () {
    const a = yield* Effect.succeed(1)
    return a + 1
})

// Effect.fn
export const uc_fn = Effect.fn("myFn")(function* (x: number) {
    return yield* Effect.succeed(x + 1)
})

// Effect.fnUntraced
export const uc_fnUntraced = Effect.fnUntraced(function* (x: number) {
    return yield* Effect.succeed(x + 1)
})

// Effect.whileLoop
export const uc_whileLoop = Effect.whileLoop({
    while: () => true,
    body: () => Effect.succeed(1),
    step: (_a: number) => {}
})

// Effect.yieldNow
export const uc_yieldNow = Effect.yieldNow()

// Effect.succeedNone
export const uc_succeedNone = Effect.succeedNone

// Effect.succeedSome
export const uc_succeedSome = Effect.succeedSome(42)

// Effect.isEffect
export const uc_isEffect = Effect.isEffect(Effect.succeed(1))

// Effect.makeLatch
export const uc_makeLatch = Effect.makeLatch()

// Effect.makeSemaphore
export const uc_makeSemaphore = Effect.makeSemaphore(1)

// --- Transformation ---

// Effect.map
export const uc_map = Effect.map(Effect.succeed(1), (n) => n + 1)

// Effect.flatMap
export const uc_flatMap = Effect.flatMap(Effect.succeed(1), (n) => Effect.succeed(n + 1))

// Effect.flatten
export const uc_flatten = Effect.flatten(Effect.succeed(Effect.succeed(1)))

// Effect.ignore
export const uc_ignore = Effect.ignore(Effect.fail("err"))

// Effect.andThen
export const uc_andThen = Effect.andThen(Effect.succeed(1), (n) => n + 1)

// Effect.as
export const uc_as = Effect.as(Effect.succeed(1), "hello")

// Effect.asSome
export const uc_asSome = Effect.asSome(Effect.succeed(1))

// Effect.asVoid
export const uc_asVoid = Effect.asVoid(Effect.succeed(1))

// Effect.tap
export const uc_tap = Effect.tap(Effect.succeed(1), (n) => Effect.log(`got ${n}`))

// Effect.mapBoth
export const uc_mapBoth = Effect.mapBoth(Effect.fail("err") as Effect.Effect<number, string>, {
    onFailure: (e) => new Error(e),
    onSuccess: (n) => n + 1
})

// Effect.mapError
export const uc_mapError = Effect.mapError(Effect.fail("err"), (e) => new Error(e))

// Effect.flip
export const uc_flip = Effect.flip(Effect.fail("err") as Effect.Effect<number, string>)

// Effect.filter
export const uc_filter = Effect.filter([1, 2, 3], (n) => Effect.succeed(n > 1))

// Effect.filterMap
export const uc_filterMap = Effect.filterMap([Effect.succeed(1), Effect.succeed(2)], (n) => n > 1 ? Option.some(n * 2) : Option.none())

// Effect.filterOrElse
export const uc_filterOrElse = Effect.filterOrElse(Effect.succeed(1), (n) => n > 0, () => Effect.succeed(0))

// Effect.filterOrFail
export const uc_filterOrFail = Effect.filterOrFail(Effect.succeed(1), (n) => n > 0, () => "not positive")

// Effect.option
export const uc_option = Effect.option(Effect.succeed(1))

// Effect.timed
export const uc_timed = Effect.timed(Effect.succeed(1))

// Effect.delay
export const uc_delay = Effect.delay(Effect.succeed(1), "100 millis")

// Effect.timeout
export const uc_timeout = Effect.timeout(Effect.succeed(1), "1 seconds")

// Effect.timeoutOption
export const uc_timeoutOption = Effect.timeoutOption(Effect.succeed(1), "1 seconds")

// Effect.when
export const uc_when = Effect.when(Effect.succeed(1), () => true)

// Effect.zip
export const uc_zip = Effect.zip(Effect.succeed(1), Effect.succeed("a"))

// Effect.zipWith
export const uc_zipWith = Effect.zipWith(Effect.succeed(1), Effect.succeed(2), (a, b) => a + b)

// --- Error Handling ---

// Effect.catch — v4-only API name (renamed from catchAll), cannot be used in v3

// Effect.catchIf
export const uc_catchIf = Effect.catchIf(
    Effect.fail("err") as Effect.Effect<number, string>,
    (e): e is string => typeof e === "string",
    (_e) => Effect.succeed(0)
)

// Effect.catchTag
class MyError extends Effect.Tag("MyError")<MyError, { message: string }>() {}
export const uc_catchTag = Effect.catchTag(
    Effect.fail({ _tag: "MyError" as const, message: "boom" }) as Effect.Effect<number, { _tag: "MyError"; message: string }>,
    "MyError",
    (_e) => Effect.succeed(0)
)

// Effect.catchTags
export const uc_catchTags = Effect.catchTags(
    Effect.fail({ _tag: "MyError" as const, message: "boom" }) as Effect.Effect<number, { _tag: "MyError"; message: string }>,
    { MyError: (_e) => Effect.succeed(0) }
)

// Effect.onError
export const uc_onError = Effect.onError(Effect.succeed(1), (_cause) => Effect.log("error occurred"))

// Effect.onExit
export const uc_onExit = Effect.onExit(Effect.succeed(1), (_exit) => Effect.log("done"))

// Effect.onInterrupt
export const uc_onInterrupt = Effect.onInterrupt(Effect.succeed(1), (_fibers) => Effect.log("interrupted"))

// Effect.orDie
export const uc_orDie = Effect.orDie(Effect.fail("err"))

// Effect.orElseSucceed
export const uc_orElseSucceed = Effect.orElseSucceed(Effect.fail("err"), () => 0)

// Effect.sandbox
export const uc_sandbox = Effect.sandbox(Effect.succeed(1))

// Effect.match
export const uc_match = Effect.match(Effect.fail("err") as Effect.Effect<number, string>, {
    onFailure: (_e) => 0,
    onSuccess: (n) => n
})

// Effect.matchCause
export const uc_matchCause = Effect.matchCause(Effect.fail("err") as Effect.Effect<number, string>, {
    onFailure: (_cause) => 0,
    onSuccess: (n) => n
})

// Effect.matchCauseEffect
export const uc_matchCauseEffect = Effect.matchCauseEffect(Effect.fail("err") as Effect.Effect<number, string>, {
    onFailure: (_cause) => Effect.succeed(0),
    onSuccess: (n) => Effect.succeed(n)
})

// Effect.matchEffect
export const uc_matchEffect = Effect.matchEffect(Effect.fail("err") as Effect.Effect<number, string>, {
    onFailure: (_e) => Effect.succeed(0),
    onSuccess: (n) => Effect.succeed(n)
})

// Effect.ensuring
export const uc_ensuring = Effect.ensuring(Effect.succeed(1), Effect.log("cleanup"))

// Effect.tapDefect
export const uc_tapDefect = Effect.tapDefect(Effect.succeed(1), (_defect) => Effect.log("defect"))

// Effect.tapError
export const uc_tapError = Effect.tapError(Effect.succeed(1), (_err) => Effect.log("error"))

// Effect.tapErrorTag
export const uc_tapErrorTag = Effect.tapErrorTag(
    Effect.fail({ _tag: "Err" as const }) as Effect.Effect<number, { _tag: "Err" }>,
    "Err",
    (_e) => Effect.log("tagged error")
)

// --- Concurrency ---

// Effect.all
export const uc_all = Effect.all([Effect.succeed(1), Effect.succeed(2)])

// Effect.race
export const uc_race = Effect.race(Effect.succeed(1), Effect.succeed(2))

// Effect.raceAll
export const uc_raceAll = Effect.raceAll([Effect.succeed(1), Effect.succeed(2)])

// Effect.raceFirst
export const uc_raceFirst = Effect.raceFirst(Effect.succeed(1), Effect.succeed(2))

// Effect.forEach
export const uc_forEach = Effect.forEach([1, 2, 3], (n) => Effect.succeed(n * 2))

// Effect.replicate
export const uc_replicate = Effect.replicate(Effect.succeed(1), 3)

// Effect.replicateEffect
export const uc_replicateEffect = Effect.replicateEffect(Effect.succeed(1), 3)

// Effect.repeat
export const uc_repeat = Effect.repeat(Effect.log("tick"), Schedule.recurs(2))

// Effect.repeatOrElse
export const uc_repeatOrElse = Effect.repeatOrElse(
    Effect.log("tick"),
    Schedule.recurs(2),
    (_err, _out) => Effect.succeed(0)
)

// Effect.retry
export const uc_retry = Effect.retry(Effect.fail("err"), Schedule.recurs(2))

// Effect.retryOrElse
export const uc_retryOrElse = Effect.retryOrElse(
    Effect.fail("err"),
    Schedule.recurs(2),
    (_err, _out) => Effect.succeed("fallback")
)

// Effect.forever
export const uc_forever = Effect.forever(Effect.log("loop"))

// Effect.eventually
export const uc_eventually = Effect.eventually(Effect.fail("err") as Effect.Effect<number, string>)

// Effect.withConcurrency
export const uc_withConcurrency = Effect.withConcurrency(
    Effect.forEach([1, 2, 3], (n) => Effect.succeed(n)),
    2
)

// Effect.schedule
export const uc_schedule = Effect.schedule(Effect.log("tick"), Schedule.recurs(2))

// Effect.scheduleFrom
export const uc_scheduleFrom = Effect.scheduleFrom(Effect.succeed(0), 0, Schedule.recurs(2))

// --- Resource Management ---

// Effect.acquireRelease
export const uc_acquireRelease = Effect.acquireRelease(
    Effect.succeed({ handle: "resource" }),
    (_resource) => Effect.log("released")
)

// Effect.acquireUseRelease
export const uc_acquireUseRelease = Effect.acquireUseRelease(
    Effect.succeed({ handle: "resource" }),
    (_resource) => Effect.succeed("used"),
    (_resource) => Effect.log("released")
)

// Effect.addFinalizer
export const uc_addFinalizer = Effect.addFinalizer((_exit) => Effect.log("finalized"))

// Effect.scope
export const uc_scope = Effect.scope

// Effect.scoped
export const uc_scoped = Effect.scoped(Effect.addFinalizer((_exit) => Effect.log("done")))

// Effect.scopedWith
export const uc_scopedWith = Effect.scopedWith((_scope) => Effect.succeed("in scope"))

// Effect.cached
export const uc_cached = Effect.cached(Effect.succeed(42))

// Effect.cachedWithTTL
export const uc_cachedWithTTL = Effect.cachedWithTTL(Effect.succeed(42), "1 seconds")

// Effect.cachedInvalidateWithTTL
export const uc_cachedInvalidateWithTTL = Effect.cachedInvalidateWithTTL(Effect.succeed(42), "1 seconds")

// --- Services ---

// Effect.provide
export const uc_provide = Effect.provide(Effect.succeed(1), Context.empty())

// Effect.provideService
const SomeService = Context.GenericTag<{ value: number }>("SomeService")
export const uc_provideService = Effect.provideService(Effect.succeed(1), SomeService, { value: 42 })

// Effect.provideServiceEffect
export const uc_provideServiceEffect = Effect.provideServiceEffect(
    Effect.succeed(1),
    SomeService,
    Effect.succeed({ value: 42 })
)

// Effect.updateService
export const uc_updateService = Effect.updateService(
    Effect.succeed(1),
    SomeService,
    (s) => ({ ...s, value: s.value + 1 })
)

// Effect.serviceOption
export const uc_serviceOption = Effect.serviceOption(SomeService)

// --- Logging ---

// Effect.log
export const uc_log = Effect.log("hello")

// Effect.logDebug
export const uc_logDebug = Effect.logDebug("debug message")

// Effect.logError
export const uc_logError = Effect.logError("error message")

// Effect.logFatal
export const uc_logFatal = Effect.logFatal("fatal message")

// Effect.logInfo
export const uc_logInfo = Effect.logInfo("info message")

// Effect.logTrace
export const uc_logTrace = Effect.logTrace("trace message")

// Effect.logWarning
export const uc_logWarning = Effect.logWarning("warning message")

// Effect.logWithLevel
export const uc_logWithLevel = Effect.logWithLevel(LogLevel.Info, "custom level message")

// Effect.annotateLogs
export const uc_annotateLogs = Effect.annotateLogs(Effect.log("hello"), "key", "value")

// Effect.annotateSpans
export const uc_annotateSpans = Effect.annotateSpans(Effect.succeed(1), "key", "value")

// Effect.withLogSpan
export const uc_withLogSpan = Effect.withLogSpan(Effect.log("hello"), "mySpan")

// --- Tracing ---

// Effect.annotateCurrentSpan
export const uc_annotateCurrentSpan = Effect.annotateCurrentSpan("key", "value")

// Effect.currentParentSpan
export const uc_currentParentSpan = Effect.currentParentSpan

// Effect.currentSpan
export const uc_currentSpan = Effect.currentSpan

// Effect.linkSpans
export const uc_linkSpans = Effect.gen(function* () {
    const span = yield* Effect.makeSpan("other")
    return yield* Effect.linkSpans(Effect.succeed(1), span)
})

// Effect.makeSpan
export const uc_makeSpan = Effect.makeSpan("mySpan")

// Effect.makeSpanScoped
export const uc_makeSpanScoped = Effect.scoped(Effect.makeSpanScoped("mySpan"))

// Effect.spanAnnotations
export const uc_spanAnnotations = Effect.spanAnnotations

// Effect.spanLinks
export const uc_spanLinks = Effect.spanLinks

// Effect.tracer
export const uc_tracer = Effect.tracer

// Effect.useSpan
export const uc_useSpan = Effect.useSpan("mySpan", (span) => Effect.succeed(span.name))

// Effect.withParentSpan
export const uc_withParentSpan = Effect.gen(function* () {
    const span = yield* Effect.makeSpan("parent")
    return yield* Effect.withParentSpan(Effect.succeed(1), span)
})

// Effect.withSpan
export const uc_withSpan = Effect.withSpan(Effect.succeed(1), "mySpan")

// Effect.withSpanScoped
export const uc_withSpanScoped = Effect.scoped(Effect.withSpanScoped(Effect.succeed(1), "mySpan"))

// Effect.withTracer
export const uc_withTracer = Effect.gen(function* () {
    const tracer = yield* Effect.tracer
    return yield* Effect.withTracer(Effect.succeed(1), tracer)
})

// Effect.withTracerEnabled
export const uc_withTracerEnabled = Effect.withTracerEnabled(Effect.succeed(1), true)

// Effect.withTracerTiming
export const uc_withTracerTiming = Effect.withTracerTiming(Effect.succeed(1), true)

// --- Runtime ---

// Effect.runCallback
export const uc_runCallback = Effect.runCallback(Effect.succeed(1), { onExit: (_exit) => {} })

// Effect.runFork
export const uc_runFork = Effect.runFork(Effect.succeed(1))

// Effect.runPromise
export const uc_runPromise = Effect.runPromise(Effect.succeed(1))

// Effect.runPromiseExit
export const uc_runPromiseExit = Effect.runPromiseExit(Effect.succeed(1))

// Effect.runSync
export const uc_runSync = Effect.runSync(Effect.succeed(1))

// Effect.runSyncExit
export const uc_runSyncExit = Effect.runSyncExit(Effect.succeed(1))

// Effect.withExecutionPlan
export const uc_withExecutionPlan = Effect.withExecutionPlan

// --- Interruption ---

// Effect.interruptible
export const uc_interruptible = Effect.interruptible(Effect.succeed(1))

// Effect.interruptibleMask
export const uc_interruptibleMask = Effect.interruptibleMask((restore) => restore(Effect.succeed(1)))

// Effect.uninterruptible
export const uc_uninterruptible = Effect.uninterruptible(Effect.succeed(1))

// Effect.uninterruptibleMask
export const uc_uninterruptibleMask = Effect.uninterruptibleMask((restore) => restore(Effect.succeed(1)))

// --- Forking ---

// Effect.forkIn
export const uc_forkIn = Effect.gen(function* () {
    const scope = yield* Effect.scope
    return yield* Effect.forkIn(Effect.succeed(1), scope)
})

// Effect.forkScoped
export const uc_forkScoped = Effect.scoped(Effect.forkScoped(Effect.succeed(1)))

// --- Misc ---

// Effect.exit
export const uc_exit = Effect.exit(Effect.succeed(1))

// Effect.fiberId
export const uc_fiberId = Effect.fiberId

// Effect.sleep
export const uc_sleep = Effect.sleep("100 millis")

// Effect.clockWith
export const uc_clockWith = Effect.clockWith((clock) => Effect.sync(() => clock.unsafeCurrentTimeMillis()))

// Effect.isFailure
export const uc_isFailure = Effect.isFailure(Effect.succeed(1))

// Effect.isSuccess
export const uc_isSuccess = Effect.isSuccess(Effect.succeed(1))

// Effect.request
export const uc_request = Effect.request
