// @effect-diagnostics unsafeEffectTypeAssertion:warning
import { Effect } from "effect"

declare const program: Effect.Effect<string, "boom", "service">
declare const anyError: Effect.Effect<string, any, "service">
declare const anyRequirements: Effect.Effect<string, "boom", any>
declare const noRequirements: Effect.Effect<string, "boom", never>
declare const noError: Effect.Effect<string, never, "service">

export const narrowsBoth = program as Effect.Effect<string, never, never>
export const skipsAnyError = anyError as Effect.Effect<string, never, "service">
export const skipsAnyRequirements = anyRequirements as Effect.Effect<string, "boom", never>
export const safeWiden = program as Effect.Effect<string, "boom" | "other", "service">
export const narrowsRequirements = noError as Effect.Effect<string, never, never>
export const narrowsError = noRequirements as Effect.Effect<string, never, never>
export const notEffect = 1 as number
