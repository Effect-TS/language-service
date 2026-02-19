import * as Nano from "./core/Nano.js"
import { asyncAwaitToFn } from "./refactors/asyncAwaitToFn.js"
import { asyncAwaitToFnTryPromise } from "./refactors/asyncAwaitToFnTryPromise.js"
import { asyncAwaitToGen } from "./refactors/asyncAwaitToGen.js"
import { asyncAwaitToGenTryPromise } from "./refactors/asyncAwaitToGenTryPromise.js"
import { debugPerformance } from "./refactors/debugPerformance.js"
import { effectGenToFn } from "./refactors/effectGenToFn.js"
import { functionToArrow } from "./refactors/functionToArrow.js"
import { layerMagic } from "./refactors/layerMagic.js"
import { makeSchemaOpaque } from "./refactors/makeSchemaOpaque.js"
import { makeSchemaOpaqueWithNs } from "./refactors/makeSchemaOpaqueWithNs.js"
import { pipeableToDatafirst } from "./refactors/pipeableToDatafirst.js"
import { removeUnnecessaryEffectGen } from "./refactors/removeUnnecessaryEffectGen.js"
import { structuralTypeToSchema } from "./refactors/structuralTypeToSchema.js"
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
  layerMagic,
  asyncAwaitToGen,
  asyncAwaitToGenTryPromise,
  asyncAwaitToFn,
  asyncAwaitToFnTryPromise,
  functionToArrow,
  typeToEffectSchema,
  typeToEffectSchemaClass,
  structuralTypeToSchema,
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
].concat(Nano.debugPerformance ? [debugPerformance] : [])
