import { contextSelfInClasses } from "./completions/contextSelfInClasses.js"
import { effectDataClasses } from "./completions/effectDataClasses.js"
import { effectSchemaSelfInClasses } from "./completions/effectSchemaSelfInClasses.js"
import { effectSelfInClasses } from "./completions/effectSelfInClasses.js"
import { fnFunctionStar } from "./completions/fnFunctionStar.js"
import { genFunctionStar } from "./completions/genFunctionStar.js"
import { rpcMakeClasses } from "./completions/rpcMakeClasses.js"

export const completions = [
  effectSchemaSelfInClasses,
  effectSelfInClasses,
  contextSelfInClasses,
  rpcMakeClasses,
  genFunctionStar,
  fnFunctionStar,
  effectDataClasses
]
