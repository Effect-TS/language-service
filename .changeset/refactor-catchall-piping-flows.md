---
"@effect/language-service": patch
---

Refactor `catchAllToMapError` diagnostic to use the piping flows parser for detecting Effect.catchAll calls.

This change also:
- Makes `outType` optional in `ParsedPipingFlowSubject` to handle cases where type information is unavailable
- Sorts piping flows by position for consistent ordering
