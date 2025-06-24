import * as Either from "effect/Either"
import { dual } from "effect/Function"
import type { TypeLambda } from "effect/HKT"
import * as Option from "effect/Option"
import * as Gen from "effect/Utils"

const NanoInternalSuccessProto = {
  _tag: "Right"
}

interface NanoInternalSuccess<A> {
  _tag: "Right"
  value: A
}

function makeInternalSuccess<A>(value: A): NanoExit<A, never> {
  const result = Object.create(NanoInternalSuccessProto)
  result.value = value
  return result
}

const NanoInternalFailureProto = {
  _tag: "Left"
}

interface NanoInternalFailure<E> {
  _tag: "Left"
  value: E
}

function makeInternalFailure<E>(value: E): NanoExit<never, E> {
  const result = Object.create(NanoInternalFailureProto)
  result.value = value
  return result
}

const NanoInternalDefectProto = {
  _tag: "Defect"
}

interface NanoInternalDefect {
  _tag: "Defect"
  value: unknown
}

function makeInternalDefect(value: unknown): NanoExit<never, never> {
  const result = Object.create(NanoInternalDefectProto)
  result.value = value
  return result
}

type NanoExit<A, E> =
  | NanoInternalSuccess<A>
  | NanoInternalFailure<E>
  | NanoInternalDefect

export class NanoDefectException {
  readonly _tag = "@effect/language-service/NanoDefectException"
  constructor(
    readonly message: unknown
  ) {}
}

export class NanoTag<R> {
  declare "~nano.requirements": R
  constructor(
    readonly key: string
  ) {}
}

export const Tag = <I = never>(identifier: string) => new NanoTag<I>(identifier)

type NanoContext<R = never> = {
  _R: R
  value: Record<string, unknown>
}

export const contextEmpty: NanoContext<never> = { value: {} } as any

export interface NanoIterator<T extends Nano<any, any, any>> {
  next(...args: ReadonlyArray<any>): IteratorResult<Gen.YieldWrap<T>, T["~nano.success"]>
}

export interface NanoTypeLambda extends TypeLambda {
  readonly type: Nano<this["Target"], this["Out1"], this["Out2"]>
}

/**
 * Nano is a Effect-like interface to run things.
 * It is not intended to be used by users in production.
 * It's only a mere tool to be used in the Effect dev-tools
 * to provide a familiar effect-like experience in envs
 * where using full blown Effect will cause an Effect-in-Effect issue.
 * It is supposed to be sync only and not stack-safe.
 * Thrown exceptions are catched and converted into defects,
 * so worst case scenario, you will get only standard typescript lsp.
 */
export interface Nano<out A = never, out E = never, out R = never> {
  readonly "~nano.success": A
  readonly "~nano.error": E
  readonly "~nano.requirements": R
  [Symbol.iterator](): NanoIterator<Nano<A, E, R>>
  run: (
    ctx: NanoContext<unknown>
  ) => NanoExit<A, E>
}

const Proto = {
  run: () => {},

  [Symbol.iterator]() {
    return new Gen.SingleShotGen(new Gen.YieldWrap(this))
  }
}

function make<A, E, R>(
  run: (
    ctx: NanoContext<unknown>
  ) => NanoExit<A, E>
): Nano<A, E, R> {
  const result = Object.create(Proto)
  result.run = run
  return result
}

export const unsafeRun = <A, E>(
  fa: Nano<A, E, never>
): Either.Either<A, E | NanoDefectException> => {
  const program = provideService(internalNanoCache, {})(fa)
  const result = program.run(contextEmpty)
  switch (result._tag) {
    case "Left":
      return Either.left(result.value)
    case "Defect":
      return Either.left(new NanoDefectException(result.value))
    case "Right":
      return Either.right(result.value)
  }
}

export const run = <A, E>(fa: Nano<A, E, never>): Either.Either<A, E | NanoDefectException> => {
  try {
    return unsafeRun(fa)
  } catch (e) {
    return Either.left(new NanoDefectException(e))
  }
}

