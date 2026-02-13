---
"@effect/language-service": minor
---

Added Effect v4 support for diagnostics, refactors, and piping features.

**Diagnostics:**
- `multipleEffectProvide`: Warns when multiple `Effect.provide` calls are chained, suggesting consolidation
- `strictEffectProvide`: Warns when using `Effect.provide` with Layer outside of application entry points
- `missingLayerContext`: Detects missing Layer context requirements
- `deterministicKeys`: Extended to support `ServiceMap.Service` patterns
- `leakingRequirements`: Extended to detect leaking requirements in ServiceMap services
- `schemaSyncInEffect`: Updated with v4-specific method mappings (e.g., `decodeSync` -> `decodeEffect`)

**Refactors:**
- `layerMagic`: Automatically compose and build layers based on service dependencies
- `structuralTypeToSchema`: Convert TypeScript interfaces and type aliases to Effect Schema classes
- `makeSchemaOpaque`: Enhanced for v4 with support for `Codec`, `DecodingServices`, and `EncodingServices` types
- `typeToEffectSchema`: Enhanced to support Effect v4 schema patterns

**Piping:**
- Added pipe transformation support for Effect v4 including `Effect.fn`, nested pipes, and function call conversions
