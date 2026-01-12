import * as Effect from "effect/Effect"

// Should trigger - function declaration without return type annotation
export function noReturnTypeAnnotation() {
  return Effect.gen(function*() {
    yield* Effect.succeed(1)
    return 42
  })
}

// Should trigger - function declaration with return type annotation
export function withReturnTypeAnnotation(): Effect.Effect<number> {
  return Effect.gen(function*() {
    yield* Effect.succeed(1)
    return 42
  })
}

// Should trigger - function declaration with parameters
export function withParameters(a: number, b: string) {
  return Effect.gen(function*() {
    yield* Effect.succeed(a)
    return b
  })
}

// Should trigger - function declaration with type parameters
export function withTypeParameters<T>(value: T) {
  return Effect.gen(function*() {
    return yield* Effect.succeed(value)
  })
}

// Should trigger - function declaration with type parameters and return type
export function withTypeParametersAndReturn<T>(value: T): Effect.Effect<T> {
  return Effect.gen(function*() {
    return yield* Effect.succeed(value)
  })
}

// Should NOT trigger - function declaration with multiple statements
export function multipleStatements() {
  const x = 1
  return Effect.gen(function*() {
    return yield* Effect.succeed(x)
  })
}

// Should NOT trigger - generator function declaration
export function* generatorDeclaration() {
  yield 1
  yield 2
}

// Should NOT trigger - async function
export async function asyncFunction() {
  return 42
}
