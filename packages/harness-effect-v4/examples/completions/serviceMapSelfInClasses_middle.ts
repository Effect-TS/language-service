// 4:31
import { Effect, ServiceMap, Stream } from "effect"

class Foo extends ServiceMap.S

Stream.unwrap(Effect.gen(function*() {
  const a = yield* Foo

  return Stream.succeed(a.count)
}))
