---
"@effect/language-service": minor
---

Add new refactors to transform async/await functions to Effect.fn

- Transform an async function definition into an Effect by using Effect.fn
- Transform an async function definition into an Effect by using Effect.fn with tagged errors for each promise call

These refactors complement the existing Effect.gen refactors by providing an alternative transformation using Effect.fn.