---
"@effect/language-service": minor
---

Add paired globalDate/globalDateInEffect, globalConsole/globalConsoleInEffect, globalFetch/globalFetchInEffect, globalRandom/globalRandomInEffect, and globalTimers/globalTimersInEffect diagnostics

Ten new opt-in diagnostics that flag global/DOM APIs both outside and inside Effect generators:

- `globalFetch` / `globalFetchInEffect` — `fetch()` → HttpClient
- `globalDate` / `globalDateInEffect` — `Date.now()`, `new Date()` → Clock/DateTime
- `globalConsole` / `globalConsoleInEffect` — `console.log/warn/error/info/debug/trace` → Effect.log/Logger
- `globalRandom` / `globalRandomInEffect` — `Math.random()` → Random service
- `globalTimers` / `globalTimersInEffect` — `setTimeout/setInterval` → Effect.sleep/Schedule

All default to `off`. Enable both variants for full coverage inside and outside Effect generators. Shadow-safe (e.g. `const console = yield* Console` won't false-positive).
