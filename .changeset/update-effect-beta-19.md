---
"@effect/language-service": patch
---

Update effect dependency to v4.0.0-beta.19 and fix compatibility issues:

- Fix `layerMagic` refactor producing `any` types in Layer channels by replacing `Array.partition` (which now uses the v4 `Filter.Filter` API) with a native loop for boolean partition logic
- Add v4 Layer type detection shortcut using `"~effect/Layer"` TypeId property, matching the pattern already used for Effect type detection
- Mark `Effect.filterMap` as unchanged in the outdated API migration database since it was re-added in v4
