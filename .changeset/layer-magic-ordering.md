---
"@effect/language-service": patch
---

Improve layerMagic refactor to prioritize layers with more provided services

The layerMagic refactor now uses a heuristic that prioritizes nodes with more provided services when generating layer composition code. This ensures that telemetry and tracing layers (which typically provide fewer services) are positioned as late as possible in the dependency graph, resulting in more intuitive and correct layer ordering.

Example: When composing layers for services that depend on HttpClient with telemetry, the refactor now correctly places the telemetry layer (which provides fewer services) later in the composition chain.
