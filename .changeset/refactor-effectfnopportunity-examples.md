---
"@effect/language-service": patch
---

Improve effectFnOpportunity diagnostic with more specific messages and configurable fixes

- Add new `effectFn` configuration option to control which code fix variants are offered: `"untraced"`, `"span"`, `"inferred-span"`, `"no-span"` (defaults to `["span"]`)
- Diagnostic message now shows the exact expected signature for the rewrite
- Distinguish between explicit trace from `Effect.withSpan` vs inferred trace from function name
- Skip functions with return type annotations to avoid issues with recursive functions

**Before:**
```
This function could benefit from Effect.fn's automatic tracing...
```

**After:**
```
Can be rewritten as a reusable function: Effect.fn("myFunction")(function*() { ... })
```
