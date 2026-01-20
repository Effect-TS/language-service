import * as Effect from "effect/Effect"
import * as Runtime from "effect/Runtime"

export const result1 = Effect.gen(function*() {
  const runtime = yield* Effect.runtime()

  Runtime.runPromise(runtime)(Effect.log("Hello, world!"))

  Runtime.runPromise(runtime)(Effect.map((x: string) => x.length)(Effect.succeed("Hello, world!")))
})
