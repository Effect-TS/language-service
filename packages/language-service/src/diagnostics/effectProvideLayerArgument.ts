import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const parseEffectProvideLayerArgument = Nano.fn(
  "effectProvideLayerArgument.parse"
)(function*(argument: ts.Expression) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
  const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
  const typeParser = yield* Nano.service(TypeParser.TypeParser)

  if (ts.isArrayLiteralExpression(argument)) {
    if (argument.elements.length === 0) {
      return yield* TypeParser.typeParserIssue("Layer array is empty", undefined, argument)
    }
    for (const element of argument.elements) {
      const type = typeCheckerUtils.getTypeAtLocation(element)
      if (!type) {
        return yield* TypeParser.typeParserIssue("Could not get Layer array element type", undefined, element)
      }
      yield* typeParser.layerType(type, element)
    }
    return Array.from(argument.elements)
  }

  const argumentType = typeCheckerUtils.getTypeAtLocation(argument)
  if (!argumentType) {
    return yield* TypeParser.typeParserIssue("Could not get Effect.provide argument type", undefined, argument)
  }

  const directLayer = yield* pipe(
    typeParser.layerType(argumentType, argument),
    Nano.option
  )
  if (Option.isSome(directLayer)) {
    return [argument]
  }

  if (!typeChecker.isTupleType(argumentType)) {
    return yield* TypeParser.typeParserIssue("Effect.provide argument is not a Layer tuple", argumentType, argument)
  }

  const elementTypes = typeChecker.getTypeArguments(argumentType as ts.TypeReference)
  if (elementTypes.length === 0) {
    return yield* TypeParser.typeParserIssue("Layer tuple is empty", argumentType, argument)
  }
  for (const elementType of elementTypes) {
    yield* typeParser.layerType(elementType, argument)
  }

  return [ts.factory.createSpreadElement(argument)]
})
