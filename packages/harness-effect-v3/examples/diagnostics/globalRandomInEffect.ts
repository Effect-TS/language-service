// @effect-diagnostics globalRandomInEffect:warning
import { Effect } from "effect"

// Should trigger - Math.random() inside Effect.gen
export const mathRandomInGen = Effect.gen(function*() {
  const r = Math.random()
  return r
})

// Should trigger - aliased Math
export const aliasedMath = Effect.gen(function*() {
  const MyMath = Math
  const r = MyMath.random()
  return r
})

// Should NOT trigger - Math.random() at module level
const _moduleLevel = Math.random()

// Should NOT trigger - Math.random() in regular function
const _regularFn = () => Math.random()

// Should NOT trigger - Math.random() inside nested arrow in generator
export const nestedArrowInGen = Effect.gen(function*() {
  const fn = () => Math.random()
  return fn
})
