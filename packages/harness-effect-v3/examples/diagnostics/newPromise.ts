// @effect-diagnostics newPromise:warning
import { Effect } from "effect"

// Should trigger - new Promise at module level
export const modulePromise = new Promise<number>((resolve) => resolve(1))

// Should trigger - new Promise in regular function
export const regularPromise = () => new Promise<number>((resolve) => resolve(2))

// Should trigger - aliased Promise
const MyPromise = Promise
export const aliasedPromise = new MyPromise<number>((resolve) => resolve(3))

// Should trigger - new Promise inside Effect.gen
export const promiseInGen = Effect.gen(function*() {
  return new Promise<number>((resolve) => resolve(4))
})

// Should NOT trigger - shadowed Promise
export const shadowedPromise = () => {
  class Promise<A> {
    constructor(readonly value: A) {}
  }
  return new Promise(5)
}
