---
"@effect/language-service": minor
---

Add `cryptoRandomUUID` and `cryptoRandomUUIDInEffect` diagnostics for Effect v4 to discourage `crypto.randomUUID()` in favor of the Effect `Random` module, which uses Effect-injected randomness instead of the global crypto implementation.
