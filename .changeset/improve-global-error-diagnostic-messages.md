---
"@effect/language-service": patch
---

Improve diagnostic messages for `globalErrorInEffectFailure` and `globalErrorInEffectCatch` to be more concise and actionable.

Before:
```
The global Error type is used in an Effect failure channel. It's not recommended to use the global Error type in Effect failures as they can get merged together. Instead, use tagged errors or custom errors with a discriminator property to get properly type-checked errors.
```

After:
```
Global 'Error' loses type safety as untagged errors merge together in the Effect failure channel. Consider using a tagged error and optionally wrapping the original in a 'cause' property.
```
