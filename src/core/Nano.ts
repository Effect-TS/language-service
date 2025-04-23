import * as ReadonlyArray from "effect/Array"
import * as Data from "effect/Data"
import * as Either from "effect/Either"
import { dual, pipe } from "effect/Function"
import type { TypeLambda } from "effect/HKT"
import * as Option from "effect/Option"
import * as Gen from "effect/Utils"

export class NanoInterruptedException extends Data.TaggedError("NanoInterruptedException")<{}> {}
export class NanoDefectException
  extends Data.TaggedError("NanoDefectException")<{ value: unknown }>
{}

export class NanoTag<R> {
  declare "~nano.requirements": R
  constructor(
    readonly key: string
  ) {}
}

export const Tag = <I>(identifier: string) => new NanoTag<I>(identifier)

type NanoContext<R = never> = {
  _R: R
  value: Record<string, unknown>
}

export const contextEmpty: NanoContext<never> = { value: {} } as any
export const contextAdd = <R, I extends NanoTag<any>>(
  context: NanoContext<R>,
  tag: I,
  value: I["~nano.requirements"]
): NanoContext<R | I> => ({
  ...context,
  value: {
    ...context.value,
    [tag.key]: value
  }
})
export const contextGet = <R, I extends NanoTag<any>>(
  context: NanoContext<R | I>,
  tag: I
): Option.Option<I["~nano.requirements"]> => {
  if (tag.key in context.value) {
    return Option.some(context.value[tag.key] as I["~nano.requirements"])
  }
  return Option.none()
}
export const contextMerge = <R, R2>(
  old: NanoContext<R>,
  newContext: NanoContext<R2>
): NanoContext<R | R2> => ({ ...old, value: { ...old.value, ...newContext.value } })

export interface NanoIterator<T extends Nano<any, any, any>> {
  next(...args: ReadonlyArray<any>): IteratorResult<Gen.YieldWrap<T>, T["~nano.success"]>
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
export class Nano<out A, out E = never, out R = never> {
  declare readonly "~nano.success": A
  declare readonly "~nano.error": E
  declare readonly "~nano.requirements": R

  constructor(
    public readonly run: (
      ctx: NanoContext<unknown>
    ) => Either.Either<Either.Either<A, E>, NanoInterruptedException | NanoDefectException>
  ) {}

  [Symbol.iterator](): NanoIterator<Nano<A, E, R>> {
    return new Gen.SingleShotGen(new Gen.YieldWrap(this)) as any
  }
}

export const run = <A, E>(fa: Nano<A, E, never>) =>
  pipe(
    Either.try({
      try: () => fa.run(contextEmpty),
      catch: (error) => (new NanoDefectException({ value: error }))
    }),
    Either.flatMap((_) => _),
    Either.flatMap((_) => _)
  )

export const succeed = <A>(value: A) => new Nano(() => (Either.right(Either.right(value))))
export const fail = <E>(value: E) => new Nano(() => Either.right(Either.left(value)))
export const sync = <A>(value: () => A) => new Nano(() => Either.right(Either.right(value())))
export const flatMap: {
  <A, B, E2, R2>(f: (a: A) => Nano<B, E2, R2>): <E, R>(fa: Nano<A, E, R>) => Nano<B, E | E2, R | R2>
  <A, E, R, B, E2, R2>(fa: Nano<A, E, R>, f: (a: A) => Nano<B, E2, R2>): Nano<B, E | E2, R | R2>
} = dual(2, <A, E, R, B, E2, R2>(
  fa: Nano<A, E, R>,
  f: (a: A) => Nano<B, E2, R2>
) =>
  new Nano<B, E | E2, R | R2>((ctx) => {
    const result = fa.run(ctx)
    if (Either.isLeft(result)) return result
    if (Either.isLeft(result.right)) return result
    return f(result.right.right).run(ctx) as any
  }))

export const map: {
  <A, B>(f: (a: A) => B): <E, R>(fa: Nano<A, E, R>) => Nano<B, E, R>
  <A, E, R, B>(fa: Nano<A, E, R>, f: (a: A) => B): Nano<B, E, R>
} = dual(2, <A, E, R, B>(
  fa: Nano<A, E, R>,
  f: (a: A) => B
) =>
  new Nano<B, E, R>((ctx) => {
    const result = fa.run(ctx)
    if (Either.isLeft(result)) return result as any
    if (Either.isLeft(result.right)) return result
    return Either.right(Either.right(f(result.right.right) as B))
  }))

export const orElse = <B, E2, R2>(
  f: () => Nano<B, E2, R2>
) =>
<A, E, R>(fa: Nano<A, E, R>) =>
  new Nano<A | B, E2, R | R2>((ctx) => {
    const result = fa.run(ctx)
    if (Either.isLeft(result)) return result
    if (Either.isLeft(result.right)) return f().run(ctx) as any
    return result
  })

export const firstSuccessOf = <A extends Array<Nano<any, any, any>>>(
  arr: A
): Nano<A[number]["~nano.success"], A[number]["~nano.error"], A[number]["~nano.requirements"]> =>
  ReadonlyArray.reduce(arr.slice(1), arr[0], (arr, fa) => orElse(() => fa)(arr)) as any

export const service = <I extends NanoTag<any>>(tag: I) =>
  new Nano<I["~nano.requirements"], never, I["~nano.requirements"]>((ctx) =>
    contextGet(ctx, tag).pipe(Option.match({
      onNone: () =>
        Either.left(new NanoDefectException({ value: `Cannot find service ${tag.key}` })),
      onSome: (value) => Either.right(Either.right(value))
    }))
  )

export const provideService = <I extends NanoTag<any>>(
  tag: I,
  value: I["~nano.requirements"]
) =>
<A, E, R>(fa: Nano<A, E, R>) =>
  new Nano<A, E, Exclude<R, I["~nano.requirements"]>>((ctx) => {
    return fa.run(contextAdd(ctx, tag, value))
  })

export interface NanoTypeLambda extends TypeLambda {
  readonly type: Nano<this["Target"], this["Out1"], this["Out2"]>
}

export const gen = <Eff extends Gen.YieldWrap<Nano<any, any, any>>, AEff>(
  ...args: [body: () => Generator<Eff, AEff, never>]
) =>
  new Nano<
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
      const result: Either.Either<any, any> = current.run(ctx)
      if (Either.isLeft(result)) {
        return result
      }
      const inner: Either.Either<any, any> = result.right
      if (Either.isLeft(inner)) {
        return result
      }
      state = iterator.next(inner.right as never)
    }
    return Either.right(Either.right(state.value)) as any
  })

export const option = <A, E, R>(fa: Nano<A, E, R>) =>
  new Nano<Option.Option<A>, never, R>((ctx) => {
    return Either.match(fa.run(ctx), {
      onLeft: (cause) => Either.left(cause),
      onRight: Either.match({
        onLeft: () => Either.right(Either.right(Option.none())),
        onRight: (value) => Either.right(Either.right(Option.some(value)))
      })
    })
  })

export const all = <A extends Array<Nano<any, any, any>>>(
  ...args: A
): Nano<A[number]["~nano.success"], A[number]["~nano.error"], A[number]["~nano.requirements"]> =>
  gen(function*() {
    const results: Array<A[number]["~nano.success"]> = []
    for (const arg of args) {
      const result = yield* arg
      results.push(result)
    }
    return results
  })
