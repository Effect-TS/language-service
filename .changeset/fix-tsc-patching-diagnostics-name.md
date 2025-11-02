---
"@effect/language-service": patch
---

Fix TSC patching mode to properly enable diagnosticsName option and simplify suggestion handling.

When using the language service in TSC patching mode, the `diagnosticsName` option is now automatically enabled to ensure diagnostic rule names are included in the output. Additionally, the handling of suggestion-level diagnostics has been simplified - when `reportSuggestionsAsWarningsInTsc` is enabled, suggestions are now converted to Message category instead of Warning category with a prefix.

This change ensures consistent diagnostic formatting across both IDE and CLI usage modes.
