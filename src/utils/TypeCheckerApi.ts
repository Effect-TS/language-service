import * as Data from "effect/Data"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as Nano from "./Nano.js"
import * as TypeScriptApi from "./TypeScriptApi.js"

export interface TypeCheckerApi extends ts.TypeChecker {}
export const TypeCheckerApi = Nano.Tag<TypeCheckerApi>("TypeChecker")

export function getMissingTypeEntriesInTargetType(realType: ts.Type, expectedType: ts.Type) {
  return Nano.gen(function*() {
    const typeChecker = yield* Nano.service(TypeCheckerApi)

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
  })
}

type ConvertibleDeclaration =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration

class CannotFindAncestorConvertibleDeclarationError
  extends Data.TaggedError("CannotFindAncestorConvertibleDeclarationError")<{
    node: ts.Node
  }>
{}

function getAncestorConvertibleDeclaration(node: ts.Node) {
  return Nano.gen(function*() {
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
    return yield* Nano.fail(new CannotFindAncestorConvertibleDeclarationError({ node }))
  })
}

class CannotInferReturnTypeFromEmptyBody
  extends Data.TaggedError("CannotInferReturnTypeFromEmptyBody")<{
    declaration: ConvertibleDeclaration
  }>
{}

class CannotInferReturnType extends Data.TaggedError("CannotInferReturnType")<{
  declaration: ConvertibleDeclaration
}> {}

export function getInferredReturnType(
  declaration: ConvertibleDeclaration
): Nano.Nano<
  ts.Type,
  CannotInferReturnTypeFromEmptyBody | CannotInferReturnType,
  ts.TypeChecker | TypeScriptApi.TypeScriptApi
> {
  return Nano.gen(function*() {
    const typeChecker = yield* Nano.service(TypeCheckerApi)

    if (!declaration.body) {
      return yield* Nano.fail(
        new CannotInferReturnTypeFromEmptyBody({ declaration })
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
        new CannotInferReturnType({ declaration })
      )
    }

    return returnType
  })
}

export function expectedAndRealType(
  node: ts.Node
): Nano.Nano<
  Array<[ts.Node, ts.Type, ts.Node, ts.Type]>,
  never,
  ts.TypeChecker | TypeScriptApi.TypeScriptApi
> {
  return Nano.gen(function*() {
    const typeChecker = yield* Nano.service(TypeCheckerApi)
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    if (ts.isVariableDeclaration(node) && node.initializer) {
      const expectedType = typeChecker.getTypeAtLocation(node.name)
      const realType = typeChecker.getTypeAtLocation(node.initializer)
      return [[node.name, expectedType, node.initializer, realType]]
    }
    if (ts.isCallExpression(node)) {
      const resolvedSignature = typeChecker.getResolvedSignature(node)
      if (resolvedSignature) {
        return resolvedSignature.getParameters().map((parameter, index) => {
          const expectedType = typeChecker.getTypeOfSymbolAtLocation(parameter, node)
          const realType = typeChecker.getTypeAtLocation(node.arguments[index])
          return [node.arguments[index], expectedType, node.arguments[index], realType]
        })
      }
    }
    if (
      ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node)
    ) {
      const parent = node.parent
      if (ts.isObjectLiteralElement(parent)) {
        if (ts.isObjectLiteralExpression(parent.parent) && parent.name === node) {
          const type = typeChecker.getContextualType(parent.parent)
          if (type) {
            const symbol = typeChecker.getPropertyOfType(type, node.text)
            if (symbol) {
              const expectedType = typeChecker.getTypeOfSymbolAtLocation(symbol, node)
              const realType = typeChecker.getTypeAtLocation(node)
              return [[node, expectedType, node, realType]]
            }
          }
        }
      }
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const expectedType = typeChecker.getTypeAtLocation(node.left)
      const realType = typeChecker.getTypeAtLocation(node.right)
      return [[node.left, expectedType, node.right, realType]]
    }
    if (ts.isReturnStatement(node) && node.expression) {
      const parentDeclaration = yield* Nano.option(getAncestorConvertibleDeclaration(node))
      if (Option.isSome(parentDeclaration)) {
        const expectedType = yield* Nano.option(getInferredReturnType(parentDeclaration.value))
        const realType = typeChecker.getTypeAtLocation(node.expression)
        if (Option.isSome(expectedType)) return [[node, expectedType.value, node, realType]]
      }
    }
    if (ts.isArrowFunction(node) && ts.isExpression(node.body)) {
      const body = node.body
      const expectedType = typeChecker.getContextualType(body)
      const realType = typeChecker.getTypeAtLocation(body)
      if (expectedType) return [[body, expectedType, body, realType]]
    }
    if (ts.isSatisfiesExpression(node)) {
      const expectedType = typeChecker.getTypeAtLocation(node.type)
      const realType = typeChecker.getTypeAtLocation(node.expression)
      return [[node.expression, expectedType, node.expression, realType]]
    }
    return []
  })
}
