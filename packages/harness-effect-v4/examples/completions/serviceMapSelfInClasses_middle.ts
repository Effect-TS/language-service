// 4:28
import { Effect, Context, Stream } from "effect"

class Foo extends Context.S

Stream.unwrap(Effect.gen(function*() {
  const a = yield* Foo

  return Stream.succeed(a.count)
}))
