import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Order from "effect/Order"
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
  deterministicTypeOrder: Order.Order<ts.Type>
  getInferredReturnType: (declaration: ConvertibleDeclaration) => ts.Type | undefined
  expectedAndRealType: (sourceFile: ts.SourceFile) => Array<ExpectedAndRealType>
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

export type ExpectedAndRealType = [
  node: ts.Node,
  expectedType: ts.Type,
  valueNode: ts.Node,
  realType: ts.Type
]

type ConvertibleDeclaration =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration

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

  const deterministicTypeOrder = Order.make((a: ts.Type, b: ts.Type) => {
    const aName = typeChecker.typeToString(a)
    const bName = typeChecker.typeToString(b)
    if (aName < bName) return -1
    if (aName > bName) return 1
    return 0
  })

  const getAncestorConvertibleDeclaration = (node: ts.Node) => {
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
  }

  const getInferredReturnType = (
    declaration: ConvertibleDeclaration
  ) => {
    if (!declaration.body) {
      return
    }

    let returnType: ts.Type | undefined

    if (typeChecker.isImplementationOfOverload(declaration)) {
      const signatures = typeChecker.getSignaturesOfType(
        typeChecker.getTypeAtLocation(declaration),
        ts.SignatureKind.Call
      )
      if (signatures.length > 1) {
        returnType = typeChecker.getUnionType(
          signatures.map((s) => typeChecker.getReturnTypeOfSignature(s)).filter((_) => !!_)
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

    return returnType
  }

  const expectedAndRealTypeCache = new WeakMap<ts.SourceFile, Array<ExpectedAndRealType>>()
  const expectedAndRealType = (
    sourceFile: ts.SourceFile
  ) => {
    const cached = expectedAndRealTypeCache.get(sourceFile)
    if (cached) return cached
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
          resolvedSignature.parameters.map((parameter, index) => {
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
              const name = ts.isIdentifier(node) ? ts.idText(node) : ts.isStringLiteral(node) ? node.text : undefined
              if (name) {
                const symbol = typeChecker.getPropertyOfType(type, name)
                if (symbol) {
                  const expectedType = typeChecker.getTypeOfSymbolAtLocation(symbol, node)
                  const realType = typeChecker.getTypeAtLocation(node)
                  result.push([node, expectedType, node, realType])
                }
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
        const parentDeclaration = getAncestorConvertibleDeclaration(node)
        if (parentDeclaration) {
          const expectedType = getInferredReturnType(parentDeclaration)
          const realType = typeChecker.getTypeAtLocation(node.expression)
          if (expectedType) {
            result.push([node, expectedType, node, realType])
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
        const expectedType = getInferredReturnType(node)
        const realType = typeChecker.getTypeAtLocation(body)
        if (expectedType) {
          result.push([body, expectedType, body, realType])
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
    expectedAndRealTypeCache.set(sourceFile, result)
    return result
  }

  return {
    isUnion,
    getTypeParameterAtPosition,
    getMissingTypeEntriesInTargetType,
    unrollUnionMembers,
    appendToUniqueTypesMap,
    deterministicTypeOrder,
    getInferredReturnType,
    expectedAndRealType
  }
}
