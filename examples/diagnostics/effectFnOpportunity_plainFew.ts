import * as Effect from "effect/Effect"

// For these cases we could only convert to Effect.fn (not Effect.fnUntraced
// since there's no Effect.gen). However, given that the function body has
// too few statements (<= 5), we are not suggesting the conversion.

export const arrowConcise = () => Effect.succeed(1)

export const arrowPlainFew = () => {
  return Effect.succeed(1)
}

export const functionExpressionPlainFew = function<T>(value: T) {
  if (value === null) return Effect.fail("Error!")
  return Effect.succeed(value)
}

export function functionDeclarationPlainFew<T>(value: T) {
  if (value === null) return Effect.fail("Error!")
  return Effect.succeed(value)
}