export const succeed = <A>(value: A) => make<A, never, never>(() => makeInternalSuccess(value))
export const fail = <E>(value: E) => make<never, E, never>(() => makeInternalFailure(value))
export const sync = <A>(value: () => A) => make<A, never, never>(() => makeInternalSuccess(value()))
export const flatMap: {
  <A, B, E2, R2>(f: (a: A) => Nano<B, E2, R2>): <E, R>(fa: Nano<A, E, R>) => Nano<B, E | E2, R | R2>
  <A, E, R, B, E2, R2>(fa: Nano<A, E, R>, f: (a: A) => Nano<B, E2, R2>): Nano<B, E | E2, R | R2>
} = dual(2, <A, E, R, B, E2, R2>(
  fa: Nano<A, E, R>,
  f: (a: A) => Nano<B, E2, R2>
) =>
  make<B, E | E2, R | R2>((ctx) => {
    const result = fa.run(ctx)
    if (result._tag !== "Right") return result
    return f(result.value).run(ctx)
  }))

export const map: {
  <A, B>(f: (a: A) => B): <E, R>(fa: Nano<A, E, R>) => Nano<B, E, R>
  <A, E, R, B>(fa: Nano<A, E, R>, f: (a: A) => B): Nano<B, E, R>
} = dual(2, <A, E, R, B>(
  fa: Nano<A, E, R>,
  f: (a: A) => B
) =>
  make<B, E, R>((ctx) => {
    const result = fa.run(ctx)
    if (result._tag !== "Right") return result
    return makeInternalSuccess(f(result.value))
  }))

export const orElse = <E, B, E2, R2>(
  f: (e: E) => Nano<B, E2, R2>
) =>
<A, R>(fa: Nano<A, E, R>) =>
  make<A | B, E2, R | R2>((ctx) => {
    const result = fa.run(ctx)
    if (result._tag === "Left") return f(result.value).run(ctx)
    return result
  })

export const firstSuccessOf = <A extends Array<Nano<any, any, any>>>(
  arr: A
): Nano<A[number]["~nano.success"], A[number]["~nano.error"], A[number]["~nano.requirements"]> =>
  arr.slice(1).reduce((arr, fa) => orElse(() => fa)(arr), arr[0])

export const service = <I extends NanoTag<any>>(tag: I) =>
  make<I["~nano.requirements"], never, I["~nano.requirements"]>((ctx) =>
    (tag.key in ctx.value)
      ? (ctx.value[tag.key] as NanoExit<I["~nano.requirements"], never>)
      : makeInternalDefect(`Cannot find service ${tag.key}`)
  )

export const provideService = <I extends NanoTag<any>>(
  tag: I,
  value: I["~nano.requirements"]
) =>
<A, E, R>(fa: Nano<A, E, R>) =>
  make<A, E, Exclude<R, I["~nano.requirements"]>>((ctx) => {
    return fa.run({
      ...ctx,
      value: {
        ...ctx.value,
        [tag.key]: makeInternalSuccess(value)
      }
    })
  })

export const gen = <Eff extends Gen.YieldWrap<Nano<any, any, any>>, AEff>(
  ...args: [body: () => Generator<Eff, AEff, never>]
) =>
  make<
    AEff,
    [Eff] extends [never] ? never
      : [Eff] extends [Gen.YieldWrap<Nano<infer _A, infer E, infer _R>>] ? E
      : never,
    [Eff] extends [never] ? never
      : [Eff] extends [Gen.YieldWrap<Nano<infer _A, infer _E, infer R>>] ? R
      : never
  >((ctx) => {
    const iterator = args[0]()
    let state: IteratorResult<any> = iterator.next()
    while (!state.done) {
      const current = Gen.isGenKind(state.value)
        ? state.value.value
        : Gen.yieldWrapGet(state.value)
      const result: NanoExit<any, any> = current.run(ctx)
      if (result._tag !== "Right") {
        return result
      }
      state = iterator.next(result.value as never)
    }
    return makeInternalSuccess(state.value)
  })

