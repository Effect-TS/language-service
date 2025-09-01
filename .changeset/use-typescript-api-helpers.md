---
"@effect/language-service": patch
---

Replace direct `.text` property access with TypeScript API helper `ts.idText()` for getting identifier text from nodes. This is a more robust approach that properly handles escaped identifiers and follows TypeScript's recommended practices.