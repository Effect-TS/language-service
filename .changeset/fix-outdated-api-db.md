---
"@effect/language-service": patch
---

Fix outdated API diagnostic for Effect v4 compatibility

- Fixed `TaggedError` completion to use `TaggedErrorClass` matching the v4 API
- Removed `Schema.RequestClass` examples that no longer exist in v4
- Updated Effect v4 harness to latest version
