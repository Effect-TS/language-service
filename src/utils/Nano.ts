import * as Data from "effect/Data"
import * as Either from "effect/Either"
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
 */
export class Nano<out A, out E = never, out R = never> {
  declare readonly "~nano.success": A
  declare readonly "~nano.error": E
  declare readonly "~nano.requirements": R

  constructor(
    public readonly run: (
      ctx: NanoContext<unknown>
    ) => Either.Either<A, E | NanoInterruptedException | NanoDefectException>
  ) {}

  [Symbol.iterator](): NanoIterator<Nano<A, E, R>> {
    return new Gen.SingleShotGen(new Gen.YieldWrap(this)) as any
  }
}

export const run = <A, E>(fa: Nano<A, E, never>) => fa.run(contextEmpty)
export const succeed = <A>(value: A) => new Nano(() => (Either.right(value)))
export const fail = <E>(value: E) => new Nano(() => (Either.left(value)))
export const sync = <A>(value: () => A) => new Nano(() => (Either.right(value())))

export const service = <I extends NanoTag<any>>(tag: I) =>
  new Nano<I["~nano.requirements"], never, I["~nano.requirements"]>((ctx) =>
    contextGet(ctx, tag).pipe(Option.match({
      onNone: () =>
        Either.left(new NanoDefectException({ value: `Cannot find service ${tag.key}` })),
      onSome: (value) => Either.right(value)
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
      state = iterator.next(result.right as never)
    }
    return Either.right(state.value) as any
  })
