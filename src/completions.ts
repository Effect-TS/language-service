import { contextSelfInClasses } from "./completions/contextSelfInClasses.js"
import { effectDataClasses } from "./completions/effectDataClasses.js"
import { effectSchemaSelfInClasses } from "./completions/effectSchemaSelfInClasses.js"
import { effectSelfInClasses } from "./completions/effectSelfInClasses.js"
import { pipeNonPipeables } from "./completions/pipeNonPipeables.js"

export const completions = [
  pipeNonPipeables,
  effectSchemaSelfInClasses,
  effectSelfInClasses,
  contextSelfInClasses,
  effectDataClasses
]
