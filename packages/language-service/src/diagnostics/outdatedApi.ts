import { pipe } from "effect/Function"
import type * as ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

// is unchanged between v3 and v4
interface Unchanged {
  readonly _tag: "Unchanged"
}
const asUnchanged: Unchanged = {
  _tag: "Unchanged"
}

// is renamed between v3 and v4 and kept as is
interface RenamedSameBehaviour {
  readonly _tag: "RenamedSameBehaviour"
  readonly newName: string
}
const asRenamedSameBehaviour = (newName: string): RenamedSameBehaviour => ({
  _tag: "RenamedSameBehaviour",
  newName
})

// is renamed between v3 and v4, and needs options to be used in the v4 api to get the same behaviour of v3
interface RenamedAndNeedsOptions {
  readonly _tag: "RenamedAndNeedsOptions"
  readonly newName: string
  readonly optionsInstructions: string
}
export const asRenamedAndNeedsOptions = (newName: string, optionsInstructions: string): RenamedAndNeedsOptions => ({
  _tag: "RenamedAndNeedsOptions",
  newName,
  optionsInstructions
})

interface Removed {
  readonly _tag: "Removed"
  readonly alternativePattern: string
}
const asRemoved = (alternativePattern: string): Removed => ({
  _tag: "Removed",
  alternativePattern
})

export type Migration = Unchanged | RenamedSameBehaviour | RenamedAndNeedsOptions | Removed

export type ModuleMigrationDb = Record<string, Migration>