export const fn = (_: string) =>
<Eff extends Gen.YieldWrap<Nano<any, any, any>>, AEff, Args extends Array<any>>(
  body: (...args: Args) => Generator<Eff, AEff, never>
) =>
(...args: Args) => (
  make<
    AEff,
    [Eff] extends [never] ? never
      : [Eff] extends [Gen.YieldWrap<Nano<infer _A, infer E, infer _R>>] ? E
      : never,
    [Eff] extends [never] ? never
      : [Eff] extends [Gen.YieldWrap<Nano<infer _A, infer _E, infer R>>] ? R
      : never
  >((ctx) => {
    const iterator = body(...args)
    let state: IteratorResult<any> = iterator.next()
    while (!state.done) {
      const current = Gen.isGenKind(state.value)
        ? state.value.value
        : Gen.yieldWrapGet(state.value)
      const result: NanoExit<any, any> = current.run(ctx)
      if (result._tag !== "Right") {
        return result
      }
      state = iterator.next(result.value as never)
    }
    return makeInternalSuccess(state.value)
  })
)

export const option = <A, E, R>(fa: Nano<A, E, R>) =>
  make<Option.Option<A>, never, R>((ctx) => {
    const result = fa.run(ctx)
    switch (result._tag) {
      case "Right":
        return makeInternalSuccess(Option.some(result.value))
      case "Left":
        return makeInternalSuccess(Option.none())
      case "Defect":
        return result
    }
  })

const successUndefined = makeInternalSuccess(undefined)

export const void_ = make<void, never, never>(() => successUndefined)

export const ignore = <A, E, R>(fa: Nano<A, E, R>) =>
  make<void, never, R>((ctx) => {
    fa.run(ctx)
    return successUndefined
  })

export const all = <A extends Array<Nano<any, any, any>>>(
  ...args: A
): Nano<
  Array<A[number]["~nano.success"]>,
  A[number]["~nano.error"],
  A[number]["~nano.requirements"]
> =>
  make<
    Array<A[number]["~nano.success"]>,
    A[number]["~nano.error"],
    A[number]["~nano.requirements"]
  >((ctx) => {
    const results: Array<A[number]["~nano.success"]> = []
    for (const arg of args) {
      const result = arg.run(ctx)
      if (result._tag !== "Right") return result
      results.push(result.value)
    }
    return makeInternalSuccess(results)
  })

const timings: Record<string, number> = {}
const timingsCount: Record<string, number> = {}
export const timed = (timingName: string) => <A, E, R>(fa: Nano<A, E, R>) =>
  make<A, E, R>((ctx) => {
    const start = performance.now()
    const result = fa.run(ctx)
    const end = performance.now()
    const duration = end - start
    timings[timingName] = (timings[timingName] || 0) + duration
    timingsCount[timingName] = (timingsCount[timingName] || 0) + 1
    return result
  })

export const getTimings = () => {
  const result: Array<[name: string, avg: number, hits: number, total: number]> = []
  for (const key in timings) {
    result.push([key, timings[key] / (timingsCount[key] || 1), timingsCount[key], timings[key]])
  }
  result.sort((a, b) => b[3] - a[3])
  const lines: Array<string> = []
  for (const [name, avg, hits, total] of result) {
    lines.push(
      `${name.padEnd(75)} tot ${total.toFixed(2).padStart(10)}ms avg ${avg.toFixed(2).padStart(10)}ms ${
        hits.toString().padStart(10)
      } hits`
    )
  }
  return lines
}

const internalNanoCache = Tag<Record<string, Map<any, NanoExit<any, any>>>>(
  "@effect/language-service/internalNanoCache"
)

export function cachedBy<P extends Array<any>, A, E, R>(
  fa: (...args: P) => Nano<A, E, R>,
  key: string,
  lookupKey: (...args: P) => any
) {
  return (...args: P) =>
    make<A, E, R>((ctx) => {
      const cacheObj = ctx.value[internalNanoCache.key] as Record<string, Map<any, NanoExit<any, any>>>
      const cache = cacheObj[key] || new Map<any, NanoExit<any, any>>()
      cacheObj[key] = cache
      const lookup = lookupKey(...args)
      if (cache.has(lookup)) {
        return cache.get(lookup)!
      }
      const result = fa(...args).run(ctx)
      cache.set(lookup, result)
      return result
    })
}
