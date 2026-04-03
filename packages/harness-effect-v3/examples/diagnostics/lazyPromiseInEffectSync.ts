// @effect-diagnostics lazyPromiseInEffectSync:warning
import { Effect } from "effect"

declare const promiseValue: Promise<number>
declare const thenableValue: { then: (onFulfilled: (value: number) => unknown) => unknown }

// Should trigger - Promise returned from Effect.sync
export const fromPromiseResolve = Effect.sync(() => Promise.resolve(1))

// Should trigger - declared Promise type returned from Effect.sync
export const fromPromiseValue = Effect.sync(() => promiseValue)

// Should NOT trigger - sync value
export const fromValue = Effect.sync(() => 1)

// Should NOT trigger - thenable but not Promise
export const fromThenable = Effect.sync(() => thenableValue)

// Should NOT trigger - already using the async constructor
export const fromEffectPromise = Effect.promise(() => Promise.resolve(1))
