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

export function varianceStructCovariantType(
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
      A: varianceStructCovariantType(ts, typeChecker)(type, atLocation, "_A"),
      E: varianceStructCovariantType(ts, typeChecker)(type, atLocation, "_E"),
      R: varianceStructCovariantType(ts, typeChecker)(type, atLocation, "_R")
    })
}

export function effectType(ts: TypeScriptApi, typeChecker: ts.TypeChecker) {
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

export function fiberType(ts: TypeScriptApi, typeChecker: ts.TypeChecker) {
  return (type: ts.Type, atLocation: ts.Node) =>
    Option.gen(function*(_) {
      // there is no better way to check if a type is a fiber right not
      // so we just check for the existence of the property "await" and "poll"
      const awaitSymbol = yield* Option.fromNullable(
        typeChecker.getPropertyOfType(type, "await")
      )
      const pollSymbol = yield* Option.fromNullable(
        typeChecker.getPropertyOfType(type, "poll")
      )
      if (!awaitSymbol || !pollSymbol) return yield* Option.none()
      // and it is also an effect itself
      return effectType(ts, typeChecker)(type, atLocation)
    })
}

export function effectSubtype(ts: TypeScriptApi, typeChecker: ts.TypeChecker) {
  return (type: ts.Type, atLocation: ts.Node) =>
    Option.gen(function*(_) {
      // there is no better way to check if a type is a subtype of effect
      // so we just check for the existence of the property "_tag"
      // which is common for Option, Either, and others
      const tagSymbol = yield* Option.fromNullable(
        typeChecker.getPropertyOfType(type, "_tag")
      )
      if (!tagSymbol) return yield* Option.none()
      // and it is also an effect itself
      return effectType(ts, typeChecker)(type, atLocation)
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
      return yield* effectType(ts, typeChecker)(propertyType, node).pipe(
        Option.map(() => node as ts.Expression)
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
      // firsta argument is a generator function expression
      const generatorFunction = node.arguments[0]
      if (!ts.isFunctionExpression(generatorFunction)) return yield* Option.none()
      if (generatorFunction.asteriskToken === undefined) return yield* Option.none()
      // Effect.gen
      if (!ts.isPropertyAccessExpression(node.expression)) return yield* Option.none()
      const propertyAccess = node.expression
      // gen
      if (propertyAccess.name.text !== "gen") return yield* Option.none()
      // check Effect module
      const effectModule = yield* importedEffectModule(ts, typeChecker)(propertyAccess.expression)
      return ({
        node,
        effectModule,
        generatorFunction,
        body: generatorFunction.body,
        functionStar: generatorFunction.getFirstToken()
      })
    })
}

export function effectFnUntracedGen(ts: TypeScriptApi, typeChecker: ts.TypeChecker) {
  return (node: ts.Node) =>
    Option.gen(function*() {
      // Effect.gen(...)
      if (!ts.isCallExpression(node)) return yield* Option.none()
      // ...
      if (node.arguments.length === 0) return yield* Option.none()
      // firsta argument is a generator function expression
      const generatorFunction = node.arguments[0]
      if (!ts.isFunctionExpression(generatorFunction)) return yield* Option.none()
      if (generatorFunction.asteriskToken === undefined) return yield* Option.none()
      // Effect.gen
      if (!ts.isPropertyAccessExpression(node.expression)) return yield* Option.none()
      const propertyAccess = node.expression
      // gen
      if (propertyAccess.name.text !== "fnUntraced") return yield* Option.none()
      // check Effect module
      const effectModule = yield* importedEffectModule(ts, typeChecker)(propertyAccess.expression)
      return ({
        node,
        effectModule,
        generatorFunction,
        body: generatorFunction.body,
        functionStar: generatorFunction.getFirstToken()
      })
    })
}

export function effectFnGen(ts: TypeScriptApi, typeChecker: ts.TypeChecker) {
  return (node: ts.Node) =>
    Option.gen(function*() {
      // Effect.fn(...)
      if (!ts.isCallExpression(node)) return yield* Option.none()
      // ...
      if (node.arguments.length === 0) return yield* Option.none()
      // firsta argument is a generator function expression
      const generatorFunction = node.arguments[0]
      if (!ts.isFunctionExpression(generatorFunction)) return yield* Option.none()
      if (generatorFunction.asteriskToken === undefined) return yield* Option.none()
      // either we are using Effect.fn("name")(generatorFunction) or we are using Effect.fn(generatorFunction)
      const expressionToTest = ts.isCallExpression(node.expression)
        ? node.expression.expression
        : node.expression
      if (!ts.isPropertyAccessExpression(expressionToTest)) return yield* Option.none()
      const propertyAccess = expressionToTest
      // fn
      if (propertyAccess.name.text !== "fn") return yield* Option.none()
      // check Effect module
      const effectModule = yield* importedEffectModule(ts, typeChecker)(propertyAccess.expression)
      return ({
        node,
        generatorFunction,
        effectModule,
        body: generatorFunction.body,
        functionStar: generatorFunction.getFirstToken()
      })
    })
}
