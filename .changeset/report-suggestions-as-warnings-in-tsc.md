---
"@effect/language-service": patch
---

Add `reportSuggestionsAsWarningsInTsc` configuration option to allow suggestions and messages to be reported as warnings in TypeScript compiler.

When enabled, diagnostics with "suggestion" or "message" severity will be upgraded to "warning" severity with a "[suggestion]" prefix in the message text. This is useful for CI/CD pipelines where you want to enforce suggestion-level diagnostics as warnings in the TypeScript compiler output.

Example configuration:
```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@effect/language-service",
        "reportSuggestionsAsWarningsInTsc": true
      }
    ]
  }
}
```
