---
"@effect/language-service": minor
---

Add `quickfixes` CLI command that shows diagnostics with available quick fixes and their proposed code changes.

Example usage:
```bash
# Check a specific file
effect-language-service quickfixes --file ./src/index.ts

# Check an entire project
effect-language-service quickfixes --project ./tsconfig.json
```

The command displays each diagnostic along with the available code fixes and a diff preview of the proposed changes, making it easy to see what automatic fixes are available before applying them.
