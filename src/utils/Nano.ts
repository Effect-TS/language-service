import * as Data from "effect/Data"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
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
  readonly _tag: "Nil"
} | {
  readonly _tag: "Cons"
  readonly key: string
  readonly value: R
  readonly next: NanoContext<R>
}

export const contextEmpty: NanoContext<never> = { _tag: "Nil" }
export const contextAdd = <R, I extends NanoTag<any>>(
  context: NanoContext<R>,
  tag: I,
  value: I["~nano.requirements"]
): NanoContext<R | I> => ({
  _tag: "Cons",
  key: tag.key,
  value,
  next: context
})
export const contextGet = <R, I extends NanoTag<any>>(
  context: NanoContext<R | I>,
  tag: I
): Option.Option<I["~nano.requirements"]> => {
  let current = context
  while (current._tag !== "Nil") {
    if (current.key === tag.key) return Option.some(current.value)
    current = current.next
  }
  return Option.none()
}

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

export const service = <I extends NanoTag<any>>(tag: I) =>
  new Nano<I["~nano.requirements"], never, I["~nano.requirements"]>((ctx) =>
    contextGet(ctx, tag).pipe(Option.match({
      onNone: () =>
        Either.left(new NanoDefectException({ value: `Cannot find service ${tag.key}` })),
      onSome: (value) => Either.right(Either.right(value))
    }))
  )

export const provide = <I extends NanoTag<any>>(
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