export const effectModuleMigrationDb: ModuleMigrationDb = {
  // Common APIs (in both v3 and v4, unchanged)
  "acquireRelease": asUnchanged,
  "acquireUseRelease": asUnchanged,
  "addFinalizer": asUnchanged,
  "all": asUnchanged,
  "andThen": asUnchanged,
  "annotateCurrentSpan": asUnchanged,
  "annotateLogs": asUnchanged,
  "annotateSpans": asUnchanged,
  "as": asUnchanged,
  "asSome": asUnchanged,
  "asVoid": asUnchanged,
  "cached": asUnchanged,
  "cachedInvalidateWithTTL": asUnchanged,
  "cachedWithTTL": asUnchanged,
  "catch": asUnchanged,
  "catchIf": asUnchanged,
  "catchTag": asUnchanged,
  "catchTags": asUnchanged,
  "clockWith": asUnchanged,
  "currentParentSpan": asUnchanged,
  "currentSpan": asUnchanged,
  "delay": asUnchanged,
  "die": asUnchanged,
  "ensuring": asUnchanged,
  "eventually": asUnchanged,
  "exit": asUnchanged,
  "fail": asUnchanged,
  "failCause": asUnchanged,
  "failCauseSync": asUnchanged,
  "failSync": asUnchanged,
  "fiberId": asUnchanged,
  "filter": asUnchanged,
  "filterMap": asUnchanged,
  "filterOrElse": asUnchanged,
  "filterOrFail": asUnchanged,
  "flatMap": asUnchanged,
  "flatten": asUnchanged,
  "flip": asUnchanged,
  "fn": asUnchanged,
  "fnUntraced": asUnchanged,
  "forEach": asUnchanged,
  "forever": asUnchanged,
  "forkIn": asUnchanged,
  "forkScoped": asUnchanged,
  "gen": asUnchanged,
  "ignore": asUnchanged,
  "interrupt": asUnchanged,
  "interruptible": asUnchanged,
  "interruptibleMask": asUnchanged,
  "isEffect": asUnchanged,
  "isFailure": asUnchanged,
  "isSuccess": asUnchanged,
  "linkSpans": asUnchanged,
  "log": asUnchanged,
  "logDebug": asUnchanged,
  "logError": asUnchanged,
  "logFatal": asUnchanged,
  "logInfo": asUnchanged,
  "logTrace": asUnchanged,
  "logWarning": asUnchanged,
  "logWithLevel": asUnchanged,
  "makeLatch": asUnchanged,
  "makeSemaphore": asUnchanged,
  "makeSpan": asUnchanged,
  "makeSpanScoped": asUnchanged,
  "map": asUnchanged,
  "mapBoth": asUnchanged,
  "mapError": asUnchanged,
  "match": asUnchanged,
  "matchCause": asUnchanged,
  "matchCauseEffect": asUnchanged,
  "matchEffect": asUnchanged,
  "never": asUnchanged,
  "onError": asUnchanged,
  "onExit": asUnchanged,
  "onInterrupt": asUnchanged,
  "option": asUnchanged,
  "orDie": asUnchanged,
  "orElseSucceed": asUnchanged,
  "promise": asUnchanged,
  "provide": asUnchanged,
  "provideService": asUnchanged,
  "provideServiceEffect": asUnchanged,
  "race": asUnchanged,
  "raceAll": asUnchanged,
  "raceFirst": asUnchanged,
  "repeat": asUnchanged,
  "repeatOrElse": asUnchanged,
  "replicate": asUnchanged,
  "replicateEffect": asUnchanged,
  "request": asUnchanged,
  "retry": asUnchanged,
  "retryOrElse": asUnchanged,
  "runCallback": asUnchanged,
  "runFork": asUnchanged,
  "runPromise": asUnchanged,
  "runPromiseExit": asUnchanged,
  "runSync": asUnchanged,
  "runSyncExit": asUnchanged,
  "sandbox": asUnchanged,
  "schedule": asUnchanged,
  "scheduleFrom": asUnchanged,
  "scope": asUnchanged,
  "scoped": asUnchanged,
  "scopedWith": asUnchanged,
  "serviceOption": asUnchanged,
  "sleep": asUnchanged,
  "spanAnnotations": asUnchanged,
  "spanLinks": asUnchanged,
  "succeed": asUnchanged,
  "succeedNone": asUnchanged,
  "succeedSome": asUnchanged,
  "suspend": asUnchanged,
  "sync": asUnchanged,
  "tap": asUnchanged,
  "tapDefect": asUnchanged,
  "tapError": asUnchanged,
  "tapErrorTag": asUnchanged,
  "timed": asUnchanged,
  "timeout": asUnchanged,
  "timeoutOption": asUnchanged,
  "tracer": asUnchanged,
  "try": asUnchanged,
  "tryPromise": asUnchanged,
  "uninterruptible": asUnchanged,
  "uninterruptibleMask": asUnchanged,
  "updateService": asUnchanged,
  "useSpan": asUnchanged,
  "void": asUnchanged,
  "when": asUnchanged,
  "whileLoop": asUnchanged,
  "withConcurrency": asUnchanged,
  "withExecutionPlan": asUnchanged,
  "withLogSpan": asUnchanged,
  "withParentSpan": asUnchanged,
  "withSpan": asUnchanged,
  "withSpanScoped": asUnchanged,
  "withTracer": asUnchanged,
  "withTracerEnabled": asUnchanged,
  "withTracerTiming": asUnchanged,
  "yieldNow": asUnchanged,
  "zip": asUnchanged,
  "zipWith": asUnchanged,

  // Renamed APIs (v3 name → v4 name)
  "catchAll": asRenamedSameBehaviour("catch"),
  "catchAllCause": asRenamedSameBehaviour("catchCause"),
  "catchAllDefect": asRenamedSameBehaviour("catchDefect"),
  "catchSome": asRenamedSameBehaviour("catchFilter"),
  "catchSomeCause": asRenamedSameBehaviour("catchCauseFilter"),
  "fork": asRenamedSameBehaviour("forkChild"),
  "forkDaemon": asRenamedSameBehaviour("forkDetach"),

  // Removed APIs
  "catchSomeDefect": asRemoved(
    "Use Effect.catchDefect or Effect.matchCause to handle specific defects."
  ),
  "forkAll": asRemoved(
    "Fork effects individually with Effect.forEach and Effect.forkChild, or use Effect.all with concurrency options."
  ),
  "forkWithErrorHandler": asRemoved(
    "Fork the effect with Effect.forkChild and observe the fiber result via Fiber.join or Fiber.await."
  ),
  "Tag": asRemoved(
    "Use ServiceMap.Service instead of Effect.Tag."
  ),
  "Service": asRemoved(
    "Use ServiceMap.Service instead of Effect.Service."
  ),
  "runtime": asRemoved(
    "Runtime has been removed in Effect v4. Use Effect.services to grab services and then run using Effect.runPromiseWith."
  ),
  "Do": asRemoved(
    "Use Effect.gen instead of the Do notation (Effect.Do/bind/let/bindTo)."
  ),
  "bind": asRemoved(
    "Use Effect.gen instead of Effect.bind."
  ),
  "bindAll": asRemoved(
    "Use Effect.gen instead of Effect.bindAll."
  ),
  "bindTo": asRemoved(
    "Use Effect.gen instead of Effect.bindTo."
  ),
  "let": asRemoved(
    "Use Effect.gen instead of Effect.let."
  ),
  "EffectTypeId": asRemoved(
    "EffectTypeId has been removed in Effect v4."
  ),
  "acquireReleaseInterruptible": asRemoved(
    "Use Effect.acquireRelease instead."
  ),
  "allSuccesses": asRemoved(
    "Use Effect.all with the { mode: 'either' } option and filter successes."
  ),
  "allWith": asRemoved(
    "Use Effect.all with options instead."
  ),
  "allowInterrupt": asRemoved(
    "Use Effect.yieldNow instead."
  ),
  "annotateLogsScoped": asRemoved(
    "Use Effect.annotateLogs within a scoped context instead."
  ),
  "ap": asRemoved(
    "Use Effect.map and Effect.flatMap to apply functions instead."
  ),
  "asSomeError": asRemoved(
    "Use Effect.mapError(Option.some) instead."
  ),
  "async": asRemoved(
    "Use Effect.async is removed. Use Effect.promise or Effect.tryPromise instead."
  ),
  "asyncEffect": asRemoved(
    "Use Effect.suspend combined with Effect.promise instead."
  ),
  "awaitAllChildren": asRemoved(
    "Manage child fibers explicitly using Fiber.join or Fiber.await."
  ),
  "blocked": asRemoved(
    "The request batching API has been reworked in Effect v4."
  ),
  "cacheRequestResult": asRemoved(
    "The request batching API has been reworked in Effect v4."
  ),
  "cachedFunction": asRemoved(
    "Use Effect.cached or implement caching with a Ref instead."
  ),
  "cause": asRemoved(
    "Use Effect.matchCause or Effect.sandbox to access the cause."
  ),
  "checkInterruptible": asRemoved(
    "Interruption checking has been removed in Effect v4."
  ),
  "clock": asRemoved(
    "Use Effect.clockWith instead."
  ),
  "configProviderWith": asRemoved(
    "ConfigProvider access has been reworked in Effect v4."
  ),
  "console": asRemoved(
    "Use Effect.consoleWith or the Console service directly."
  ),
  "consoleWith": asRemoved(
    "Console access has been reworked in Effect v4."
  ),
  "context": asRemoved(
    "Use Effect.context is removed. Access services directly via yield* or Effect.provideService."
  ),
  "contextWith": asRemoved(
    "Use Effect.map with service access instead."
  ),
  "contextWithEffect": asRemoved(
    "Use Effect.flatMap with service access instead."
  ),
  "custom": asRemoved(
    "Use Effect.suspend or Effect.sync to create custom effects."
  ),
  "daemonChildren": asRemoved(
    "Use Effect.forkDetach to fork detached fibers instead."
  ),
  "descriptor": asRemoved(
    "Fiber descriptor access has been removed in Effect v4."
  ),
  "descriptorWith": asRemoved(
    "Fiber descriptor access has been removed in Effect v4."
  ),
  "dieMessage": asRemoved(
    "Use Effect.die(new Error(message)) instead."
  ),
  "dieSync": asRemoved(
    "Use Effect.die with a lazily evaluated value instead."
  ),
  "diffFiberRefs": asRemoved(
    "FiberRef has been replaced by ServiceMap.Reference in Effect v4."
  ),
  "disconnect": asRemoved(
    "Fiber disconnect has been removed in Effect v4."
  ),
  "dropUntil": asRemoved(
    "Use Array.dropUntil and Effect.forEach instead."
  ),
  "dropWhile": asRemoved(
    "Use Array.dropWhile and Effect.forEach instead."
  ),
  "either": asRemoved(
    "Use Effect.exit or Effect.match instead of Effect.either."
  ),
  "ensureErrorType": asRemoved(
    "Type assertion helpers have been removed in Effect v4."
  ),
  "ensureRequirementsType": asRemoved(
    "Type assertion helpers have been removed in Effect v4."
  ),
  "ensureSuccessType": asRemoved(
    "Type assertion helpers have been removed in Effect v4."
  ),
  "ensuringChild": asRemoved(
    "Use Effect.onExit to manage child fiber cleanup instead."
  ),
  "ensuringChildren": asRemoved(
    "Use Effect.onExit to manage child fiber cleanup instead."
  ),
  "every": asRemoved(
    "Use Effect.forEach with a predicate check instead."
  ),
  "exists": asRemoved(
    "Use Effect.forEach with a predicate check instead."
  ),
  "fiberIdWith": asRemoved(
    "Use Effect.fiberId instead."
  ),
  "filterEffectOrElse": asRemoved(
    "Use Effect.filterOrElse with an effectful predicate instead."
  ),
  "filterEffectOrFail": asRemoved(
    "Use Effect.filterOrFail with an effectful predicate instead."
  ),
  "filterOrDie": asRemoved(
    "Use Effect.filterOrFail and Effect.orDie instead."
  ),
  "filterOrDieMessage": asRemoved(
    "Use Effect.filterOrFail and Effect.orDie instead."
  ),
  "finalizersMask": asRemoved(
    "Finalizer masking has been removed in Effect v4."
  ),
  "findFirst": asRemoved(
    "Use Effect.forEach with early return instead."
  ),
  "firstSuccessOf": asRemoved(
    "Use Effect.raceAll instead."
  ),
  "flipWith": asRemoved(
    "Use Effect.flip combined with the desired transformation instead."
  ),
  "fromFiber": asRemoved(
    "Use Fiber.join instead."
  ),
  "fromFiberEffect": asRemoved(
    "Use Effect.flatMap with Fiber.join instead."
  ),
  "fromNullable": asRemoved(
    "Use Effect.suspend with null checks instead."
  ),
  "functionWithSpan": asRemoved(
    "Use Effect.withSpan instead."
  ),
  "getFiberRefs": asRemoved(
    "FiberRef has been replaced by ServiceMap.Reference in Effect v4."
  ),
  "getRuntimeFlags": asRemoved(
    "Runtime flags have been removed in Effect v4."
  ),
  "head": asRemoved(
    "Use Array.head and Effect.flatMap instead."
  ),
  "if": asRemoved(
    "Use Effect.when instead of Effect.if."
  ),
  "ignoreLogged": asRemoved(
    "Logging configuration has been reworked in Effect v4."
  ),
  "inheritFiberRefs": asRemoved(
    "FiberRef has been replaced by ServiceMap.Reference in Effect v4."
  ),
  "interruptWith": asRemoved(
    "Use Effect.interrupt instead."
  ),
  "intoDeferred": asRemoved(
    "Use Deferred.complete instead."
  ),
  "iterate": asRemoved(
    "Use Effect.whileLoop or recursion with Effect.suspend instead."
  ),
  "labelMetrics": asRemoved(
    "Metric labeling has been reworked in Effect v4."
  ),
  "labelMetricsScoped": asRemoved(
    "Metric labeling has been reworked in Effect v4."
  ),
  "liftPredicate": asRemoved(
    "Use Effect.filterOrFail instead."
  ),
  "linkSpanCurrent": asRemoved(
    "Use Effect.linkSpans instead."
  ),
  "locally": asRemoved(
    "FiberRef.locally has been removed. Use Effect.provideService with ServiceMap.Reference instead."
  ),
  "locallyScoped": asRemoved(
    "FiberRef.locally has been removed. Use Effect.provideService with ServiceMap.Reference instead."
  ),
  "locallyScopedWith": asRemoved(
    "FiberRef.locally has been removed. Use Effect.provideService with ServiceMap.Reference instead."
  ),
  "locallyWith": asRemoved(
    "FiberRef.locally has been removed. Use Effect.provideService with ServiceMap.Reference instead."
  ),
  "logAnnotations": asRemoved(
    "Use Effect.annotateLogs instead."
  ),
  "loop": asRemoved(
    "Use Effect.whileLoop or recursion with Effect.suspend instead."
  ),
  "mapAccum": asRemoved(
    "Use Effect.gen with a mutable accumulator instead."
  ),
  "mapErrorCause": asRemoved(
    "Use Effect.sandbox and Effect.mapError instead."
  ),
  "mapInputContext": asRemoved(
    "Use Effect.provide with a layer instead."
  ),
  "merge": asRemoved(
    "Use Effect.match or Effect.exit instead."
  ),
  "mergeAll": asRemoved(
    "Use Effect.forEach with a mutable accumulator instead."
  ),
  "metricLabels": asRemoved(
    "Metric labeling has been reworked in Effect v4."
  ),
  "negate": asRemoved(
    "Use Effect.map with boolean negation instead."
  ),
  "none": asRemoved(
    "Use Effect.filterOrFail or Effect.option instead."
  ),
  "once": asRemoved(
    "Use Effect.cached instead."
  ),
  "optionFromOptional": asRemoved(
    "Use Effect.option instead."
  ),
  "orDieWith": asRemoved(
    "Use Effect.orDie or Effect.mapError combined with Effect.orDie instead."
  ),
  "orElse": asRemoved(
    "Use Effect.catch or Effect.matchEffect instead."
  ),
  "orElseFail": asRemoved(
    "Use Effect.mapError instead."
  ),
  "parallelErrors": asRemoved(
    "Use Effect.all with concurrency options instead."
  ),
  "parallelFinalizers": asRemoved(
    "Finalizer ordering configuration has been removed in Effect v4."
  ),
  "partition": asRemoved(
    "Use Effect.forEach with Either or Exit to partition results."
  ),
  "patchFiberRefs": asRemoved(
    "FiberRef has been replaced by ServiceMap.Reference in Effect v4."
  ),
  "patchRuntimeFlags": asRemoved(
    "Runtime flags have been removed in Effect v4."
  ),
  "raceWith": asRemoved(
    "Use Effect.race or Effect.raceFirst instead."
  ),
  "random": asRemoved(
    "Use Effect.randomWith instead."
  ),
  "randomWith": asRemoved(
    "Random access has been reworked in Effect v4."
  ),
  "reduce": asRemoved(
    "Use Effect.forEach with a mutable accumulator or Effect.gen instead."
  ),
  "reduceEffect": asRemoved(
    "Use Effect.forEach with a mutable accumulator or Effect.gen instead."
  ),
  "reduceRight": asRemoved(
    "Use Effect.forEach with a mutable accumulator or Effect.gen instead."
  ),
  "reduceWhile": asRemoved(
    "Use Effect.gen with early return instead."
  ),
  "repeatN": asRemoved(
    "Use Effect.repeat with a schedule instead."
  ),
  "runRequestBlock": asRemoved(
    "The request batching API has been reworked in Effect v4."
  ),
  "scheduleForked": asRemoved(
    "Use Effect.schedule combined with Effect.forkChild instead."
  ),
  "scopeWith": asRemoved(
    "Use Effect.scopedWith or Effect.scope instead."
  ),
  "sequentialFinalizers": asRemoved(
    "Finalizer ordering configuration has been removed in Effect v4."
  ),
  "serviceConstants": asRemoved(
    "Service helpers have been removed. Use ServiceMap.Service and yield* to access services."
  ),
  "serviceFunction": asRemoved(
    "Service helpers have been removed. Use ServiceMap.Service and yield* to access services."
  ),
  "serviceFunctionEffect": asRemoved(
    "Service helpers have been removed. Use ServiceMap.Service and yield* to access services."
  ),
  "serviceFunctions": asRemoved(
    "Service helpers have been removed. Use ServiceMap.Service and yield* to access services."
  ),
  "serviceMembers": asRemoved(
    "Service helpers have been removed. Use ServiceMap.Service and yield* to access services."
  ),
  "serviceOptional": asRemoved(
    "Use Effect.serviceOption instead."
  ),
  "setFiberRefs": asRemoved(
    "FiberRef has been replaced by ServiceMap.Reference in Effect v4."
  ),
  "step": asRemoved(
    "The request batching API has been reworked in Effect v4."
  ),
  "summarized": asRemoved(
    "Use Effect.gen to capture before/after state instead."
  ),
  "supervised": asRemoved(
    "Supervision has been reworked in Effect v4."
  ),
  "tagMetrics": asRemoved(
    "Metric labeling has been reworked in Effect v4."
  ),
  "tagMetricsScoped": asRemoved(
    "Metric labeling has been reworked in Effect v4."
  ),
  "takeUntil": asRemoved(
    "Use Array.takeUntil and Effect.forEach instead."
  ),
  "takeWhile": asRemoved(
    "Use Array.takeWhile and Effect.forEach instead."
  ),
  "tapBoth": asRemoved(
    "Use Effect.tap and Effect.tapError instead."
  ),
  "tapErrorCause": asRemoved(
    "Use Effect.sandbox and Effect.tapError instead."
  ),
  "timedWith": asRemoved(
    "Use Effect.timed instead."
  ),
  "timeoutFail": asRemoved(
    "Use Effect.timeout combined with Effect.catchTag for TimeoutException instead."
  ),
  "timeoutFailCause": asRemoved(
    "Use Effect.timeout combined with Effect.sandbox instead."
  ),
  "timeoutTo": asRemoved(
    "Use Effect.timeoutOption and Effect.map instead."
  ),
  "tracerWith": asRemoved(
    "Use Effect.tracer instead."
  ),
  "transplant": asRemoved(
    "Fiber transplanting has been removed in Effect v4."
  ),
  "transposeMapOption": asRemoved(
    "Use Effect.map with Option operations instead."
  ),
  "transposeOption": asRemoved(
    "Use Effect.option instead."
  ),
  "tryMap": asRemoved(
    "Use Effect.map inside Effect.try instead."
  ),
  "tryMapPromise": asRemoved(
    "Use Effect.tryPromise instead."
  ),
  "unless": asRemoved(
    "Use Effect.when with a negated condition instead."
  ),
  "unlessEffect": asRemoved(
    "Use Effect.when with a negated effectful condition instead."
  ),
  "unsafeMakeLatch": asRemoved(
    "Use Effect.makeLatch instead."
  ),
  "unsafeMakeSemaphore": asRemoved(
    "Use Effect.makeSemaphore instead."
  ),
  "unsandbox": asRemoved(
    "Use Effect.catchCause instead."
  ),
  "updateFiberRefs": asRemoved(
    "FiberRef has been replaced by ServiceMap.Reference in Effect v4."
  ),
  "using": asRemoved(
    "Use Effect.scoped instead."
  ),
  "validate": asRemoved(
    "Use Effect.all with { mode: 'validate' } instead."
  ),
  "validateAll": asRemoved(
    "Use Effect.all with { mode: 'validate' } instead."
  ),
  "validateFirst": asRemoved(
    "Use Effect.all with { mode: 'validate' } instead."
  ),
  "validateWith": asRemoved(
    "Use Effect.all with { mode: 'validate' } instead."
  ),
  "whenEffect": asRemoved(
    "Use Effect.when with an effectful condition via Effect.flatMap instead."
  ),
  "whenFiberRef": asRemoved(
    "FiberRef has been replaced by ServiceMap.Reference in Effect v4."
  ),
  "whenLogLevel": asRemoved(
    "Log level checking has been reworked in Effect v4."
  ),
  "whenRef": asRemoved(
    "Use Ref.get and Effect.when instead."
  ),
  "withClock": asRemoved(
    "Clock configuration has been reworked in Effect v4."
  ),
  "withClockScoped": asRemoved(
    "Clock configuration has been reworked in Effect v4."
  ),
  "withConfigProvider": asRemoved(
    "ConfigProvider configuration has been reworked in Effect v4."
  ),
  "withConfigProviderScoped": asRemoved(
    "ConfigProvider configuration has been reworked in Effect v4."
  ),
  "withConsole": asRemoved(
    "Console configuration has been reworked in Effect v4."
  ),
  "withConsoleScoped": asRemoved(
    "Console configuration has been reworked in Effect v4."
  ),
  "withEarlyRelease": asRemoved(
    "Use Effect.scoped with manual resource management instead."
  ),
  "withFiberRuntime": asRemoved(
    "Direct fiber runtime access has been removed in Effect v4."
  ),
  "withMaxOpsBeforeYield": asRemoved(
    "Use ServiceMap.Reference for MaxOpsBeforeYield configuration instead."
  ),
  "withMetric": asRemoved(
    "Metric configuration has been reworked in Effect v4."
  ),
  "withRandom": asRemoved(
    "Random configuration has been reworked in Effect v4."
  ),
  "withRandomFixed": asRemoved(
    "Random configuration has been reworked in Effect v4."
  ),
  "withRandomScoped": asRemoved(
    "Random configuration has been reworked in Effect v4."
  ),
  "withRequestBatching": asRemoved(
    "Request batching configuration has been reworked in Effect v4."
  ),
  "withRequestCache": asRemoved(
    "Request caching configuration has been reworked in Effect v4."
  ),
  "withRequestCaching": asRemoved(
    "Request caching configuration has been reworked in Effect v4."
  ),
  "withRuntimeFlagsPatch": asRemoved(
    "Runtime flags have been removed in Effect v4."
  ),
  "withRuntimeFlagsPatchScoped": asRemoved(
    "Runtime flags have been removed in Effect v4."
  ),
  "withScheduler": asRemoved(
    "Use ServiceMap.Reference for Scheduler configuration instead."
  ),
  "withSchedulingPriority": asRemoved(
    "Scheduling priority configuration has been removed in Effect v4."
  ),
  "withTracerScoped": asRemoved(
    "Use Effect.withTracer instead."
  ),
  "withUnhandledErrorLogLevel": asRemoved(
    "Use ServiceMap.Reference for UnhandledLogLevel configuration instead."
  ),
  "zipLeft": asRemoved(
    "Use Effect.tap instead of Effect.zipLeft."
  ),
  "zipRight": asRemoved(
    "Use Effect.andThen instead of Effect.zipRight."
  )
}

