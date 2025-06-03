import * as Option from "effect/Option"
import type ts from "typescript"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export class TypeParserIssue {
  readonly _tag = "@effect/language-service/TypeParserIssue"
  constructor(
    readonly type: ts.Type | undefined,
    readonly node: ts.Node | undefined,
    readonly message: string
  ) {
  }
}

function typeParserIssue(
  message: string,
  type?: ts.Type | undefined,
  node?: ts.Node | undefined
): Nano.Nano<never, TypeParserIssue, never> {
  return Nano.fail(new TypeParserIssue(type, node, message))
}

export function covariantTypeArgument(type: ts.Type): Nano.Nano<ts.Type, TypeParserIssue> {
  const signatures = type.getCallSignatures()
  // Covariant<A> has only 1 type signature
  if (signatures.length !== 1) {
    return typeParserIssue("Covariant type has no call signature", type)
  }
  // get the return type
  return Nano.succeed(signatures[0].getReturnType())
}

export function invariantTypeArgument(type: ts.Type): Nano.Nano<ts.Type, TypeParserIssue> {
  const signatures = type.getCallSignatures()
  // Invariant<A> has only 1 type signature
  if (signatures.length !== 1) {
    return typeParserIssue("Invariant type has no call signature", type)
  }
  // get the return type
  return Nano.succeed(signatures[0].getReturnType())
}

export const pipeableType = Nano.fn("TypeParser.pipeableType")(function*(
  type: ts.Type,
  atLocation: ts.Node
) {
  const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
  // Pipeable has a pipe property on the type
  const pipeSymbol = typeChecker.getPropertyOfType(type, "pipe")
  if (!pipeSymbol) {
    return yield* typeParserIssue("Type has no 'pipe' property", type, atLocation)
  }
  // which should be callable with at least one call signature
  const pipeType = typeChecker.getTypeOfSymbolAtLocation(pipeSymbol, atLocation)
  const signatures = pipeType.getCallSignatures()
  if (signatures.length === 0) {
    return yield* typeParserIssue("'pipe' property is not callable", type, atLocation)
  }
  return type
})

export const varianceStructCovariantType = Nano.fn("TypeParser.varianceStructCovariantType")(
  function*<A extends string>(
    type: ts.Type,
    atLocation: ts.Node,
    propertyName: A
  ) {
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const propertySymbol = typeChecker.getPropertyOfType(type, propertyName)
    if (!propertySymbol) {
      return yield* typeParserIssue(`Type has no '${propertyName}' property`, type, atLocation)
    }
    const propertyType = typeChecker.getTypeOfSymbolAtLocation(propertySymbol, atLocation)
    return yield* covariantTypeArgument(propertyType)
  }
)
export const varianceStructInvariantType = Nano.fn("TypeParser.varianceStructInvariantType")(
  function*<A extends string>(
    type: ts.Type,
    atLocation: ts.Node,
    propertyName: A
  ) {
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const propertySymbol = typeChecker.getPropertyOfType(type, propertyName)
    if (!propertySymbol) {
      return yield* typeParserIssue(`Type has no '${propertyName}' property`, type, atLocation)
    }
    const propertyType = typeChecker.getTypeOfSymbolAtLocation(propertySymbol, atLocation)
    return yield* invariantTypeArgument(propertyType)
  }
)

export const effectVarianceStruct = Nano.fn("TypeParser.effectVarianceStruct")(function*(
  type: ts.Type,
  atLocation: ts.Node
) {
  return ({
    A: yield* varianceStructCovariantType(type, atLocation, "_A"),
    E: yield* varianceStructCovariantType(type, atLocation, "_E"),
    R: yield* varianceStructCovariantType(type, atLocation, "_R")
  })
})

export const effectType = Nano.fn("TypeParser.effectType")(function*(
  type: ts.Type,
  atLocation: ts.Node
) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
  // should be pipeable
  yield* pipeableType(type, atLocation)
  // get the properties to check (exclude non-property and optional properties)
  const propertiesSymbols = typeChecker.getPropertiesOfType(type).filter((_) =>
    _.flags & ts.SymbolFlags.Property && !(_.flags & ts.SymbolFlags.Optional)
  )
  // try to put typeid first (heuristic to optimize hot path)
  propertiesSymbols.sort((a, b) => b.name.indexOf("EffectTypeId") - a.name.indexOf("EffectTypeId"))
  // has a property symbol which is an effect variance struct
  for (const propertySymbol of propertiesSymbols) {
    const propertyType = typeChecker.getTypeOfSymbolAtLocation(propertySymbol, atLocation)
    const varianceArgs = yield* Nano.option(effectVarianceStruct(
      propertyType,
      atLocation
    ))
    if (Option.isSome(varianceArgs)) {
      return varianceArgs.value
    }
  }
  return yield* typeParserIssue("Type has no effect variance struct", type, atLocation)
})

