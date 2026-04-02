// @effect-diagnostics cryptoRandomUUID:warning
import { Effect } from "effect"

// Should trigger - crypto.randomUUID() at module level
export const moduleUuid = crypto.randomUUID()

// Should trigger - crypto.randomUUID() in regular function
export const regularUuid = () => crypto.randomUUID()

// Should trigger - aliased crypto at module level
const globalCrypto = crypto
export const aliasedUuid = globalCrypto.randomUUID()

// Should NOT trigger - crypto.randomUUID() inside Effect.gen
export const uuidInGen = Effect.gen(function*() {
  return crypto.randomUUID()
})

// Should trigger - crypto.randomUUID() inside nested arrow in generator
export const nestedArrowInGen = Effect.gen(function*() {
  const fn = () => crypto.randomUUID()
  return fn
})

// Should NOT trigger - shadowed crypto
export const shadowedCrypto = () => {
  const crypto = { randomUUID: () => "fixed" }
  return crypto.randomUUID()
}
