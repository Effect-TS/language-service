import * as Either from "effect/Either"
import { dual } from "effect/Function"
import type { TypeLambda } from "effect/HKT"
import * as Option from "effect/Option"
import * as Gen from "effect/Utils"

export class NanoTag<R> {
  declare "~nano.requirements": R
  constructor(
    readonly key: string
  ) {}
}

export const Tag = <I = never>(identifier: string) => new NanoTag<I>(identifier)

export interface NanoIterator<T extends Nano<any, any, any>> {
  next(...args: ReadonlyArray<any>): IteratorResult<Gen.YieldWrap<T>, T["~nano.success"]>
}

export interface NanoTypeLambda extends TypeLambda {
  readonly type: Nano<this["Target"], this["Out1"], this["Out2"]>
}

const evaluate = Symbol.for("Nano.evaluate")
const contA = Symbol.for("Nano.contA")
type contA = typeof contA
const contE = Symbol.for("Nano.contE")
type contE = typeof contE
const contAll = Symbol.for("Nano.contAll")
type contAll = typeof contAll
const NanoYield = Symbol.for("Nano.yield")
type NanoYield = typeof NanoYield
const args = Symbol.for("Nano.args")
type args = typeof args

export class NanoDefectException {
  readonly _tag = "@effect/language-service/NanoDefectException"
  constructor(
    readonly message: unknown
  ) {}
}

interface NanoPrimitive {
  [args]?: any
  [contA]?: (value: any, fiber: NanoFiber) => NanoPrimitive | NanoYield
  [contE]?: (value: any, fiber: NanoFiber) => NanoPrimitive | NanoYield
  [contAll]?: (fiber: NanoFiber) => NanoPrimitive | NanoYield
  [evaluate]: (fiber: NanoFiber) => NanoPrimitive | NanoYield
  [Symbol.iterator](): NanoIterator<Nano<any, any, any>>
}

type NanoExit =
  & NanoPrimitive
  & ({
    _tag: "Success"
    value: any
  } | {
    _tag: "Failure"
    value: any
  })

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
export interface Nano<out A = never, out E = never, out R = never> extends NanoPrimitive {
  readonly "~nano.success": A
  readonly "~nano.error": E
  readonly "~nano.requirements": R
  [Symbol.iterator](): NanoIterator<Nano<A, E, R>>
}

const PrimitiveProto: Pick<NanoPrimitive, typeof Symbol.iterator> = {
  [Symbol.iterator]() {
    return new Gen.SingleShotGen(new Gen.YieldWrap(this as any as Nano<any, any, any>))
  }
}

const SucceedProto: NanoPrimitive & NanoExit = {
  ...PrimitiveProto,
  _tag: "Success",
  get value() {
    return this[args]
  },
  [evaluate](fiber: NanoFiber) {
    const cont = fiber.getCont(contA)
    return cont ? cont[contA](this[args], fiber) : fiber.yieldWith(this)
  }
}
export const succeed: <A>(value: A) => Nano<A, never, never> = <A>(value: A) => {
  const nano = Object.create(SucceedProto)
  nano[args] = value
  return nano
}

const FailureProto: NanoPrimitive & NanoExit = {
  ...PrimitiveProto,
  _tag: "Failure",
  get value() {
    return this[args]
  },
  [evaluate](fiber: NanoFiber) {
    const cont = fiber.getCont(contE)
    return cont ? cont[contE](this[args], fiber) : fiber.yieldWith(this)
  }
}
export const fail: <E>(error: E) => Nano<never, E, never> = <E>(error: E) => {
  const nano = Object.create(FailureProto)
  nano[args] = error
  return nano
}

const SuspendProto: NanoPrimitive = {
  ...PrimitiveProto,
  [evaluate]() {
    return this[args]()
  }
}
export const suspend: <A, E, R>(fn: () => Nano<A, E, R>) => Nano<A, E, R> = <A, E, R>(fn: () => Nano<A, E, R>) => {
  const nano = Object.create(SuspendProto)
  nano[args] = fn
  return nano
}

class NanoFiber {
  readonly _stack: Array<NanoPrimitive> = []
  _yielded: NanoExit | undefined = undefined
  _services: Record<string, any> = {}

  runLoop(nano: Nano<any, any, any>) {
    let current: NanoPrimitive | NanoYield = nano
    while (true) {
      current = (current as any)[evaluate](this)
      if (current === NanoYield) {
        return this._yielded
      }
    }
  }

