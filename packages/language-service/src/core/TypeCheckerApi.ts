import { hasProperty, isFunction } from "effect/Predicate"
import type ts from "typescript"
import * as Nano from "../core/Nano.js"

declare module "typescript" {
  export interface TypeChecker {
    getIndexType(constraint: ts.Type): ts.Type
    getParameterType(signature: ts.Signature, parameterIndex: number): ts.Type
  }
}

export interface TypeCheckerApi extends ts.TypeChecker {}
export const TypeCheckerApi = Nano.Tag<TypeCheckerApi>("TypeChecker")

export function makeResolveExternalModuleName(typeChecker: TypeCheckerApi) {
  if (!(hasProperty(typeChecker, "resolveExternalModuleName") && isFunction(typeChecker.resolveExternalModuleName))) {
    return
  }
  const _internal = typeChecker.resolveExternalModuleName as (moduleSpecifier: ts.Expression) => ts.Symbol | undefined
  return (moduleSpecifier: ts.Expression): ts.Symbol | undefined => {
    return _internal(moduleSpecifier)
  }
}
