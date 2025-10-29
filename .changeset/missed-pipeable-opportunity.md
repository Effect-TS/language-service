---
"@effect/language-service": minor
---

Add new diagnostic to detect nested function calls that can be converted to pipeable style

The new `missedPipeableOpportunity` diagnostic identifies nested function calls that would be more readable when converted to Effect's pipeable style. For example:

```ts
// Detected pattern:
toString(double(addOne(5)))

// Can be converted to:
addOne(5).pipe(double, toString)
```

This diagnostic helps maintain consistent code style and improves readability by suggesting the more idiomatic pipeable approach when multiple functions are chained together.
