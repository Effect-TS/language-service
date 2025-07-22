// 5:7
import type * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"

export class MyService extends Effect.Service<MyService>()("MyService", {
  effect: Effect.gen(function*() {
    /**
     * This is a test
     * @param value doc 1
     * @param other doc 2
     */
    function withOverrides<A>(value: A, other: (value: A) => string): Effect.Effect<A>
    function withOverrides<A>(value: A, force: boolean): Effect.Effect<A | boolean>
    function withOverrides<A>(value: A, arg: boolean | ((value: A) => string)): Effect.Effect<A | boolean> {
      return Effect.succeed(arg ? value : false)
    }

    return {
      constant: Effect.succeed("Hello, world!"),
      method: <A>(value: A, _test: string) => Effect.succeed(value),
      returnsPromise: () => Promise.resolve(42),
      withOverrides
    }
  })
}) {
}
