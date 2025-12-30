---
"@effect/language-service": patch
---

Improve Layer Magic refactor ordering by considering both provided and required service counts

The Layer Magic refactor now uses a combined ordering heuristic that considers both:
1. The number of services a layer provides
2. The number of services a layer requires

This results in more optimal layer composition order, especially in complex dependency graphs where layers have varying numbers of dependencies.
