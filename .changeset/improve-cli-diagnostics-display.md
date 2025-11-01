---
"@effect/language-service": patch
---

Improve CLI diagnostics output formatting by displaying rule names in a more readable format.

The CLI now displays diagnostic rule names using the format `effect(ruleName):` instead of `TS<code>:`, making it easier to identify which Effect diagnostic rule triggered the error. Additionally, the CLI now disables the `diagnosticsName` option internally to prevent duplicate rule name display in the message text.

Example output:
```
Before: TS90001: Floating Effect detected...
After:  effect(floatingEffect): Floating Effect detected...
```
