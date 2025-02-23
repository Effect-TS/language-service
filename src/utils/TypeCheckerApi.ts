import type ts from "typescript"
import type { TypeScriptApi } from "./TSAPI.js"

export function getMissingTypeEntriesInTargetType(ts: TypeScriptApi, typeChecker: ts.TypeChecker) {
  return (realType: ts.Type, expectedType: ts.Type) => {
    const result: Array<ts.Type> = []
    const toTest: Array<ts.Type> = [realType]
    while (toTest.length > 0) {
      const type = toTest.pop()
      if (!type) return result
      if (type.isUnion()) {
        toTest.push(...type.types)
      } else {
        const assignable = typeChecker.isTypeAssignableTo(type, expectedType)
        if (!assignable) {
          result.push(type)
        }
      }
    }
    return result
  }
}
