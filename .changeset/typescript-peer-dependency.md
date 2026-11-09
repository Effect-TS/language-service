---
"@effect/language-service": patch
---

Declare `typescript` (`^5.0.0 || ^6.0.0`) as a peer dependency, so isolated linkers such as Bun's and pnpm's place the project's TypeScript next to the language service instead of resolving an unrelated hoisted copy.
