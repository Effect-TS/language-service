---
"@effect/language-service": patch
---

Add piping flows parser for caching piping flow analysis per source file.

This internal improvement introduces a `pipingFlows` function in `TypeParser` that analyzes and caches all piping flows (both `pipe()` calls and `.pipe()` method chains) in a source file. The parser:

- Identifies piping flows including nested pipes and mixed call styles (e.g., `Effect.map(effect, fn).pipe(...)`)
- Tracks the subject, transformations, and intermediate types for each flow
- Enables more efficient diagnostic implementations by reusing cached analysis

The `missedPipeableOpportunity` diagnostic has been refactored to use this new parser, improving performance when analyzing files with multiple piping patterns.
