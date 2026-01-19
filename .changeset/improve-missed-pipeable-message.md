---
"@effect/language-service": patch
---

Improve `missedPipeableOpportunity` diagnostic message to show the suggested subject for `.pipe(...)`.

Before:
```
Nested function calls can be converted to pipeable style for better readability.
```

After:
```
Nested function calls can be converted to pipeable style for better readability; consider using addOne(5).pipe(...) instead.
```
