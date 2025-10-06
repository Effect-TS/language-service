---
"@effect/language-service": minor
---

Add `quickinfoMaximumLength` option to control the maximum length of types displayed in quickinfo hover. This helps improve performance when dealing with very long types by allowing TypeScript to truncate them to a specified budget. Defaults to -1 (no truncation), but can be set to any positive number (e.g., 1000) to limit type display length.
