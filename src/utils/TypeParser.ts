import * as Option from "effect/Option"
import type ts from "typescript"

export type TypeScriptApi = typeof ts

export const covariantTypeArgument = (type: ts.Type) => {
  const signatures = type.getCallSignatures()
  // Covariant<A> has only 1 type signature
  if (signatures.length !== 1) return Option.none()
  // get the return type
  return Option.some(signatures[0].getReturnType())
}

export function pipeableType(ts: TypeScriptApi, typeChecker: ts.TypeChecker) {
  return (type: ts.Type, atLocation: ts.Node) => {
    // Pipeable has a pipe property on the type
    const pipeSymbol = typeChecker.getPropertyOfType(type, "pipe")
    if (!pipeSymbol) return Option.none()
    // which should be callable with at least one call signature
    const pipeType = typeChecker.getTypeOfSymbolAtLocation(pipeSymbol, atLocation)
    const signatures = pipeType.getCallSignatures()
    if (signatures.length === 0) return Option.none()
    return Option.some(type)
  }
}

export function varianceStructCovariant(
  ts: TypeScriptApi,
  typeChecker: ts.TypeChecker
) {
  return <A extends string>(type: ts.Type, atLocation: ts.Node, propertyName: A) =>
    Option.gen(function*(_) {
      const propertySymbol = yield* Option.fromNullable(
        typeChecker.getPropertyOfType(type, propertyName)
      )
      const propertyType = typeChecker.getTypeOfSymbolAtLocation(propertySymbol, atLocation)
      return yield* covariantTypeArgument(propertyType)
    })
}

export function effectVarianceStruct(ts: TypeScriptApi, typeChecker: ts.TypeChecker) {
  return (type: ts.Type, atLocation: ts.Node) =>
    Option.all({
      A: varianceStructCovariant(ts, typeChecker)(type, atLocation, "_A"),
      E: varianceStructCovariant(ts, typeChecker)(type, atLocation, "_E"),
      R: varianceStructCovariant(ts, typeChecker)(type, atLocation, "_R")
    })
}

export function effectTypeArguments(ts: TypeScriptApi, typeChecker: ts.TypeChecker) {
  return (type: ts.Type, atLocation: ts.Node) =>
    Option.gen(function*(_) {
      // should be pipeable
      yield* pipeableType(ts, typeChecker)(type, atLocation)
      // has a property symbol which is an effect variance struct
      for (const propertySymbol of typeChecker.getPropertiesOfType(type)) {
        const propertyType = typeChecker.getTypeOfSymbolAtLocation(propertySymbol, atLocation)
        const varianceArgs = effectVarianceStruct(ts, typeChecker)(
          propertyType,
          atLocation
        )
        if (Option.isSome(varianceArgs)) {
          return yield* varianceArgs
        }
      }
      return yield* Option.none()
    })
}

export function importedEffectModule(ts: TypeScriptApi, typeChecker: ts.TypeChecker) {
  return (node: ts.Node) =>
    Option.gen(function*() {
      const type = typeChecker.getTypeAtLocation(node)
      // if the type has a property "never"
      const propertySymbol = yield* Option.fromNullable(
        typeChecker.getPropertyOfType(type, "never")
      )
      // and the property type is an effect
      const propertyType = typeChecker.getTypeOfSymbolAtLocation(propertySymbol, node)
      return yield* effectTypeArguments(ts, typeChecker)(propertyType, node).pipe(
        Option.map(() => node)
      )
    })
}

export function effectGen(ts: TypeScriptApi, typeChecker: ts.TypeChecker) {
  return (node: ts.Node) =>
    Option.gen(function*() {
      // Effect.gen(...)
      if (!ts.isCallExpression(node)) return yield* Option.none()
      // ...
      if (node.arguments.length === 0) return yield* Option.none()
      // Effect.gen
      if (!ts.isPropertyAccessExpression(node.expression)) return yield* Option.none()
      const propertyAccess = node.expression
      // gen
      if (propertyAccess.name.text !== "gen") return yield* Option.none()
      // Effect
      return yield* importedEffectModule(ts, typeChecker)(propertyAccess.expression).pipe(
        Option.map(() => node)
      )
    })
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
      const expectedType = typeChecker.getContextualType(node.expression)
      const realType = typeChecker.getTypeAtLocation(node.expression)
      if (expectedType) return [[node, expectedType, node, realType]]
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
