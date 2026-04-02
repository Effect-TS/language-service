---
"@effect/language-service": minor
---

Add `processEnv` and `processEnvInEffect` diagnostics to guide `process.env.*` reads toward Effect `Config` APIs.

Examples:
- `process.env.PORT`
- `process.env["API_KEY"]`
