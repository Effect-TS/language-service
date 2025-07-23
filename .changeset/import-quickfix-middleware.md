---
"@effect/language-service": patch
---

Add middleware for auto-import quickfixes

- Extracted auto-import logic into a reusable `AutoImport` core module
- Refactored existing middleware auto-import completion to use the new shared `AutoImport` provider
- This enables consistent auto-import behavior across both completions and quickfixes