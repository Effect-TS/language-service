// @test-config { "effectFn": ["span", "inferred-span", "no-span", "untraced"] }
import * as Effect from "effect/Effect"

// The diagnostic should never trigger on these cases because there is
// a return type annotation. When there's an explicit return type, the
// function could be recursive at some point.

export const arrowWithReturnType = (): Effect.Effect<number> => {
  return Effect.gen(function*() {
    return yield* Effect.succeed(42)
  })
}

export const functionExpressionWithReturnType = function(): Effect.Effect<number> {
  return Effect.gen(function*() {
    return yield* Effect.succeed(42)
  })
}

export function functionDeclarationWithReturnType(): Effect.Effect<number> {
  return Effect.gen(function*() {
    return yield* Effect.succeed(42)
  })
}
