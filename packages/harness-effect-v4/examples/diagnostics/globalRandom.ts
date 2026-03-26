// @effect-diagnostics globalRandom:warning
import { Effect } from "effect"

// Should trigger - Math.random() at module level
const _moduleRandom = Math.random()

// Should trigger - Math.random() in regular function
const _regularRandom = () => Math.random()

// Should trigger - aliased Math at module level
const MyMath = Math
const _aliasedRandom = MyMath.random()

// Should NOT trigger - Math.random() inside Effect.gen
export const mathRandomInGen = Effect.gen(function*() {
  return Math.random()
})

// Should trigger - Math.random() inside nested arrow in generator
export const nestedArrowInGen = Effect.gen(function*() {
  const fn = () => Math.random()
  return fn
})

// Should NOT trigger - shadowed Math
const _shadowedMath = () => {
  const Math = { random: () => 0.5 }
  return Math.random()
}
