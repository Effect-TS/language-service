---
"@effect/language-service": patch
---

Fix edge cases in missedPipeableOpportunity diagnostic where it incorrectly flagged valid code patterns. The diagnostic now properly:
- Excludes `pipe` function calls from chain detection
- Ignores chains where the function returns a callable type (avoiding false positives for higher-order functions like `Schedule.whileOutput`)
