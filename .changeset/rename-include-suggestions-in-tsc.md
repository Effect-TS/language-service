---
"@effect/language-service": minor
---

Rename `reportSuggestionsAsWarningsInTsc` option to `includeSuggestionsInTsc` and change default to `true`.

This option controls whether diagnostics with "suggestion" severity are included in TSC output when using the `effect-language-service patch` feature. When enabled, suggestions are reported as messages in TSC output, which is useful for LLM-based development tools to see all suggestions.

**Breaking change**: The option has been renamed and the default behavior has changed:
- Old: `reportSuggestionsAsWarningsInTsc: false` (suggestions not included by default)
- New: `includeSuggestionsInTsc: true` (suggestions included by default)

To restore the previous behavior, set `"includeSuggestionsInTsc": false` in your tsconfig.json plugin configuration.
