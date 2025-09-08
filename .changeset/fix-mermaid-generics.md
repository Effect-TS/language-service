---
"@effect/language-service": patch
---

Fix Mermaid graph generation for layers with generic types

Properly escape angle brackets (`<` and `>`) in Mermaid diagrams to prevent rendering issues when displaying layer names containing generic type parameters.