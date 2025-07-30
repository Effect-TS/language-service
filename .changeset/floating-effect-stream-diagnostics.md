---
"@effect/language-service": patch
---

Improve floating effect diagnostic message to specify the actual type being flagged. When detecting floating Stream or other Effect subtypes, the error message now shows "Effect-able Stream<...>" instead of just "Effect", making it clearer what type needs to be handled.