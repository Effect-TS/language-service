---
"@effect/language-service": patch
---

Rename the `skipDisabledOptimiziation` plugin option to `skipDisabledOptimization`.

Example:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@effect/language-service",
        "skipDisabledOptimization": true
      }
    ]
  }
}
```