export const outdatedApi = LSP.createDiagnostic({
  name: "outdatedApi",
  code: 19,
  description: "Detects when generated code is outdated and needs to be regenerated",
  severity: "warning",
  apply: Nano.fn("outdatedEffectCodegen.apply")(function*(sourceFile, report) {
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    if (typeParser.supportedEffect() === "v3") return

    const checkPropertyAccessMigration = <A, E, R>(
      propertyAccess: ts.Node,
      checkRightNode: (node: ts.Node) => Nano.Nano<A, E, R>,
      migrationDb: ModuleMigrationDb
    ) => {
      if (!ts.isPropertyAccessExpression(propertyAccess)) return
      const identifier = propertyAccess.name
      if (!ts.isIdentifier(identifier)) return
      const identifierName = ts.idText(identifier)
      const migration = migrationDb[identifierName]
      if (!migration) return
      // skip unchanged migrations
      if (migration._tag === "Unchanged") return
      // should not exist in target type
      const targetType = typeCheckerUtils.getTypeAtLocation(propertyAccess.expression)
      if (!targetType) return
      // only if the property does not exists in the target type
      const targetPropertySymbol = typeChecker.getPropertyOfType(targetType, identifierName)
      if (targetPropertySymbol) return
      return pipe(
        checkRightNode(propertyAccess.expression),
        Nano.map(() => {
          if (migration._tag === "RenamedSameBehaviour" || migration._tag === "RenamedAndNeedsOptions") {
            report({
              location: propertyAccess.name,
              messageText: `Effect v3's "${identifierName}" has been renamed to "${migration.newName}" in Effect v4. ${
                migration._tag === "RenamedAndNeedsOptions" ? migration.optionsInstructions : ""
              }`,
              fixes: [{
                fixName: "outdatedApi_fix",
                description: `Replace "${identifierName}" with "${migration.newName}"`,
                apply: Nano.gen(function*() {
                  const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
                  changeTracker.deleteRange(sourceFile, {
                    pos: ts.getTokenPosOfNode(propertyAccess.name, sourceFile),
                    end: propertyAccess.name.end
                  })
                  changeTracker.insertText(
                    sourceFile,
                    propertyAccess.name.end,
                    migration.newName
                  )
                })
              }]
            })
          } else if (migration._tag === "Removed") {
            report({
              location: propertyAccess.name,
              messageText:
                `Effect v3's "${identifierName}" has been removed in Effect v4. ${migration.alternativePattern}`,
              fixes: []
            })
          }
        })
      )
    }

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      const checkEffectMigration = checkPropertyAccessMigration(
        node,
        typeParser.importedEffectModule,
        effectModuleMigrationDb
      )
      if (checkEffectMigration) {
        yield* Nano.ignore(checkEffectMigration)
      }
    }
  })
})
