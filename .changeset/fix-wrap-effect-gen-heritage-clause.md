---
"@effect/language-service": patch
---

Fix wrapWithEffectGen refactor not working on class heritage clauses

The wrapWithEffectGen refactor now correctly skips expressions in heritage clauses (e.g., `extends` clauses in class declarations) to avoid wrapping them inappropriately.
