import { contextSelfInClasses } from "./completions/contextSelfInClasses.js"
import { effectDataClasses } from "./completions/effectDataClasses.js"
import { effectSchemaSelfInClasses } from "./completions/effectSchemaSelfInClasses.js"
import { effectSelfInClasses } from "./completions/effectSelfInClasses.js"
import { genFunctionStar } from "./completions/genFunctionStar.js"

export const completions = [
  effectSchemaSelfInClasses,
  effectSelfInClasses,
  contextSelfInClasses,
  genFunctionStar,
  effectDataClasses
]
