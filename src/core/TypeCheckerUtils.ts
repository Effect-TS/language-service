import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import type * as ts from "typescript"
import * as Nano from "./Nano.js"
import * as TypeCheckerApi from "./TypeCheckerApi"
import * as TypeScriptApi from "./TypeScriptApi"

export interface TypeCheckerUtils {
  isUnion: (type: ts.Type) => type is ts.UnionType
  getTypeParameterAtPosition: (signature: ts.Signature, pos: number) => ts.Type
  getMissingTypeEntriesInTargetType: (realType: ts.Type, expectedType: ts.Type) => Array<ts.Type>
  unrollUnionMembers: (type: ts.Type) => Array<ts.Type>
  appendToUniqueTypesMap: <E, R>(
    memory: Map<string, ts.Type>,
    initialType: ts.Type,
    shouldExclude: (type: ts.Type) => Nano.Nano<boolean, E, R>
  ) => Nano.Nano<{ newIndexes: Set<string>; knownIndexes: Set<string>; allIndexes: Array<string> }, E, R>
}

export const TypeCheckerUtils = Nano.Tag<TypeCheckerUtils>("TypeCheckerUtils")

export const nanoLayer = <A, E, R>(
  fa: Nano.Nano<A, E, R>
) =>
  pipe(
    Nano.service(TypeScriptApi.TypeScriptApi),
    Nano.flatMap((ts) =>
      Nano.flatMap(Nano.service(TypeCheckerApi.TypeCheckerApi), (typeChecker) =>
        pipe(fa, Nano.provideService(TypeCheckerUtils, makeTypeCheckerUtils(ts, typeChecker))))
    )
  )

export function makeTypeCheckerUtils(
  ts: TypeScriptApi.TypeScriptApi,
  typeChecker: TypeCheckerApi.TypeCheckerApi
): TypeCheckerUtils {
  function isUnion(type: ts.Type): type is ts.UnionType {
    return !!(type.flags & ts.TypeFlags.Union)
  }

  function isIndexType(type: ts.Type): type is ts.IndexType {
    return !!(type.flags & ts.TypeFlags.Index)
  }

  function isThisTypeParameter(type: ts.Type): boolean {
    return !!(type.flags & ts.TypeFlags.TypeParameter && (type as any).isThisType)
  }

  function getTypeParameterAtPosition(signature: ts.Signature, pos: number): ts.Type {
    const type = typeChecker.getParameterType(signature, pos)
    if (isIndexType(type) && isThisTypeParameter(type.type)) {
      const constraint = typeChecker.getBaseConstraintOfType(type.type)
      if (constraint) {
        return typeChecker.getIndexType(constraint)
      }
    }
    return type
  }

  const unrollUnionMembers = (type: ts.Type) => {
    const result: Array<ts.Type> = []
    let toTest: Array<ts.Type> = [type]
    while (toTest.length > 0) {
      const type = toTest.pop()!
      if (isUnion(type)) {
        toTest = toTest.concat(type.types)
      } else {
        result.push(type)
      }
    }
    return result
  }

  const getMissingTypeEntriesInTargetType = function(realType: ts.Type, expectedType: ts.Type) {
    if (realType === expectedType) return []

    const result: Array<ts.Type> = []
    let toTest: Array<ts.Type> = [realType]
    while (toTest.length > 0) {
      const type = toTest.pop()
      if (!type) return result
      if (isUnion(type)) {
        toTest = toTest.concat(type.types)
      } else {
        const assignable = typeChecker.isTypeAssignableTo(type, expectedType)
        if (!assignable) {
          result.push(type)
        }
      }
    }
    return result
  }

  /**
   * Appends a type to a map of unique types, ensuring that the type is not already in the map.
   *
   * @param memory - The map that will be used as memory and updated as new types are encountered.
   * @param initialType - The type to start with, unions will be unrolled.
   * @param shouldExclude - A function that determines if a type should be excluded from the checking
   * @returns An object with the following properties:
   * - newIndexes: A set of new indexes that were added to the memory.
   * - knownIndexes: A set of indexes that were already in the memory.
   * - allIndexes: A set of all indexes that were encountered.
   */
  const appendToUniqueTypesMap = Nano.fn(
    "TypeCheckerUtils.appendToUniqueTypesMap"
  )(
    function*<E, R>(
      memory: Map<string, ts.Type>,
      initialType: ts.Type,
      shouldExclude: (type: ts.Type) => Nano.Nano<boolean, E, R>
    ) {
      const newIndexes: Set<string> = new Set()
      const knownIndexes: Set<string> = new Set()
      let toTest: Array<ts.Type> = [initialType]
      while (toTest.length > 0) {
        const type = toTest.pop()
        if (!type) break
        if (yield* shouldExclude(type)) {
          continue
        }
        if (isUnion(type)) {
          toTest = toTest.concat(type.types)
        } else {
          const foundMatch: Array<string> = []
          for (const [typeId, knownType] of memory.entries()) {
            const areSame = typeChecker.isTypeAssignableTo(knownType, type) &&
              typeChecker.isTypeAssignableTo(type, knownType)
            if (areSame) {
              foundMatch.push(typeId)
              break
            }
          }
          if (foundMatch.length === 0) {
            const newId = "t" + (memory.size + 1)
            memory.set(newId, type)
            newIndexes.add(newId)
          } else {
            knownIndexes.add(foundMatch[0])
          }
        }
      }
      return {
        newIndexes,
        knownIndexes,
        allIndexes: pipe(
          Array.fromIterable(newIndexes),
          Array.appendAll(Array.fromIterable(knownIndexes))
        )
      }
    }
  )

  return {
    isUnion,
    getTypeParameterAtPosition,
    getMissingTypeEntriesInTargetType,
    unrollUnionMembers,
    appendToUniqueTypesMap
  }
}
