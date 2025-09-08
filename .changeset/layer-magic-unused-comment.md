---
"@effect/language-service": patch
---

Layer Magic refactor now shows previously provided layers as a comment in the generated type annotation.

When using the Layer Magic "Prepare for reuse" refactor, layers that were already provided at the location are now shown as a trailing comment (e.g., `/* Foo | Bar */`) next to the newly introduced layer types. This helps developers understand which layers were already available and which ones are being newly introduced.