  getCont<S extends contA | contE>(this: NanoFiber, symbol: S):
    | (NanoPrimitive & Record<S, (value: any, fiber: NanoFiber) => NanoPrimitive>)
    | undefined
  {
    while (true) {
      const op = this._stack.pop()
      if (!op) return undefined
      const cont = op[contAll] && op[contAll](this)
      if (cont) return { [symbol]: cont } as any
      if (op[symbol]) return op as any
    }
  }

  yieldWith(this: NanoFiber, value: NanoExit): NanoYield {
    this._yielded = value
    return NanoYield
  }
}

export const unsafeRun = <A, E>(nano: Nano<A, E, never>): Either.Either<A, E | NanoDefectException> => {
  const fiber = new NanoFiber()
  const result = fiber.runLoop(nano)!
  if (result._tag === "Success") {
    return Either.right(result.value)
  }
  return Either.left(result.value)
}

export const run = <A, E>(nano: Nano<A, E, never>): Either.Either<A, E | NanoDefectException> => {
  try {
    return unsafeRun(nano)
  } catch (e) {
    return Either.left(new NanoDefectException(e))
  }
}

const OnSuccessProto: NanoPrimitive = {
  ...PrimitiveProto,
  [evaluate](fiber: NanoFiber) {
    fiber._stack.push(this)
    return this[args]
  }
}

export const flatMap: {
  <A, B, E2, R2>(f: (a: A) => Nano<B, E2, R2>): <E, R>(fa: Nano<A, E, R>) => Nano<B, E | E2, R | R2>
  <A, E, R, B, E2, R2>(fa: Nano<A, E, R>, f: (a: A) => Nano<B, E2, R2>): Nano<B, E | E2, R | R2>
} = dual(2, <A, E, R, B, E2, R2>(
  fa: Nano<A, E, R>,
  f: (a: A) => Nano<B, E2, R2>
) => {
  const nano = Object.create(OnSuccessProto)
  nano[args] = fa
  nano[contA] = f
  return nano
})

export const map: {
  <A, B>(f: (a: A) => B): <E, R>(fa: Nano<A, E, R>) => Nano<B, E, R>
  <A, E, R, B>(fa: Nano<A, E, R>, f: (a: A) => B): Nano<B, E, R>
} = dual(2, <A, E, R, B>(
  fa: Nano<A, E, R>,
  f: (a: A) => B
) => flatMap(fa, (_) => succeed(f(_))))

const SyncProto: NanoPrimitive = {
  ...PrimitiveProto,
  [evaluate](fiber) {
    const value = this[args]()
    const cont = fiber.getCont(contA)
    return cont
      ? cont[contA](value, fiber)
      : fiber.yieldWith(succeed(value) as any)
  }
}

export const sync = <A>(f: () => A): Nano<A, never, never> => {
  const nano = Object.create(SyncProto)
  nano[args] = f
  return nano
}

export const void_ = succeed(undefined)

const FromIteratorProto: NanoPrimitive = {
  ...PrimitiveProto,
  [contA](value, fiber) {
    const state = this[args][0].next(value)
    if (state.done) return succeed(state.value)
    fiber._stack.push(this)
    return Gen.yieldWrapGet(state.value)
  },
  [evaluate](this: any, fiber: NanoFiber) {
    return this[contA](this[args][1], fiber)
  }
}

const unsafeFromIterator = (
  iterator: Iterator<Gen.YieldWrap<Nano<any, any, any>>>,
  initial?: undefined
) => {
  const nano = Object.create(FromIteratorProto)
  nano[args] = [iterator, initial]
  return nano
}

export const gen = <Eff extends Gen.YieldWrap<Nano<any, any, any>>, AEff>(
  ...args: [body: () => Generator<Eff, AEff, never>]
): Nano<
  AEff,
  [Eff] extends [never] ? never
    : [Eff] extends [Gen.YieldWrap<Nano<infer _A, infer E, infer _R>>] ? E
    : never,
  [Eff] extends [never] ? never
    : [Eff] extends [Gen.YieldWrap<Nano<infer _A, infer _E, infer R>>] ? R
    : never
> => suspend(() => unsafeFromIterator(args[0]()))

export const fn = (_: string) =>
<Eff extends Gen.YieldWrap<Nano<any, any, any>>, AEff, Args extends Array<any>>(
  body: (...args: Args) => Generator<Eff, AEff, never>
) =>
(...args: Args): Nano<
  AEff,
  [Eff] extends [never] ? never
    : [Eff] extends [Gen.YieldWrap<Nano<infer _A, infer E, infer _R>>] ? E
    : never,
  [Eff] extends [never] ? never
    : [Eff] extends [Gen.YieldWrap<Nano<infer _A, infer _E, infer R>>] ? R
    : never
> => suspend(() => unsafeFromIterator(body(...args)))

