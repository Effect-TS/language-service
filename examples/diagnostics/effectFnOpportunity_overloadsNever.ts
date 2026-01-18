import * as Effect from "effect/Effect"

// The diagnostic will never trigger for function declarations with overload
// signatures because we cannot safely convert them to Effect.fn while
// preserving the overloads.

export function overloadedDeclaration(a: number): Effect.Effect<number>
export function overloadedDeclaration(a: string): Effect.Effect<string>
export function overloadedDeclaration(a: number | string) {
  return Effect.gen(function*() {
    return yield* Effect.succeed(a as any)
  })
}

export function overloadedDeclarationNoGen(a: number): Effect.Effect<number>
export function overloadedDeclarationNoGen(a: string): Effect.Effect<string>
export function overloadedDeclarationNoGen(a: number | string) {
  const _a = 1
  const _b = 2
  const _c = 3
  const _d = 4
  const _e = 5
  return Effect.succeed(a as any)
}
