import * as Array from "effect/Array"
import { isFunction, pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as Order from "effect/Order"
import { hasProperty } from "effect/Predicate"
import type ts from "typescript"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "./TypeScriptApi.js"

export interface TypeCheckerApi extends ts.TypeChecker {}
export const TypeCheckerApi = Nano.Tag<TypeCheckerApi>("TypeChecker")

export type TypeCheckerApiCache = {
  expectedAndRealType: WeakMap<ts.SourceFile, Array<ExpectedAndRealType>>
}
export const TypeCheckerApiCache = Nano.Tag<TypeCheckerApiCache>("TypeCheckerApiCache")

export function makeTypeCheckerApiCache(): TypeCheckerApiCache {
  return {
    expectedAndRealType: new WeakMap()
  }
}

export const deterministicTypeOrder = Nano.gen(function*() {
  const typeChecker = yield* Nano.service(TypeCheckerApi)
  return Order.make((a: ts.Type, b: ts.Type) => {
    const aName = typeChecker.typeToString(a)
    const bName = typeChecker.typeToString(b)
    if (aName < bName) return -1
    if (aName > bName) return 1
    return 0
  })
})

export const getMissingTypeEntriesInTargetType = Nano.fn(
  "TypeCheckerApi.getMissingTypeEntriesInTargetType"
)(
  function*(realType: ts.Type, expectedType: ts.Type) {
    if (realType === expectedType) return []
    const typeChecker = yield* Nano.service(TypeCheckerApi)

    const result: Array<ts.Type> = []
    let toTest: Array<ts.Type> = [realType]
    while (toTest.length > 0) {
      const type = toTest.pop()
      if (!type) return result
      if (type.isUnion()) {
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
)

type ConvertibleDeclaration =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration

class CannotFindAncestorConvertibleDeclarationError {
  readonly _tag = "@effect/language-service/CannotFindAncestorConvertibleDeclarationError"
  constructor(
    readonly node: ts.Node
  ) {}
}

const getAncestorConvertibleDeclaration = Nano.fn(
  "TypeCheckerApi.getAncestorConvertibleDeclaration"
)(function*(node: ts.Node) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  let current: ts.Node | undefined = node
  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isMethodDeclaration(current)
    ) {
      return current
    }
    current = current.parent
  }
  return yield* Nano.fail(new CannotFindAncestorConvertibleDeclarationError(node))
})

class CannotInferReturnTypeFromEmptyBody {
  readonly _tag = "@effect/language-service/CannotInferReturnTypeFromEmptyBody"
  constructor(
    readonly declaration: ConvertibleDeclaration
  ) {}
}

class CannotInferReturnType {
  readonly _tag = "@effect/language-service/CannotInferReturnType"
  constructor(
    readonly declaration: ConvertibleDeclaration
  ) {}
}

export const getInferredReturnType = Nano.fn("TypeCheckerApi.getInferredReturnType")(function*(
  declaration: ConvertibleDeclaration
) {
  const typeChecker = yield* Nano.service(TypeCheckerApi)

  if (!declaration.body) {
    return yield* Nano.fail(
      new CannotInferReturnTypeFromEmptyBody(declaration)
    )
  }

  let returnType: ts.Type | undefined

  if (typeChecker.isImplementationOfOverload(declaration)) {
    const signatures = typeChecker.getTypeAtLocation(declaration).getCallSignatures()
    if (signatures.length > 1) {
      returnType = typeChecker.getUnionType(
        signatures.map((s) => s.getReturnType()).filter((_) => !!_)
      )
    }
  }
  if (!returnType) {
    const signature = typeChecker.getSignatureFromDeclaration(declaration)
    if (signature) {
      const typePredicate = typeChecker.getTypePredicateOfSignature(signature)
      if (typePredicate && typePredicate.type) {
        return typePredicate.type
      } else {
        returnType = typeChecker.getReturnTypeOfSignature(signature)
      }
    }
  }

  if (!returnType) {
    return yield* Nano.fail(
      new CannotInferReturnType(declaration)
    )
  }

  return returnType
})

type ExpectedAndRealType = [
  node: ts.Node,
  expectedType: ts.Type,
  valueNode: ts.Node,
  realType: ts.Type
]

export const expectedAndRealType = Nano.fn("TypeCheckerApi.expectedAndRealType")(function*(
  sourceFile: ts.SourceFile
) {
  const cache = yield* Nano.service(TypeCheckerApiCache)
  const resultCached = cache.expectedAndRealType.get(sourceFile)
  if (resultCached) return resultCached

  const typeChecker = yield* Nano.service(TypeCheckerApi)
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const result: Array<ExpectedAndRealType> = []

  const nodeToVisit: Array<ts.Node> = [sourceFile]
  const appendNodeToVisit = (node: ts.Node) => {
    nodeToVisit.push(node)
    return undefined
  }

  while (nodeToVisit.length > 0) {
    const node = nodeToVisit.shift()!

    if (ts.isVariableDeclaration(node) && node.initializer) {
      // const a: Effect<...> = node
      const expectedType = typeChecker.getTypeAtLocation(node.name)
      const realType = typeChecker.getTypeAtLocation(node.initializer)
      result.push([node.name, expectedType, node.initializer, realType])
      appendNodeToVisit(node.initializer)
      continue
    } else if (ts.isCallExpression(node)) {
      // fn(a)
      const resolvedSignature = typeChecker.getResolvedSignature(node)
      if (resolvedSignature) {
        resolvedSignature.getParameters().map((parameter, index) => {
          const expectedType = typeChecker.getTypeOfSymbolAtLocation(parameter, node)
          const realType = typeChecker.getTypeAtLocation(node.arguments[index])
          result.push([
            node.arguments[index] as ts.Node,
            expectedType,
            node.arguments[index],
            realType
          ])
        })
      }
      ts.forEachChild(node, appendNodeToVisit)
      continue
    } else if (
      ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node)
    ) {
      // { key: node } as { key: Effect<...> }
      const parent = node.parent
      if (ts.isObjectLiteralElement(parent)) {
        if (ts.isObjectLiteralExpression(parent.parent) && parent.name === node) {
          const type = typeChecker.getContextualType(parent.parent)
          if (type) {
            const symbol = typeChecker.getPropertyOfType(type, node.text)
            if (symbol) {
              const expectedType = typeChecker.getTypeOfSymbolAtLocation(symbol, node)
              const realType = typeChecker.getTypeAtLocation(node)
              result.push([node, expectedType, node, realType])
            }
          }
        }
      }
      ts.forEachChild(node, appendNodeToVisit)
      continue
    } else if (
      ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      // var a: Effect<...> = node
      const expectedType = typeChecker.getTypeAtLocation(node.left)
      const realType = typeChecker.getTypeAtLocation(node.right)
      result.push([node.left, expectedType, node.right, realType])
      appendNodeToVisit(node.right)
      continue
    } else if (ts.isReturnStatement(node) && node.expression) {
      // function(): Effect<...> { return a }
      const parentDeclaration = yield* Nano.option(getAncestorConvertibleDeclaration(node))
      if (Option.isSome(parentDeclaration)) {
        const expectedType = yield* Nano.option(getInferredReturnType(parentDeclaration.value))
        const realType = typeChecker.getTypeAtLocation(node.expression)
        if (Option.isSome(expectedType)) {
          result.push([node, expectedType.value, node, realType])
        }
      }
      ts.forEachChild(node, appendNodeToVisit)
      continue
    } else if (
      ts.isArrowFunction(node) && (node.typeParameters || []).length === 0 &&
      ts.isExpression(node.body)
    ) {
      // (): Effect<...> => node
      const body = node.body
      const expectedType = typeChecker.getContextualType(body)
      const realType = typeChecker.getTypeAtLocation(body)
      if (expectedType) {
        result.push([body, expectedType, body, realType])
      }
      ts.forEachChild(body, appendNodeToVisit)
      continue
    } else if (
      ts.isArrowFunction(node) && (node.typeParameters || []).length > 0 &&
      ts.isExpression(node.body)
    ) {
      // <A>(): Effect<...> => node
      const body = node.body
      const expectedType = yield* Nano.option(getInferredReturnType(node))
      const realType = typeChecker.getTypeAtLocation(body)
      if (Option.isSome(expectedType)) {
        result.push([body, expectedType.value, body, realType])
      }
      ts.forEachChild(body, appendNodeToVisit)
      continue
    } else if (ts.isSatisfiesExpression(node)) {
      // node as Effect<....>
      const expectedType = typeChecker.getTypeAtLocation(node.type)
      const realType = typeChecker.getTypeAtLocation(node.expression)
      result.push([node.expression as ts.Node, expectedType, node.expression, realType])
      appendNodeToVisit(node.expression)
      continue
    }

    // no previous case has been hit, continue with childs
    ts.forEachChild(node, appendNodeToVisit)
  }
  cache.expectedAndRealType.set(sourceFile, result)
  return result
})

