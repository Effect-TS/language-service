import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as AST from "./AST.js"
import * as Nano from "./Nano.js"
import type * as TypeCheckerApi from "./TypeCheckerApi.js"
import * as TypeScriptApi from "./TypeScriptApi.js"

export interface TypeParser {
  effectType: (
    type: ts.Type,
    atLocation: ts.Node
  ) => Nano.Nano<{ A: ts.Type; E: ts.Type; R: ts.Type }, TypeParserIssue>
  strictEffectType: (
    type: ts.Type,
    atLocation: ts.Node
  ) => Nano.Nano<{ A: ts.Type; E: ts.Type; R: ts.Type }, TypeParserIssue>
  layerType: (
    type: ts.Type,
    atLocation: ts.Node
  ) => Nano.Nano<{ ROut: ts.Type; E: ts.Type; RIn: ts.Type }, TypeParserIssue>
  fiberType: (
    type: ts.Type,
    atLocation: ts.Node
  ) => Nano.Nano<{ A: ts.Type; E: ts.Type; R: ts.Type }, TypeParserIssue>
  effectSubtype: (
    type: ts.Type,
    atLocation: ts.Node
  ) => Nano.Nano<{ A: ts.Type; E: ts.Type; R: ts.Type }, TypeParserIssue>
  importedEffectModule: (
    node: ts.Node
  ) => Nano.Nano<ts.Node, TypeParserIssue>
  effectGen: (
    node: ts.Node
  ) => Nano.Nano<
    {
      node: ts.Node
      effectModule: ts.Expression
      generatorFunction: ts.FunctionExpression
      body: ts.Block
      functionStar: ts.Node | undefined
    },
    TypeParserIssue
  >
  effectFnUntracedGen: (
    node: ts.Node
  ) => Nano.Nano<
    {
      node: ts.Node
      effectModule: ts.Node
      generatorFunction: ts.Node
      body: ts.Block
      functionStar: ts.Node | undefined
    },
    TypeParserIssue
  >
  effectFnGen: (
    node: ts.Node
  ) => Nano.Nano<
    {
      node: ts.Node
      generatorFunction: ts.Node
      effectModule: ts.Node
      body: ts.Block
      functionStar: ts.Node | undefined
    },
    TypeParserIssue
  >
  unnecessaryEffectGen: (
    node: ts.Node
  ) => Nano.Nano<
    { node: ts.Node; body: ts.Block; yieldedExpression: ts.Node; replacementNode: Nano.Nano<ts.Node, never, never> },
    TypeParserIssue
  >
  effectSchemaType: (
    type: ts.Type,
    atLocation: ts.Node
  ) => Nano.Nano<{ A: ts.Type; I: ts.Type; R: ts.Type }, TypeParserIssue>
  contextTag: (
    type: ts.Type,
    atLocation: ts.Node
  ) => Nano.Nano<{ Identifier: ts.Type; Service: ts.Type }, TypeParserIssue>
  pipeCall: (
    node: ts.Node
  ) => Nano.Nano<
    { node: ts.CallExpression; subject: ts.Expression; args: Array<ts.Expression> },
    TypeParserIssue,
    never
  >
  scopeType: (
    type: ts.Type,
    atLocation: ts.Node
  ) => Nano.Nano<ts.Type, TypeParserIssue>
}
export const TypeParser = Nano.Tag<TypeParser>("@effect/language-service/TypeParser")

export class TypeParserIssue {
  readonly _tag = "@effect/language-service/TypeParserIssue"
  static issue = Nano.fail(new TypeParserIssue())
}

