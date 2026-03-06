---
"@effect/language-service": minor
---

Add the `serviceNotAsClass` diagnostic to warn when `ServiceMap.Service` is used as a variable assignment instead of in a class declaration.

Includes an auto-fix that converts `const Config = ServiceMap.Service<Shape>("Config")` to `class Config extends ServiceMap.Service<Config, Shape>()("Config") {}`.
