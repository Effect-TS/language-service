---
"@effect/language-service": patch
---

Fix layer graph display improvements: properly render newlines in mermaid diagrams using `<br/>` tags, and improve readability by displaying variable declaration names instead of full expressions when available.

Example: Instead of showing the entire `pipe(Database.Default, Layer.provideMerge(UserRepository.Default))` expression in the graph node, it now displays the cleaner variable name `AppLive` when the layer is assigned to a variable.
