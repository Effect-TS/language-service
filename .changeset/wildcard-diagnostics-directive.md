---
"@effect/language-service": patch
---

Add wildcard (`*`) support for `@effect-diagnostics` comment directives. You can now use `*` as a rule name to apply a severity override to all diagnostics at once, e.g. `@effect-diagnostics *:off` disables all Effect diagnostics from that point on. Rule-specific overrides still take precedence over wildcard overrides.
