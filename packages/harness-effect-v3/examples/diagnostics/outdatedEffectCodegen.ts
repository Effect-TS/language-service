import * as Effect from "effect/Effect"

// @effect-codegens accessors:67e9af40a9b0bd25
export class MyService extends Effect.Service<MyService>()("MyService", {
  accessors: true,
  effect: Effect.gen(function*() {
    return {
      constant: Effect.succeed("Hello, world!"),
      method: <A>(value: A, _test: string) => Effect.succeed(value)
    }
  })
}) {
  static myOtherStuff = 42
}
