import { contextSelfInClasses } from "./completions/contextSelfInClasses.js"
import { durationInput } from "./completions/durationInput.js"
import { effectCodegensComment } from "./completions/effectCodegensComment.js"
import { effectDataClasses } from "./completions/effectDataClasses.js"
import { effectDiagnosticsComment } from "./completions/effectDiagnosticsComment.js"
import { effectSchemaSelfInClasses } from "./completions/effectSchemaSelfInClasses.js"
import { effectSelfInClasses } from "./completions/effectSelfInClasses.js"
import { fnFunctionStar } from "./completions/fnFunctionStar.js"
import { genFunctionStar } from "./completions/genFunctionStar.js"
import { rpcMakeClasses } from "./completions/rpcMakeClasses.js"
import { schemaBrand } from "./completions/schemaBrand.js"

export const completions = [
  effectSchemaSelfInClasses,
  effectSelfInClasses,
  contextSelfInClasses,
  rpcMakeClasses,
  genFunctionStar,
  fnFunctionStar,
  effectDataClasses,
  effectDiagnosticsComment,
  effectCodegensComment,
  durationInput,
  schemaBrand
]
