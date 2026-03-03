// @test-config { "effectFn": ["inferred-span"] }
import * as Effect from "effect/Effect"

const _notExporedNoSuggestion = () => {
  return Effect.gen(function*() {
    yield* Effect.succeed(1)
    return 42
  })
}

export const shouldHaveSuggestion = () => {
  return Effect.gen(function*() {
    yield* Effect.succeed(1)
    return 42
  })
}

export function shouldHaveSuggestioFunction() {
  return Effect.gen(function*() {
    yield* Effect.succeed(1)
    return 42
  })
}
