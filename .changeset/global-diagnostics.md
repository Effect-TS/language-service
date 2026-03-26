---
"@effect/language-service": minor
---

Add globalDate, globalConsole, globalRandom, and globalTimers diagnostics

Four new opt-in diagnostics that flag global/DOM APIs inside Effect generators:

- `globalDate` — `Date.now()`, `new Date()` → Clock/DateTime
- `globalConsole` — `console.log/warn/error/info/debug/trace` → Effect.log/Logger
- `globalRandom` — `Math.random()` → Random service
- `globalTimers` — `setTimeout/setInterval` → Effect.sleep/Schedule

All default to `off`. Shadow-safe (e.g. `const console = yield* Console` won't false-positive).
