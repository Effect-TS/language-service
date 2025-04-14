import * as Option from "effect/Option"
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

type ConvertibleDeclaration =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration

export function getInferredReturnType(ts: TypeScriptApi, typeChecker: ts.TypeChecker) {
  function isConvertibleDeclaration(node: ts.Node): node is ConvertibleDeclaration {
    switch (node.kind) {
      case ts.SyntaxKind.FunctionDeclaration:
      case ts.SyntaxKind.FunctionExpression:
      case ts.SyntaxKind.ArrowFunction:
      case ts.SyntaxKind.MethodDeclaration:
        return true
      default:
        return false
    }
  }

  return (node: ts.Node): Option.Option<ts.Type> => {
    let declaration = node
    while(declaration && !isConvertibleDeclaration(declaration)){
      declaration = declaration.parent
    }
    if(!isConvertibleDeclaration(declaration)) return Option.none()

    if (!declaration || !declaration.body) {
      return Option.none()
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
          return Option.some(typePredicate.type)
        } else {
          returnType = typeChecker.getReturnTypeOfSignature(signature)
        }
      }
    }

    if (!returnType) {
      return Option.none()
    }

    console.log(typeChecker.typeToString(returnType))

    return Option.some(returnType)
  }
}

export function expectedAndRealType(ts: TypeScriptApi, typeChecker: ts.TypeChecker) {
  return (node: ts.Node): Array<[ts.Node, ts.Type, ts.Node, ts.Type]> => {
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
      const expectedType = Option.getOrUndefined(getInferredReturnType(ts, typeChecker)(node))
      const realType = typeChecker.getTypeAtLocation(node.expression)
      if (expectedType) {
        console.log("expected type", typeChecker.typeToString(expectedType), "vs", typeChecker.typeToString(realType))
        return [[node, expectedType, node, realType]]
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
  }
}