const MatchProto: NanoPrimitive = {
  ...PrimitiveProto,
  [evaluate](fiber) {
    fiber._stack.push(this)
    return this[args]
  }
}

export const match = <A, B, E, R, C, E2, R2, E3, R3>(
  fa: Nano<A, E, R>,
  opts: {
    onSuccess: (a: A) => Nano<B, E2, R2>
    onFailure: (e: E) => Nano<C, E3, R3>
  }
): Nano<B, E | E2 | E3, R | R2 | R3> => {
  const nano = Object.create(MatchProto)
  nano[args] = fa
  nano[contA] = opts.onSuccess
  nano[contE] = opts.onFailure
  return nano
}

export const orElse = <E, B, E2, R2>(
  f: (e: E) => Nano<B, E2, R2>
) =>
<A, R>(fa: Nano<A, E, R>): Nano<A | B, E2, R | R2> => {
  const nano = Object.create(MatchProto)
  nano[args] = fa
  nano[contE] = f
  return nano
}

export const firstSuccessOf = <A extends Array<Nano<any, any, any>>>(
  arr: A
): Nano<A[number]["~nano.success"], A[number]["~nano.error"], A[number]["~nano.requirements"]> =>
  arr.slice(1).reduce((arr, fa) => orElse(() => fa)(arr), arr[0])

const ProvideServiceProto: NanoPrimitive = {
  ...PrimitiveProto,
  [evaluate](fiber) {
    const prevServices = fiber._services
    const [fa, tag, value]: [Nano<any, any, any>, NanoTag<any>, any] = this[args]
    fiber._services = {
      ...fiber._services,
      [tag.key]: value
    }
    return match(fa, {
      onSuccess: (_) => {
        fiber._services = prevServices
        return succeed(_)
      },
      onFailure: (_) => {
        fiber._services = prevServices
        return fail(_)
      }
    })
  }
}

export const provideService = <I extends NanoTag<any>>(
  tag: I,
  value: I["~nano.requirements"]
) =>
<A, E, R>(fa: Nano<A, E, R>): Nano<A, E, Exclude<R, I["~nano.requirements"]>> => {
  const nano = Object.create(ProvideServiceProto)
  nano[args] = [fa, tag, value]
  return nano
}

const ServiceProto: NanoPrimitive = {
  ...PrimitiveProto,
  [evaluate](fiber) {
    const tag: NanoTag<any> = this[args]
    if (tag.key in fiber._services) {
      const value = fiber._services[tag.key]
      const cont = fiber.getCont(contA)
      return cont ? cont[contA](value, fiber) : fiber.yieldWith(succeed(value) as any)
    }
    const cont = fiber.getCont(contE)
    return cont
      ? cont[contE](tag, fiber)
      : fiber.yieldWith(fail(new NanoDefectException(`Service ${tag.key} not found`)) as any)
  }
}

export const service = <I extends NanoTag<any>>(
  tag: I
): Nano<I["~nano.requirements"], never, I["~nano.requirements"]> => {
  const nano = Object.create(ServiceProto)
  nano[args] = tag
  return nano
}

export function cachedBy<P extends Array<any>, A, E, R>(
  fa: (...args: P) => Nano<A, E, R>,
  _key: string,
  _lookupKey: (...args: P) => object
) {
  return (...args: P): Nano<A, E, R> => fa(...args)
}

export const option = <A, E, R>(fa: Nano<A, E, R>): Nano<Option.Option<A>, never, R> => {
  const nano = Object.create(MatchProto)
  nano[args] = fa
  nano[contA] = (_: A) => succeed(Option.some(_))
  nano[contE] = (_: E | NanoDefectException) => _ instanceof NanoDefectException ? fail(_) : succeed(Option.none())
  return nano
}

export const ignore = <A, E, R>(fa: Nano<A, E, R>): Nano<void, never, R> => {
  const nano = Object.create(MatchProto)
  nano[args] = fa
  nano[contA] = (_: A) => void_
  nano[contE] = (_: E | NanoDefectException) => _ instanceof NanoDefectException ? fail(_) : void_
  return nano
}

export const all: <A extends Array<Nano<any, any, any>>>(
  ...args: A
) => Nano<Array<A[number]["~nano.success"]>, A[number]["~nano.error"], A[number]["~nano.requirements"]> = fn("all")(
  function*<A extends Array<Nano<any, any, any>>>(
    ...args: A
  ) {
    const results = [] as Array<A[number]["~nano.success"]>
    for (const fa of args) {
      const result = yield* fa
      results.push(result)
    }
    return results
  }
)

export const getTimings = () => [] as Array<string>
