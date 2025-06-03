import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"

export const a = Effect.gen(function*() {
  async function* asyncIterable() {
    yield 1
    yield 2
    yield 3
  }

  const stream = Stream.fromAsyncIterable(asyncIterable(), (_) => _)
  return yield* (Stream.runCollect(stream))
})
