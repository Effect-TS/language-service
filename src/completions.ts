import { contextSelfInClasses } from "./completions/contextSelfInClasses.js"
import { effectDataClasses } from "./completions/effectDataClasses.js"
import { effectSchemaSelfInClasses } from "./completions/effectSchemaSelfInClasses.js"
import { effectSelfInClasses } from "./completions/effectSelfInClasses.js"

export const completions = [
  effectSchemaSelfInClasses,
  effectSelfInClasses,
  contextSelfInClasses,
  effectDataClasses
]
