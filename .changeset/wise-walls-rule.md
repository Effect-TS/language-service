---
"@effect/language-service": minor
---

Add per-file diagnostic severity overrides in plugin config and inline `--paths` glob filtering for CLI commands.

Example plugin config:

```json
{
  "diagnosticSeverity": {
    "strictEffectProvide": "warning"
  },
  "overrides": [
    {
      "include": ["test/**/*"],
      "diagnosticSeverity": {
        "strictEffectProvide": "off"
      }
    }
  ]
}
```

Example inline CLI filtering:

```bash
effect-language-service diagnostics \
  --project tsconfig.json \
  --paths '{"include":["src/**/*"],"exclude":["**/*.test.ts"]}'
```
