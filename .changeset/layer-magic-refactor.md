---
"@effect/language-service": minor
---

Add Layer Magic refactor for automatic layer composition and building

This refactor allows you to automatically compose and build layers based on service dependencies. It helps simplify complex layer constructions by:
- Analyzing service dependencies
- Automatically composing layers in the correct order
- Building final layer structures with proper dependency resolution

Example: When working with services that have dependencies, the refactor can transform your layer setup code into a properly composed layer structure that respects all service requirements.