export function make(ts: TypeScriptApi.TypeScriptApi, typeChecker: TypeCheckerApi.TypeCheckerApi): TypeParser {
  function typeParserIssue(
    _message: string,
    _type?: ts.Type | undefined,
    _node?: ts.Node | undefined
  ): Nano.Nano<never, TypeParserIssue, never> {
    return TypeParserIssue.issue
  }

  function covariantTypeArgument(type: ts.Type): Nano.Nano<ts.Type, TypeParserIssue> {
    const signatures = type.getCallSignatures()
    // Covariant<A> has only 1 type signature
    if (signatures.length !== 1) {
      return typeParserIssue("Covariant type has no call signature", type)
    }
    // get the return type
    return Nano.succeed(signatures[0].getReturnType())
  }

  function contravariantTypeArgument(type: ts.Type): Nano.Nano<ts.Type, TypeParserIssue> {
    const signatures = type.getCallSignatures()
    // Contravariant<A> has only 1 type signature
    if (signatures.length !== 1) {
      return typeParserIssue("Contravariant type has no call signature", type)
    }
    // get the return type
    return Nano.succeed(signatures[0].getTypeParameterAtPosition(0))
  }

  function invariantTypeArgument(type: ts.Type): Nano.Nano<ts.Type, TypeParserIssue> {
    const signatures = type.getCallSignatures()
    // Invariant<A> has only 1 type signature
    if (signatures.length !== 1) {
      return typeParserIssue("Invariant type has no call signature", type)
    }
    // get the return type
    return Nano.succeed(signatures[0].getReturnType())
  }

  const pipeableType = Nano.cachedBy(
    function(
      type: ts.Type,
      atLocation: ts.Node
    ) {
      // Pipeable has a pipe property on the type
      const pipeSymbol = typeChecker.getPropertyOfType(type, "pipe")
      if (!pipeSymbol) {
        return typeParserIssue("Type has no 'pipe' property", type, atLocation)
      }
      // which should be callable with at least one call signature
      const pipeType = typeChecker.getTypeOfSymbolAtLocation(pipeSymbol, atLocation)
      const signatures = pipeType.getCallSignatures()
      if (signatures.length === 0) {
        return typeParserIssue("'pipe' property is not callable", type, atLocation)
      }
      return Nano.succeed(type)
    },
    "TypeParser.pipeableType",
    (type) => type
  )

  const varianceStructCovariantType = <A extends string>(
    type: ts.Type,
    atLocation: ts.Node,
    propertyName: A
  ) => {
    const propertySymbol = typeChecker.getPropertyOfType(type, propertyName)
    if (!propertySymbol) {
      return typeParserIssue(`Type has no '${propertyName}' property`, type, atLocation)
    }
    const propertyType = typeChecker.getTypeOfSymbolAtLocation(propertySymbol, atLocation)
    return covariantTypeArgument(propertyType)
  }

  const varianceStructContravariantType = <A extends string>(
    type: ts.Type,
    atLocation: ts.Node,
    propertyName: A
  ) => {
    const propertySymbol = typeChecker.getPropertyOfType(type, propertyName)
    if (!propertySymbol) {
      return typeParserIssue(`Type has no '${propertyName}' property`, type, atLocation)
    }
    const propertyType = typeChecker.getTypeOfSymbolAtLocation(propertySymbol, atLocation)
    return contravariantTypeArgument(propertyType)
  }

  const varianceStructInvariantType = <A extends string>(
    type: ts.Type,
    atLocation: ts.Node,
    propertyName: A
  ) => {
    const propertySymbol = typeChecker.getPropertyOfType(type, propertyName)
    if (!propertySymbol) {
      return typeParserIssue(`Type has no '${propertyName}' property`, type, atLocation)
    }
    const propertyType = typeChecker.getTypeOfSymbolAtLocation(propertySymbol, atLocation)
    return invariantTypeArgument(propertyType)
  }

  const effectVarianceStruct = (
    type: ts.Type,
    atLocation: ts.Node
  ) =>
    Nano.map(
      Nano.all(
        varianceStructCovariantType(type, atLocation, "_A"),
        varianceStructCovariantType(type, atLocation, "_E"),
        varianceStructCovariantType(type, atLocation, "_R")
      ),
      ([A, E, R]) => ({ A, E, R })
    )

  const layerVarianceStruct = (
    type: ts.Type,
    atLocation: ts.Node
  ) =>
    Nano.map(
      Nano.all(
        varianceStructContravariantType(type, atLocation, "_ROut"),
        varianceStructCovariantType(type, atLocation, "_E"),
        varianceStructCovariantType(type, atLocation, "_RIn")
      ),
      ([ROut, E, RIn]) => ({ ROut, E, RIn })
    )

  const effectType = Nano.cachedBy(
    Nano.fn("TypeParser.effectType")(function*(
      type: ts.Type,
      atLocation: ts.Node
    ) {
      let result: Nano.Nano<
        {
          A: ts.Type
          E: ts.Type
          R: ts.Type
        },
        TypeParserIssue,
        never
      > = typeParserIssue("Type has no effect variance struct", type, atLocation)
      // get the properties to check (exclude non-property and optional properties)
      const propertiesSymbols = typeChecker.getPropertiesOfType(type).filter((_) =>
        _.flags & ts.SymbolFlags.Property && !(_.flags & ts.SymbolFlags.Optional) && _.valueDeclaration &&
        ts.isPropertySignature(_.valueDeclaration) && ts.isComputedPropertyName(_.valueDeclaration.name)
      )
      // try to put typeid first (heuristic to optimize hot path)
      propertiesSymbols.sort((a, b) => b.name.indexOf("EffectTypeId") - a.name.indexOf("EffectTypeId"))
      // has a property symbol which is an effect variance struct
      for (const propertySymbol of propertiesSymbols) {
        const propertyType = typeChecker.getTypeOfSymbolAtLocation(propertySymbol, atLocation)
        result = pipe(result, Nano.orElse(() => effectVarianceStruct(propertyType, atLocation)))
      }
      return yield* result
    }),
    "TypeParser.effectType",
    (type) => type
  )

  const strictEffectType = Nano.cachedBy(
    Nano.fn("TypeParser.strictEffectType")(function*(
      type: ts.Type,
      atLocation: ts.Node
    ) {
      // symbol name should be Effect
      if (!(type.symbol && type.symbol.name === "Effect" && !type.aliasSymbol)) {
        return yield* typeParserIssue("Type name should be Effect with no alias symbol", type, atLocation)
      }
      // should be an effect
      return yield* effectType(type, atLocation)
    }),
    "TypeParser.strictEffectType",
    (type) => type
  )

  const layerType = Nano.cachedBy(
    Nano.fn("TypeParser.layerType")(function*(
      type: ts.Type,
      atLocation: ts.Node
    ) {
      // should be pipeable
      yield* pipeableType(type, atLocation)

      // get the properties to check (exclude non-property and optional properties)
      const propertiesSymbols = typeChecker.getPropertiesOfType(type).filter((_) =>
        _.flags & ts.SymbolFlags.Property && !(_.flags & ts.SymbolFlags.Optional) && _.valueDeclaration &&
        ts.isPropertySignature(_.valueDeclaration) && ts.isComputedPropertyName(_.valueDeclaration.name)
      )
      // try to put typeid first (heuristic to optimize hot path)
      propertiesSymbols.sort((a, b) => b.name.indexOf("LayerTypeId") - a.name.indexOf("LayerTypeId"))
      // has a property symbol which is a layer variance struct
      for (const propertySymbol of propertiesSymbols) {
        const propertyType = typeChecker.getTypeOfSymbolAtLocation(propertySymbol, atLocation)
        const varianceArgs = yield* Nano.option(layerVarianceStruct(
          propertyType,
          atLocation
        ))
        if (Option.isSome(varianceArgs)) {
          return varianceArgs.value
        }
      }
      return yield* typeParserIssue("Type has no layer variance struct", type, atLocation)
    }),
    "TypeParser.layerType",
    (type) => type
  )

  const fiberType = Nano.cachedBy(
    Nano.fn("TypeParser.fiberType")(function*(
      type: ts.Type,
      atLocation: ts.Node
    ) {
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
    }),
    "TypeParser.fiberType",
    (type) => type
  )

  const effectSubtype = Nano.cachedBy(
    Nano.fn("TypeParser.effectSubtype")(function*(
      type: ts.Type,
      atLocation: ts.Node
    ) {
      // there is no better way to check if a type is a subtype of effect
      // so we just check for the existence of the property "_tag"
      // which is common for Option, Either, and others
      // and other datatypes as "Pool" have "get"
      const tagSymbol = typeChecker.getPropertyOfType(type, "_tag")
      const getSymbol = typeChecker.getPropertyOfType(type, "get")
      if (!(tagSymbol || getSymbol)) {
        return yield* typeParserIssue(
          "Type is not a subtype of effect because it does not have '_tag' or 'get' property",
          type,
          atLocation
        )
      }
      // and it is also an effect itself
      return yield* effectType(type, atLocation)
    }),
    "TypeParser.effectSubtype",
    (type) => type
  )

  const importedEffectModule = Nano.cachedBy(
    Nano.fn("TypeParser.importedEffectModule")(function*(
      node: ts.Node
    ) {
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
    }),
    "TypeParser.importedEffectModule",
    (node) => node
  )

  const effectGen = Nano.cachedBy(
    function(node: ts.Node) {
      // Effect.gen(...)
      if (!ts.isCallExpression(node)) {
        return typeParserIssue("Node is not a call expression", undefined, node)
      }
      // ...
      if (node.arguments.length === 0) {
        return typeParserIssue("Node has no arguments", undefined, node)
      }
      // firsta argument is a generator function expression
      const generatorFunction = node.arguments[0]
      if (!ts.isFunctionExpression(generatorFunction)) {
        return typeParserIssue("Node is not a function expression", undefined, node)
      }
      if (generatorFunction.asteriskToken === undefined) {
        return typeParserIssue("Node is not a generator function", undefined, node)
      }
      // Effect.gen
      if (!ts.isPropertyAccessExpression(node.expression)) {
        return typeParserIssue("Node is not a property access expression", undefined, node)
      }
      const propertyAccess = node.expression
      // gen
      if (propertyAccess.name.text !== "gen") {
        return typeParserIssue("Call expression name is not 'gen'", undefined, node)
      }
      // check Effect module
      return pipe(
        importedEffectModule(propertyAccess.expression),
        Nano.map((effectModule) => ({
          node,
          effectModule,
          generatorFunction,
          body: generatorFunction.body,
          functionStar: generatorFunction.getFirstToken()
        }))
      )
    },
    "TypeParser.effectGen",
    (node) => node
  )

  const effectFnUntracedGen = Nano.cachedBy(
    function(node: ts.Node) {
      // Effect.gen(...)
      if (!ts.isCallExpression(node)) {
        return typeParserIssue("Node is not a call expression", undefined, node)
      }
      // ...
      if (node.arguments.length === 0) {
        return typeParserIssue("Node has no arguments", undefined, node)
      }
      // firsta argument is a generator function expression
      const generatorFunction = node.arguments[0]
      if (!ts.isFunctionExpression(generatorFunction)) {
        return typeParserIssue("Node is not a function expression", undefined, node)
      }
      if (generatorFunction.asteriskToken === undefined) {
        return typeParserIssue(
          "Node is not a generator function",
          undefined,
          node
        )
      }
      // Effect.gen
      if (!ts.isPropertyAccessExpression(node.expression)) {
        return typeParserIssue(
          "Node is not a property access expression",
          undefined,
          node
        )
      }
      const propertyAccess = node.expression
      // gen
      if (propertyAccess.name.text !== "fnUntraced") {
        return typeParserIssue(
          "Call expression name is not 'fnUntraced'",
          undefined,
          node
        )
      }
      // check Effect module
      return pipe(
        importedEffectModule(propertyAccess.expression),
        Nano.map((effectModule) => ({
          node,
          effectModule,
          generatorFunction,
          body: generatorFunction.body,
          functionStar: generatorFunction.getFirstToken()
        }))
      )
    },
    "TypeParser.effectFnUntracedGen",
    (node) => node
  )

  const effectFnGen = Nano.cachedBy(
    function(node: ts.Node) {
      // Effect.fn(...)
      if (!ts.isCallExpression(node)) {
        return typeParserIssue("Node is not a call expression", undefined, node)
      }
      // ...
      if (node.arguments.length === 0) {
        return typeParserIssue("Node has no arguments", undefined, node)
      }
      // firsta argument is a generator function expression
      const generatorFunction = node.arguments[0]
      if (!ts.isFunctionExpression(generatorFunction)) {
        return typeParserIssue(
          "Node is not a function expression",
          undefined,
          node
        )
      }
      if (generatorFunction.asteriskToken === undefined) {
        return typeParserIssue(
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
        return typeParserIssue(
          "Node is not a property access expression",
          undefined,
          node
        )
      }
      const propertyAccess = expressionToTest
      // fn
      if (propertyAccess.name.text !== "fn") {
        return typeParserIssue(
          "Call expression name is not 'fn'",
          undefined,
          node
        )
      }
      // check Effect module
      return pipe(
        importedEffectModule(propertyAccess.expression),
        Nano.map((effectModule) => ({
          node,
          generatorFunction,
          effectModule,
          body: generatorFunction.body,
          functionStar: generatorFunction.getFirstToken()
        }))
      )
    },
    "TypeParser.effectFnGen",
    (node) => node
  )

  const unnecessaryEffectGen = Nano.cachedBy(
    Nano.fn("TypeParser.unnecessaryEffectGen")(function*(
      node: ts.Node
    ) {
      // ensure is an effect gen with a single statement
      const { body } = yield* effectGen(node)
      if (body.statements.length !== 1) {
        return yield* typeParserIssue(
          "Generator body should have a single statement",
          undefined,
          node
        )
      }

      let explicitReturn = false
      let nodeToCheck: ts.Node = body.statements[0]
      while (nodeToCheck) {
        // return XXX
        if (ts.isReturnStatement(nodeToCheck) && nodeToCheck.expression) {
          nodeToCheck = nodeToCheck.expression
          explicitReturn = true
          continue
        }
        // expression yield*
        if (ts.isExpressionStatement(nodeToCheck)) {
          nodeToCheck = nodeToCheck.expression
          continue
        }
        // yield* XXX
        if (ts.isYieldExpression(nodeToCheck) && nodeToCheck.asteriskToken && nodeToCheck.expression) {
          const yieldedExpression = nodeToCheck.expression
          const type = typeChecker.getTypeAtLocation(yieldedExpression)
          const { A: successType } = yield* effectType(type, yieldedExpression)
          let replacementNode: Nano.Nano<ts.Node> = Nano.succeed(yieldedExpression)
          if (!explicitReturn && !(successType.flags & ts.TypeFlags.VoidLike)) {
            replacementNode = pipe(
              Nano.gen(function*() {
                const effectIdentifier = pipe(
                  yield* Nano.option(
                    AST.findImportedModuleIdentifierByPackageAndNameOrBarrel(node.getSourceFile(), "effect", "Effect")
                  ),
                  Option.match({
                    onNone: () => "Effect",
                    onSome: (_) => _.text
                  })
                )

                return ts.factory.createCallExpression(
                  ts.factory.createPropertyAccessExpression(
                    ts.factory.createIdentifier(effectIdentifier),
                    "asVoid"
                  ),
                  undefined,
                  [
                    yieldedExpression
                  ]
                )
              }),
              Nano.provideService(TypeScriptApi.TypeScriptApi, ts)
            )
          }
          return { node, body, yieldedExpression, replacementNode }
        }
        // fall through
        break
      }

      // fall through case
      return yield* typeParserIssue(
        "Not an handled node",
        undefined,
        node
      )
    }),
    "TypeParser.unnecessaryEffectGen",
    (node) => node
  )

  const effectSchemaVarianceStruct = (
    type: ts.Type,
    atLocation: ts.Node
  ) =>
    Nano.map(
      Nano.all(
        varianceStructInvariantType(type, atLocation, "_A"),
        varianceStructInvariantType(type, atLocation, "_I"),
        varianceStructCovariantType(type, atLocation, "_R")
      ),
      ([A, I, R]) => ({ A, I, R })
    )

  const effectSchemaType = Nano.cachedBy(
    Nano.fn("TypeParser.effectSchemaType")(function*(
      type: ts.Type,
      atLocation: ts.Node
    ) {
      // should be pipeable
      yield* pipeableType(type, atLocation)
      // should have an 'ast' property
      const ast = typeChecker.getPropertyOfType(type, "ast")
      if (!ast) return yield* typeParserIssue("Has no 'ast' property", type, atLocation)
      // get the properties to check (exclude non-property and optional properties)
      const propertiesSymbols = typeChecker.getPropertiesOfType(type).filter((_) =>
        _.flags & ts.SymbolFlags.Property && !(_.flags & ts.SymbolFlags.Optional) && _.valueDeclaration &&
        ts.isPropertySignature(_.valueDeclaration) && ts.isComputedPropertyName(_.valueDeclaration.name)
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
    }),
    "TypeParser.effectSchemaType",
    (type) => type
  )

  const contextTagVarianceStruct = (
    type: ts.Type,
    atLocation: ts.Node
  ) =>
    Nano.map(
      Nano.all(
        varianceStructInvariantType(type, atLocation, "_Identifier"),
        varianceStructInvariantType(type, atLocation, "_Service")
      ),
      ([Identifier, Service]) => ({ Identifier, Service })
    )

  const contextTag = Nano.cachedBy(
    Nano.fn("TypeParser.contextTag")(function*(
      type: ts.Type,
      atLocation: ts.Node
    ) {
      // should be pipeable
      yield* pipeableType(type, atLocation)
      // get the properties to check (exclude non-property and optional properties)
      const propertiesSymbols = typeChecker.getPropertiesOfType(type).filter((_) =>
        _.flags & ts.SymbolFlags.Property && !(_.flags & ts.SymbolFlags.Optional) && _.valueDeclaration &&
        ts.isPropertySignature(_.valueDeclaration) && ts.isComputedPropertyName(_.valueDeclaration.name)
      )
      // try to put typeid first (heuristic to optimize hot path)
      propertiesSymbols.sort((a, b) => b.name.indexOf("TypeId") - a.name.indexOf("TypeId"))
      // has a property symbol which is an effect variance struct
      for (const propertySymbol of propertiesSymbols) {
        const propertyType = typeChecker.getTypeOfSymbolAtLocation(propertySymbol, atLocation)
        const varianceArgs = yield* Nano.option(contextTagVarianceStruct(
          propertyType,
          atLocation
        ))
        if (Option.isSome(varianceArgs)) {
          return varianceArgs.value
        }
      }
      return yield* typeParserIssue("Type has no tag variance struct", type, atLocation)
    }),
    "TypeParser.contextTag",
    (type) => type
  )

  const pipeCall = Nano.cachedBy(
    function(
      node: ts.Node
    ): Nano.Nano<
      { node: ts.CallExpression; subject: ts.Expression; args: Array<ts.Expression> },
      TypeParserIssue,
      never
    > {
      // expression.pipe(.....)
      if (
        ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.name) &&
        node.expression.name.text === "pipe"
      ) {
        return Nano.succeed({ node, subject: node.expression.expression, args: Array.from(node.arguments) })
      }

      // pipe(A, B, ...)
      if (
        ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "pipe" &&
        node.arguments.length > 0
      ) {
        const [subject, ...args] = node.arguments
        return Nano.succeed({ node, subject, args })
      }

      return typeParserIssue("Node is not a pipe call", undefined, node)
    },
    "TypeParser.pipeCall",
    (node) => node
  )

  const scopeType = Nano.cachedBy(
    Nano.fn("TypeParser.scopeType")(function*(
      type: ts.Type,
      atLocation: ts.Node
    ) {
      // should be pipeable
      yield* pipeableType(type, atLocation)
      // get the properties to check (exclude non-property and optional properties)
      const propertiesSymbols = typeChecker.getPropertiesOfType(type).filter((_) =>
        _.flags & ts.SymbolFlags.Property && !(_.flags & ts.SymbolFlags.Optional) && _.valueDeclaration &&
        ts.isPropertySignature(_.valueDeclaration) && ts.isComputedPropertyName(_.valueDeclaration.name)
      )
      // try to put typeid first (heuristic to optimize hot path)
      propertiesSymbols.sort((a, b) => b.name.indexOf("ScopeTypeId") - a.name.indexOf("ScopeTypeId"))
      // has a property scope type id
      for (const propertySymbol of propertiesSymbols) {
        const computedPropertyExpression: ts.ComputedPropertyName = (propertySymbol.valueDeclaration as any).name
        const symbol = typeChecker.getSymbolAtLocation(computedPropertyExpression.expression)
        if (symbol && symbol.name === "ScopeTypeId") {
          return type
        }
      }
      return yield* typeParserIssue("Type has no scope type id", type, atLocation)
    }),
    "TypeParser.scopeType",
    (type) => type
  )

  return {
    effectType,
    strictEffectType,
    layerType,
    fiberType,
    effectSubtype,
    importedEffectModule,
    effectGen,
    effectFnUntracedGen,
    effectFnGen,
    unnecessaryEffectGen,
    effectSchemaType,
    contextTag,
    pipeCall,
    scopeType
  }
}
