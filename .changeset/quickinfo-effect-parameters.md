---
"@effect/language-service": minor
---

Add `quickinfoEffectParameters` configuration option to control when Effect type parameters are displayed in quickinfo

This new option allows users to configure when Effect type parameters are shown in hover information:
- `"always"`: Always show type parameters
- `"never"`: Never show type parameters  
- `"whenTruncated"` (default): Only show when TypeScript truncates the type display

Example configuration:
```json
{
  "effectLanguageService": {
    "quickinfoEffectParameters": "whenTruncated"
  }
}
```