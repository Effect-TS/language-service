// @effect-diagnostics cryptoRandomUUIDInEffect:warning
import { Effect } from "effect"

// Should trigger - crypto.randomUUID() inside Effect.gen
export const uuidInGen = Effect.gen(function*() {
  return crypto.randomUUID()
})

// Should trigger - aliased crypto inside Effect.gen
export const aliasedCrypto = Effect.gen(function*() {
  const globalCrypto = crypto
  return globalCrypto.randomUUID()
})

// Should NOT trigger - crypto.randomUUID() at module level
export const moduleUuid = crypto.randomUUID()

// Should NOT trigger - crypto.randomUUID() in regular function
export const regularUuid = () => crypto.randomUUID()

// Should NOT trigger - crypto.randomUUID() inside nested arrow in generator
export const nestedArrowInGen = Effect.gen(function*() {
  const fn = () => crypto.randomUUID()
  return fn
})