export const unrollUnionMembers = (type: ts.Type) => {
  const result: Array<ts.Type> = []
  let toTest: Array<ts.Type> = [type]
  while (toTest.length > 0) {
    const type = toTest.pop()!
    if (type.isUnion()) {
      toTest = toTest.concat(type.types)
    } else {
      result.push(type)
    }
  }
  return result
}

export const appendToUniqueTypesMap = Nano.fn(
  "TypeCheckerApi.appendToUniqueTypesMap"
)(
  function*(memory: Map<string, ts.Type>, initialType: ts.Type, excludeNever: boolean) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi)

    const newIndexes: Set<string> = new Set()
    const knownIndexes: Set<string> = new Set()
    let toTest: Array<ts.Type> = [initialType]
    while (toTest.length > 0) {
      const type = toTest.pop()
      if (!type) break
      if (excludeNever && type.flags & ts.TypeFlags.Never) {
        continue
      }
      if (type.isUnion()) {
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

export function makeResolveExternalModuleName(typeChecker: TypeCheckerApi) {
  if (!(hasProperty(typeChecker, "resolveExternalModuleName") && isFunction(typeChecker.resolveExternalModuleName))) {
    return
  }
  const _internal = typeChecker.resolveExternalModuleName
  return (moduleSpecifier: ts.Expression): ts.Symbol | undefined => {
    return _internal(moduleSpecifier)
  }
}
