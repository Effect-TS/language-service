import { Effect, type RateLimiter } from "effect"

const impl = Effect.gen(function*() {
    const banana = (rateLimit: RateLimiter.RateLimiter = (_) => _) => Effect.void

    yield* banana()
  })
