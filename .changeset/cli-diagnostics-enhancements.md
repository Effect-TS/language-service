---
"@effect/language-service": minor
---

Enhance `diagnostics` CLI command with new options for CI/CD integration and tooling:

- **`--format`**: Output format selection (`json`, `pretty`, `text`)
  - `json`: Machine-readable JSON output with structured diagnostics and summary
  - `pretty`: Colored output with context (default, original behavior)
  - `text`: Plain text output without colors

- **`--strict`**: Treat warnings as errors (affects exit code)

- **`--severity`**: Filter diagnostics by severity level (comma-separated: `error`, `warning`, `message`)

- **Exit codes**: Returns exit code 1 when errors are found (or warnings in strict mode)

Example usage:
```bash
# JSON output for CI/CD pipelines
effect-language-service diagnostics --project tsconfig.json --format json

# Strict mode for CI (fail on warnings)
effect-language-service diagnostics --project tsconfig.json --strict

# Only show errors
effect-language-service diagnostics --project tsconfig.json --severity error
```

This addresses the request in Effect-TS/effect#5180 for CLI tool improvements.
