import { asyncAwaitToGen } from "./refactors/asyncAwaitToGen.js"
import { asyncAwaitToGenTryPromise } from "./refactors/asyncAwaitToGenTryPromise.js"
import { effectGenToFn } from "./refactors/effectGenToFn.js"
import { functionToArrow } from "./refactors/functionToArrow.js"
import { makeSchemaOpaque } from "./refactors/makeSchemaOpaque.js"
import { makeSchemaOpaqueWithNs } from "./refactors/makeSchemaOpaqueWithNs.js"
import { pipeableToDatafirst } from "./refactors/pipeableToDatafirst.js"
import { removeUnnecessaryEffectGen } from "./refactors/removeUnnecessaryEffectGen.js"
import { toggleLazyConst } from "./refactors/toggleLazyConst.js"
import { togglePipeStyle } from "./refactors/togglePipeStyle.js"
import { toggleReturnTypeAnnotation } from "./refactors/toggleReturnTypeAnnotation.js"
import { toggleTypeAnnotation } from "./refactors/toggleTypeAnnotation.js"
import { typeToEffectSchema } from "./refactors/typeToEffectSchema.js"
import { typeToEffectSchemaClass } from "./refactors/typeToEffectSchemaClass.js"
import { wrapWithEffectGen } from "./refactors/wrapWithEffectGen.js"
import { wrapWithPipe } from "./refactors/wrapWithPipe.js"
import { writeTagClassAccessors } from "./refactors/writeTagClassAccessors.js"

export const refactors = [
  asyncAwaitToGen,
  asyncAwaitToGenTryPromise,
  functionToArrow,
  typeToEffectSchema,
  typeToEffectSchemaClass,
  makeSchemaOpaque,
  makeSchemaOpaqueWithNs,
  pipeableToDatafirst,
  removeUnnecessaryEffectGen,
  toggleLazyConst,
  toggleReturnTypeAnnotation,
  toggleTypeAnnotation,
  wrapWithEffectGen,
  wrapWithPipe,
  effectGenToFn,
  togglePipeStyle,
  writeTagClassAccessors
]
