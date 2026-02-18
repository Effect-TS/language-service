import { contextSelfInClasses } from "./completions/contextSelfInClasses.js"
import { durationInput } from "./completions/durationInput.js"
import { effectCodegensComment } from "./completions/effectCodegensComment.js"
import { effectDataClasses } from "./completions/effectDataClasses.js"
import { effectDiagnosticsComment } from "./completions/effectDiagnosticsComment.js"
import { effectJsdocComment } from "./completions/effectJsdocComment.js"
import { effectSchemaSelfInClasses } from "./completions/effectSchemaSelfInClasses.js"
import { effectSelfInClasses } from "./completions/effectSelfInClasses.js"
import { effectSqlModelSelfInClasses } from "./completions/effectSqlModelSelfInClasses.js"
import { fnFunctionStar } from "./completions/fnFunctionStar.js"
import { genFunctionStar } from "./completions/genFunctionStar.js"
import { rpcMakeClasses } from "./completions/rpcMakeClasses.js"
import { schemaBrand } from "./completions/schemaBrand.js"
import { serviceMapSelfInClasses } from "./completions/serviceMapSelfInClasses.js"

export const completions = [
  serviceMapSelfInClasses,
  effectSqlModelSelfInClasses,
  effectSchemaSelfInClasses,
  effectSelfInClasses,
  contextSelfInClasses,
  rpcMakeClasses,
  genFunctionStar,
  fnFunctionStar,
  effectDataClasses,
  effectDiagnosticsComment,
  effectCodegensComment,
  effectJsdocComment,
  durationInput,
  schemaBrand
]