export const fiberType = Nano.fn("TypeParser.fiberType")(function*(
  type: ts.Type,
  atLocation: ts.Node
) {
  const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
  // there is no better way to check if a type is a fiber right not
  // so we just check for the existence of the property "await" and "poll"
  const awaitSymbol = typeChecker.getPropertyOfType(type, "await")
  const pollSymbol = typeChecker.getPropertyOfType(type, "poll")
  if (!awaitSymbol || !pollSymbol) {
    return yield* typeParserIssue(
      "Type is not a fiber because it does not have 'await' or 'poll' property",
      type,
      atLocation
    )
  }
  // and it is also an effect itself
  return yield* effectType(type, atLocation)
})

export const effectSubtype = Nano.fn("TypeParser.effectSubtype")(function*(
  type: ts.Type,
  atLocation: ts.Node
) {
  const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
  // there is no better way to check if a type is a subtype of effect
  // so we just check for the existence of the property "_tag"
  // which is common for Option, Either, and others
  const tagSymbol = typeChecker.getPropertyOfType(type, "_tag")
  if (!tagSymbol) {
    return yield* typeParserIssue(
      "Type is not a subtype of effect because it does not have '_tag' property",
      type,
      atLocation
    )
  }
  // and it is also an effect itself
  return yield* effectType(type, atLocation)
})

export const importedEffectModule = Nano.fn("TypeParser.importedEffectModule")(function*(
  node: ts.Node
) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
  const type = typeChecker.getTypeAtLocation(node)
  // if the type has a property "never"
  const propertySymbol = typeChecker.getPropertyOfType(type, "never")
  if (!propertySymbol) {
    return yield* typeParserIssue("Type has no 'never' property", type, node)
  }
  // should be an expression
  if (!ts.isExpression(node)) {
    return yield* typeParserIssue("Node is not an expression", type, node)
  }
  // and the property type is an effect
  const propertyType = typeChecker.getTypeOfSymbolAtLocation(propertySymbol, node)
  yield* effectType(propertyType, node)
  // return the node itself
  return node
})

export const effectGen = Nano.fn("TypeParser.effectGen")(function*(node: ts.Node) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  // Effect.gen(...)
  if (!ts.isCallExpression(node)) {
    return yield* typeParserIssue("Node is not a call expression", undefined, node)
  }
  // ...
  if (node.arguments.length === 0) {
    return yield* typeParserIssue("Node has no arguments", undefined, node)
  }
  // firsta argument is a generator function expression
  const generatorFunction = node.arguments[0]
  if (!ts.isFunctionExpression(generatorFunction)) {
    return yield* typeParserIssue("Node is not a function expression", undefined, node)
  }
  if (generatorFunction.asteriskToken === undefined) {
    return yield* typeParserIssue("Node is not a generator function", undefined, node)
  }
  // Effect.gen
  if (!ts.isPropertyAccessExpression(node.expression)) {
    return yield* typeParserIssue("Node is not a property access expression", undefined, node)
  }
  const propertyAccess = node.expression
  // gen
  if (propertyAccess.name.text !== "gen") {
    return yield* typeParserIssue("Call expression name is not 'gen'", undefined, node)
  }
  // check Effect module
  const effectModule = yield* importedEffectModule(propertyAccess.expression)
  return ({
    node,
    effectModule,
    generatorFunction,
    body: generatorFunction.body,
    functionStar: generatorFunction.getFirstToken()
  })
})

export const effectFnUntracedGen = Nano.fn("TypeParser.effectFnUntracedGen")(
  function*(node: ts.Node) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    // Effect.gen(...)
    if (!ts.isCallExpression(node)) {
      return yield* typeParserIssue("Node is not a call expression", undefined, node)
    }
    // ...
    if (node.arguments.length === 0) {
      return yield* typeParserIssue("Node has no arguments", undefined, node)
    }
    // firsta argument is a generator function expression
    const generatorFunction = node.arguments[0]
    if (!ts.isFunctionExpression(generatorFunction)) {
      return yield* typeParserIssue("Node is not a function expression", undefined, node)
    }
    if (generatorFunction.asteriskToken === undefined) {
      return yield* typeParserIssue(
        "Node is not a generator function",
        undefined,
        node
      )
    }
    // Effect.gen
    if (!ts.isPropertyAccessExpression(node.expression)) {
      return yield* typeParserIssue(
        "Node is not a property access expression",
        undefined,
        node
      )
    }
    const propertyAccess = node.expression
    // gen
    if (propertyAccess.name.text !== "fnUntraced") {
      return yield* typeParserIssue(
        "Call expression name is not 'fnUntraced'",
        undefined,
        node
      )
    }
    // check Effect module
    const effectModule = yield* importedEffectModule(propertyAccess.expression)
    return ({
      node,
      effectModule,
      generatorFunction,
      body: generatorFunction.body,
      functionStar: generatorFunction.getFirstToken()
    })
  }
)

