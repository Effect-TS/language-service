---
"@effect/language-service": patch
---

Refactor CLI overview command to extract symbol collection logic into reusable utility

- Extract `collectSourceFileExportedSymbols` into `src/cli/utils/ExportedSymbols.ts` for reuse across CLI commands
- Add `--max-symbol-depth` option to overview command (default: 3) to control how deep to traverse nested symbol properties
- Add tests for the overview command with snapshot testing
