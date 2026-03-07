---
"@effect/language-service": minor
---

Generate the README diagnostics table from the diagnostic registry.

Each diagnostic now declares:

- whether it is fixable
- which Effect versions it supports

The generated table is checked in CI, and diagnostics tests verify that `fixable` matches the presence of non-suppression quick fixes.
