// 7:18,8:17,9:18,11:18,13:18,19:18
import * as Effect from "effect/Effect"


export interface Service {}

export const simple = Effect.succeed(true)
export const simpleFailure = Effect.fail("Hello")
export const simpleRequire = Effect.services<Service>()

export const inUnion = Math.random() > 0.1 ? Effect.succeed(true) : Effect.succeed(42)

export const asArrowResult = () => Effect.succeed(true)

declare const withOverloads:
  & ((a: 1) => Effect.Effect<boolean, never, never>)
  & ((a: 2) => Effect.Effect<never, string, never>)

export const simplifyIntersection = withOverloads
