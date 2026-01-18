---
"@effect/language-service": patch
---

Add test cases for effectFnOpportunity diagnostic edge cases that should be ignored:
- Functions with overloads
- Functions where parameters are referenced in piped transformations
- Regular functions with more than 5 statements that should trigger the diagnostic
