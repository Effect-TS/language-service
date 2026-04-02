// @effect-diagnostics asyncFunction:warning
import { Effect } from "effect"

// Should trigger - async function declaration
export async function declaredAsync() {
  await Promise.resolve(1)
  return 1
}

// Should trigger - async arrow function
export const asyncArrow = async () => {
  await Promise.resolve(2)
  return 2
}

// Should trigger - async method
export const asyncMethod = {
  async run() {
    await Promise.resolve(3)
    return 3
  }
}

// Should trigger - async function inside Effect.gen
export const asyncInGen = Effect.gen(function*() {
  return async function nested() {
    await Promise.resolve(4)
    return 4
  }
})

// Should NOT trigger - regular function using Effect
export const regularFunction = () => Effect.succeed(5)