export const effectFnGen = Nano.fn("TypeParser.effectFnGen")(function*(node: ts.Node) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  // Effect.fn(...)
  if (!ts.isCallExpression(node)) {
    return yield* typeParserIssue("Node is not a call expression", undefined, node)
  }
  // ...
  if (node.arguments.length === 0) {
    return yield* typeParserIssue("Node has no arguments", undefined, node)
  }
  // firsta argument is a generator function expression
  const generatorFunction = node.arguments[0]
  if (!ts.isFunctionExpression(generatorFunction)) {
    return yield* typeParserIssue(
      "Node is not a function expression",
      undefined,
      node
    )
  }
  if (generatorFunction.asteriskToken === undefined) {
    return yield* typeParserIssue(
      "Node is not a generator function",
      undefined,
      node
    )
  }
  // either we are using Effect.fn("name")(generatorFunction) or we are using Effect.fn(generatorFunction)
  const expressionToTest = ts.isCallExpression(node.expression)
    ? node.expression.expression
    : node.expression
  if (!ts.isPropertyAccessExpression(expressionToTest)) {
    return yield* typeParserIssue(
      "Node is not a property access expression",
      undefined,
      node
    )
  }
  const propertyAccess = expressionToTest
  // fn
  if (propertyAccess.name.text !== "fn") {
    return yield* typeParserIssue(
      "Call expression name is not 'fn'",
      undefined,
      node
    )
  }
  // check Effect module
  const effectModule = yield* importedEffectModule(propertyAccess.expression)
  return ({
    node,
    generatorFunction,
    effectModule,
    body: generatorFunction.body,
    functionStar: generatorFunction.getFirstToken()
  })
})

export const returnYieldEffectBlock = Nano.fn("TypeParser.returnYieldEffectBlock")(function*(
  body: ts.Node
) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
  // check if the body is a block with a single effect return statement
  if (
    ts.isBlock(body) &&
    body.statements.length === 1 &&
    ts.isReturnStatement(body.statements[0]) &&
    body.statements[0].expression &&
    ts.isYieldExpression(body.statements[0].expression) &&
    body.statements[0].expression.expression
  ) {
    // get the type of the node
    const nodeToCheck = body.statements[0].expression.expression
    const type = typeChecker.getTypeAtLocation(nodeToCheck)
    yield* effectType(type, nodeToCheck)
    return nodeToCheck
  }
  return yield* typeParserIssue(
    "Node is not a return statement with a yield expression",
    undefined,
    body
  )
})

export const effectSchemaVarianceStruct = Nano.fn("TypeParser.effectSchemaVarianceStruct")(
  function*(
    type: ts.Type,
    atLocation: ts.Node
  ) {
    return ({
      A: yield* varianceStructInvariantType(type, atLocation, "_A"),
      I: yield* varianceStructInvariantType(type, atLocation, "_I"),
      R: yield* varianceStructCovariantType(type, atLocation, "_R")
    })
  }
)

export const effectSchemaType = Nano.fn("TypeParser.effectSchemaType")(function*(
  type: ts.Type,
  atLocation: ts.Node
) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
  // should be pipeable
  yield* pipeableType(type, atLocation)
  // should have an 'ast' property
  const ast = typeChecker.getPropertyOfType(type, "ast")
  if (!ast) return yield* typeParserIssue("Has no 'ast' property", type, atLocation)
  // get the properties to check (exclude non-property and optional properties)
  const propertiesSymbols = typeChecker.getPropertiesOfType(type).filter((_) =>
    _.flags & ts.SymbolFlags.Property && !(_.flags & ts.SymbolFlags.Optional)
  )
  // try to put typeid first (heuristic to optimize hot path)
  propertiesSymbols.sort((a, b) => b.name.indexOf("TypeId") - a.name.indexOf("TypeId"))
  // has a property symbol which is an effect variance struct
  for (const propertySymbol of propertiesSymbols) {
    const propertyType = typeChecker.getTypeOfSymbolAtLocation(propertySymbol, atLocation)
    const varianceArgs = yield* Nano.option(effectSchemaVarianceStruct(
      propertyType,
      atLocation
    ))
    if (Option.isSome(varianceArgs)) {
      return varianceArgs.value
    }
  }
  return yield* typeParserIssue("Type has no schema variance struct", type, atLocation)
})
