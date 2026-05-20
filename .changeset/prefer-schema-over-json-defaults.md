---
"@effect/language-service": patch
---

Update `preferSchemaOverJson` to be off by default.

Improve the diagnostic guidance for JSON parsing and stringifying:

- in Effect v3, suggest `Schema.parseJson(Schema.Unknown)` for unknown shapes and `Schema.parseJson(schema)` for known ones
- in Effect v4, suggest `Schema.UnknownFromJsonString`, `Schema.fromJsonString(schema)`, and `Schema.toCodecJson(schema)` depending on whether the target shape is known and whether the code is working with JSON strings or JSON values
