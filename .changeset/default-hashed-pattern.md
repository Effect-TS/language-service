---
"@effect/language-service": minor
---

Add `default-hashed` pattern for deterministic keys

A new `default-hashed` pattern option is now available for service and error key patterns. This pattern works like the `default` pattern but hashes the resulting string, which is useful when you want deterministic keys but are concerned about potentially exposing service names in builds.

Example configuration:
```json
{
  "keyPatterns": [
    { "target": "service", "pattern": "default-hashed" },
    { "target": "error", "pattern": "default-hashed" }
  ]
}
```
