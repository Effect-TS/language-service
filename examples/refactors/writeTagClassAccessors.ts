// 5:7
import type * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"

export class MyService extends Effect.Service<MyService>()("MyService", {
  accessors: true,
  effect: Effect.gen(function*() {
    function methodWithOverridesNoGenerics(value: string): Effect.Effect<string>
    function methodWithOverridesNoGenerics(value: string, opts: { discard: true }): Effect.Effect<void>
    function methodWithOverridesNoGenerics(value: string, opts?: { discard: true }): Effect.Effect<string | void> {
      return opts && opts.discard ? Effect.void : Effect.succeed(value)
    }

    function methodWithOverridesAndGenerics<A>(value: A): Effect.Effect<A>
    function methodWithOverridesAndGenerics<A>(value: A, opts: { discard: true }): Effect.Effect<void>
    function methodWithOverridesAndGenerics<A>(value: A, opts?: { discard: true }): Effect.Effect<A | void> {
      return opts && opts.discard ? Effect.void : Effect.succeed(value)
    }

    return {
      constant: Effect.succeed("Hello, world!"),
      methodReturnsPromise: () => Promise.resolve(42),
      methodWithGeneric: <A>(value: A, _test: string) => Effect.succeed(value),
      methodNoGenerics: (value: string) => Effect.succeed(value),
      methodWithOverridesAndGenerics,
      methodWithOverridesNoGenerics
    }
  })
}) {
}
