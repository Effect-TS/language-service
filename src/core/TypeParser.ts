import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as Nano from "./Nano.js"
import * as TypeCheckerApi from "./TypeCheckerApi.js"
import * as TypeScriptApi from "./TypeScriptApi.js"
import * as TypeScriptUtils from "./TypeScriptUtils.js"

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
  pipeableType: (type: ts.Type, atLocation: ts.Node) => Nano.Nano<ts.Type, TypeParserIssue, never>
  pipeCall: (
    node: ts.Node
  ) => Nano.Nano<
    { node: ts.CallExpression; subject: ts.Expression; args: Array<ts.Expression>; kind: "pipe" | "pipeable" },
    TypeParserIssue,
    never
  >
  scopeType: (
    type: ts.Type,
    atLocation: ts.Node
  ) => Nano.Nano<ts.Type, TypeParserIssue>
  promiseLike: (
    type: ts.Type,
    atLocation: ts.Node
  ) => Nano.Nano<{ type: ts.Type }, TypeParserIssue>
  extendsEffectService: (atLocation: ts.ClassDeclaration) => Nano.Nano<
    {
      className: ts.Identifier
      selfTypeNode: ts.TypeNode
      args: ts.NodeArray<ts.Expression>
      Identifier: ts.Type
      Service: ts.Type
      accessors: boolean | undefined
      dependencies: ts.NodeArray<ts.Expression> | undefined
      options: ts.Expression
    },
    TypeParserIssue,
    never
  >
  extendsContextTag: (atLocation: ts.ClassDeclaration) => Nano.Nano<
    {
      className: ts.Identifier
      selfTypeNode: ts.TypeNode
      args: ts.NodeArray<ts.Expression>
      Identifier: ts.Type
      Tag: ts.Node
    },
    TypeParserIssue,
    never
  >
  extendsSchemaClass: (atLocation: ts.ClassDeclaration) => Nano.Nano<
    {
      className: ts.Identifier
      selfTypeNode: ts.TypeNode
      Schema: ts.Node
    },
    TypeParserIssue,
    never
  >
  extendsSchemaTaggedClass: (atLocation: ts.ClassDeclaration) => Nano.Nano<
    {
      className: ts.Identifier
      selfTypeNode: ts.TypeNode
      Schema: ts.Node
    },
    TypeParserIssue,
    never
  >
  extendsSchemaTaggedError: (atLocation: ts.ClassDeclaration) => Nano.Nano<
    {
      className: ts.Identifier
      selfTypeNode: ts.TypeNode
      Schema: ts.Node
    },
    TypeParserIssue,
    never
  >
  extendsSchemaTaggedRequest: (atLocation: ts.ClassDeclaration) => Nano.Nano<
    {
      className: ts.Identifier
      selfTypeNode: ts.TypeNode
      Schema: ts.Node
    },
    TypeParserIssue,
    never
  >
}
export const TypeParser = Nano.Tag<TypeParser>("@effect/language-service/TypeParser")

export const nanoLayer = <A, E, R>(
  fa: Nano.Nano<A, E, R>
) =>
  Nano.gen(function*() {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    return yield* pipe(
      fa,
      Nano.provideService(TypeParser, make(ts, tsUtils, typeChecker))
    )
  })

export class TypeParserIssue {
  readonly _tag = "@effect/language-service/TypeParserIssue"
  static issue = Nano.fail(new TypeParserIssue())
}

export function typeParserIssue(
  _message: string,
  _type?: ts.Type | undefined,
  _node?: ts.Node | undefined
): Nano.Nano<never, TypeParserIssue, never> {
  return TypeParserIssue.issue
}

export function make(
  ts: TypeScriptApi.TypeScriptApi,
  tsUtils: TypeScriptUtils.TypeScriptUtils,
  typeChecker: TypeCheckerApi.TypeCheckerApi
): TypeParser {
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

  const importedSchemaModule = Nano.cachedBy(
    Nano.fn("TypeParser.importedSchemaModule")(function*(
      node: ts.Node
    ) {
      const type = typeChecker.getTypeAtLocation(node)
      // if the type has a property "Class" that is a function
      const propertySymbol = typeChecker.getPropertyOfType(type, "Class")
      if (!propertySymbol) {
        return yield* typeParserIssue("Type has no 'Class' property", type, node)
      }
      // should be an expression
      if (!ts.isExpression(node)) {
        return yield* typeParserIssue("Node is not an expression", type, node)
      }
      // return the node itself
      return node
    }),
    "TypeParser.importedSchemaModule",
    (node) => node
  )

  const importedContextModule = Nano.cachedBy(
    Nano.fn("TypeParser.importedContextModule")(function*(
      node: ts.Node
    ) {
      const type = typeChecker.getTypeAtLocation(node)
      // if the type has a property "Tag" that is a function
      const propertySymbol = typeChecker.getPropertyOfType(type, "Tag")
      if (!propertySymbol) {
        return yield* typeParserIssue("Type has no 'Tag' property", type, node)
      }
      // should be an expression
      if (!ts.isExpression(node)) {
        return yield* typeParserIssue("Node is not an expression", type, node)
      }
      // return the node itself
      return node
    }),
    "TypeParser.importedContextModule",
    (node) => node
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
                const effectIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
                  node.getSourceFile(),
                  "effect",
                  "Effect"
                ) || "Effect"

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
      { node: ts.CallExpression; subject: ts.Expression; args: Array<ts.Expression>; kind: "pipe" | "pipeable" },
      TypeParserIssue,
      never
    > {
      // expression.pipe(.....)
      if (
        ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.name) &&
        node.expression.name.text === "pipe"
      ) {
        return Nano.succeed({
          node,
          subject: node.expression.expression,
          args: Array.from(node.arguments),
          kind: "pipeable"
        })
      }

      // pipe(A, B, ...)
      if (
        ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "pipe" &&
        node.arguments.length > 0
      ) {
        const [subject, ...args] = node.arguments
        return Nano.succeed({ node, subject, args, kind: "pipe" })
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

  const promiseLike = Nano.cachedBy(
    function(
      type: ts.Type,
      atLocation: ts.Node
    ) {
      // maybe it is a Promise<A>?
      const thenProperty = type.getProperty("then")
      if (!thenProperty) return typeParserIssue("not a promise - missing then property", type, atLocation)
      const thenType = typeChecker.getTypeOfSymbolAtLocation(thenProperty, atLocation)
      if (!thenType) return typeParserIssue("not a promise - missing then property", type, atLocation)
      // .then should be callable
      for (const callSignature of thenType.getCallSignatures()) {
        // take the callback argument of then
        const parameter = callSignature.parameters[0]
        if (!parameter) continue
        const parameterType = callSignature.getTypeParameterAtPosition(0)
        if (!parameterType) continue
        // it can be an union with many types
        let callbackCallSignatures: Array<ts.Signature> = []
        let toTest = [parameterType]
        while (toTest.length > 0) {
          const type = toTest.shift()
          if (!type) continue
          const callSignatures = type.getCallSignatures()
          callbackCallSignatures = callbackCallSignatures.concat(callSignatures)
          if (type.isUnion()) {
            toTest = toTest.concat(type.types)
          }
        }
        for (const callableType of callbackCallSignatures) {
          const callbackParameter = callableType.parameters[0]
          if (!callbackParameter) {
            continue
          }
          const callbackParameterType = callableType.getTypeParameterAtPosition(0)
          if (!callbackParameterType) {
            continue
          }
          return Nano.succeed({
            type: callbackParameterType
          })
        }
      }
      return typeParserIssue("not a promise", type, atLocation)
    },
    "TypeParser.promiseLike",
    (type) => type
  )

  const extendsSchemaClass = Nano.cachedBy(
    Nano.fn("TypeParser.extendsSchemaClass")(function*(
      atLocation: ts.ClassDeclaration
    ) {
      if (!atLocation.name) {
        return yield* typeParserIssue("Class has no name", undefined, atLocation)
      }
      const heritageClauses = atLocation.heritageClauses
      if (!heritageClauses) {
        return yield* typeParserIssue("Class has no heritage clauses", undefined, atLocation)
      }
      for (const heritageClause of heritageClauses) {
        for (const typeX of heritageClause.types) {
          if (ts.isExpressionWithTypeArguments(typeX)) {
            const expression = typeX.expression
            if (ts.isCallExpression(expression)) {
              // Schema.Class<T>("name")({})
              const schemaCall = expression.expression
              if (ts.isCallExpression(schemaCall) && schemaCall.typeArguments && schemaCall.typeArguments.length > 0) {
                const selfTypeNode = schemaCall.typeArguments[0]!
                const schemaIdentifier = schemaCall.expression
                if (
                  ts.isPropertyAccessExpression(schemaIdentifier) && ts.isIdentifier(schemaIdentifier.name) &&
                  schemaIdentifier.name.text === "Class"
                ) {
                  const parsedSchemaModule = yield* pipe(
                    importedSchemaModule(schemaIdentifier.expression),
                    Nano.option
                  )
                  if (Option.isSome(parsedSchemaModule)) {
                    return {
                      className: atLocation.name,
                      selfTypeNode,
                      Schema: parsedSchemaModule.value
                    }
                  }
                }
              }
            }
          }
        }
      }
      return yield* typeParserIssue("Class does not extend Schema.Class", undefined, atLocation)
    }),
    "TypeParser.extendsSchemaClass",
    (atLocation) => atLocation
  )

  const extendsSchemaTaggedClass = Nano.cachedBy(
    Nano.fn("TypeParser.extendsSchemaTaggedClass")(function*(
      atLocation: ts.ClassDeclaration
    ) {
      if (!atLocation.name) {
        return yield* typeParserIssue("Class has no name", undefined, atLocation)
      }
      const heritageClauses = atLocation.heritageClauses
      if (!heritageClauses) {
        return yield* typeParserIssue("Class has no heritage clauses", undefined, atLocation)
      }
      for (const heritageClause of heritageClauses) {
        for (const typeX of heritageClause.types) {
          if (ts.isExpressionWithTypeArguments(typeX)) {
            const expression = typeX.expression
            if (ts.isCallExpression(expression)) {
              // Schema.TaggedClass<T>("name")("tag", {})
              const tagCall = expression.expression
              if (ts.isCallExpression(tagCall)) {
                const schemaCall = tagCall.expression
                if (
                  ts.isCallExpression(schemaCall) && schemaCall.typeArguments && schemaCall.typeArguments.length > 0
                ) {
                  const selfTypeNode = schemaCall.typeArguments[0]!
                  const schemaIdentifier = schemaCall.expression
                  if (
                    ts.isPropertyAccessExpression(schemaIdentifier) && ts.isIdentifier(schemaIdentifier.name) &&
                    schemaIdentifier.name.text === "TaggedClass"
                  ) {
                    const parsedSchemaModule = yield* pipe(
                      importedSchemaModule(schemaIdentifier.expression),
                      Nano.option
                    )
                    if (Option.isSome(parsedSchemaModule)) {
                      return {
                        className: atLocation.name,
                        selfTypeNode,
                        Schema: parsedSchemaModule.value
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      return yield* typeParserIssue("Class does not extend Schema.TaggedClass", undefined, atLocation)
    }),
    "TypeParser.extendsSchemaTaggedClass",
    (atLocation) => atLocation
  )

  const extendsSchemaTaggedError = Nano.cachedBy(
    Nano.fn("TypeParser.extendsSchemaTaggedError")(function*(
      atLocation: ts.ClassDeclaration
    ) {
      if (!atLocation.name) {
        return yield* typeParserIssue("Class has no name", undefined, atLocation)
      }
      const heritageClauses = atLocation.heritageClauses
      if (!heritageClauses) {
        return yield* typeParserIssue("Class has no heritage clauses", undefined, atLocation)
      }
      for (const heritageClause of heritageClauses) {
        for (const typeX of heritageClause.types) {
          if (ts.isExpressionWithTypeArguments(typeX)) {
            const expression = typeX.expression
            if (ts.isCallExpression(expression)) {
              // Schema.TaggedError<T>("name")("tag", {})
              const tagCall = expression.expression
              if (ts.isCallExpression(tagCall)) {
                const schemaCall = tagCall.expression
                if (
                  ts.isCallExpression(schemaCall) && schemaCall.typeArguments && schemaCall.typeArguments.length > 0
                ) {
                  const selfTypeNode = schemaCall.typeArguments[0]!
                  const schemaIdentifier = schemaCall.expression
                  if (
                    ts.isPropertyAccessExpression(schemaIdentifier) && ts.isIdentifier(schemaIdentifier.name) &&
                    schemaIdentifier.name.text === "TaggedError"
                  ) {
                    const parsedSchemaModule = yield* pipe(
                      importedSchemaModule(schemaIdentifier.expression),
                      Nano.option
                    )
                    if (Option.isSome(parsedSchemaModule)) {
                      return {
                        className: atLocation.name,
                        selfTypeNode,
                        Schema: parsedSchemaModule.value
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      return yield* typeParserIssue("Class does not extend Schema.TaggedError", undefined, atLocation)
    }),
    "TypeParser.extendsSchemaTaggedError",
    (atLocation) => atLocation
  )

  const extendsSchemaTaggedRequest = Nano.cachedBy(
    Nano.fn("TypeParser.extendsSchemaTaggedRequest")(function*(
      atLocation: ts.ClassDeclaration
    ) {
      if (!atLocation.name) {
        return yield* typeParserIssue("Class has no name", undefined, atLocation)
      }
      const heritageClauses = atLocation.heritageClauses
      if (!heritageClauses) {
        return yield* typeParserIssue("Class has no heritage clauses", undefined, atLocation)
      }
      for (const heritageClause of heritageClauses) {
        for (const typeX of heritageClause.types) {
          if (ts.isExpressionWithTypeArguments(typeX)) {
            const expression = typeX.expression
            if (ts.isCallExpression(expression)) {
              // Schema.TaggedRequest<T>("name")("tag", {})
              const tagCall = expression.expression
              if (ts.isCallExpression(tagCall)) {
                const schemaCall = tagCall.expression
                if (
                  ts.isCallExpression(schemaCall) && schemaCall.typeArguments && schemaCall.typeArguments.length > 0
                ) {
                  const selfTypeNode = schemaCall.typeArguments[0]!
                  const schemaIdentifier = schemaCall.expression
                  if (
                    ts.isPropertyAccessExpression(schemaIdentifier) && ts.isIdentifier(schemaIdentifier.name) &&
                    schemaIdentifier.name.text === "TaggedRequest"
                  ) {
                    const parsedSchemaModule = yield* pipe(
                      importedSchemaModule(schemaIdentifier.expression),
                      Nano.option
                    )
                    if (Option.isSome(parsedSchemaModule)) {
                      return {
                        className: atLocation.name,
                        selfTypeNode,
                        Schema: parsedSchemaModule.value
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      return yield* typeParserIssue("Class does not extend Schema.TaggedRequest", undefined, atLocation)
    }),
    "TypeParser.extendsSchemaTaggedRequest",
    (atLocation) => atLocation
  )

  const extendsContextTag = Nano.cachedBy(
    Nano.fn("TypeParser.extendsContextTag")(function*(
      atLocation: ts.ClassDeclaration
    ) {
      if (!atLocation.name) {
        return yield* typeParserIssue("Class has no name", undefined, atLocation)
      }
      const classSym = typeChecker.getSymbolAtLocation(atLocation.name)
      if (!classSym) return yield* typeParserIssue("Class has no symbol", undefined, atLocation)
      const type = typeChecker.getTypeOfSymbol(classSym)
      const heritageClauses = atLocation.heritageClauses
      if (!heritageClauses) {
        return yield* typeParserIssue("Class has no heritage clauses", undefined, atLocation)
      }
      for (const heritageClause of heritageClauses) {
        for (const typeX of heritageClause.types) {
          if (ts.isExpressionWithTypeArguments(typeX)) {
            const wholeCall = typeX.expression
            if (ts.isCallExpression(wholeCall)) {
              const contextTagCall = wholeCall.expression
              if (
                ts.isCallExpression(contextTagCall) &&
                wholeCall.typeArguments && wholeCall.typeArguments.length > 0
              ) {
                const contextTagIdentifier = contextTagCall.expression
                const selfTypeNode = wholeCall.typeArguments[0]!
                if (
                  ts.isPropertyAccessExpression(contextTagIdentifier) &&
                  ts.isIdentifier(contextTagIdentifier.name) && contextTagIdentifier.name.text === "Tag"
                ) {
                  const parsedContextModule = yield* pipe(
                    importedContextModule(contextTagIdentifier.expression),
                    Nano.option
                  )
                  if (Option.isSome(parsedContextModule)) {
                    const tagType = yield* contextTag(type, atLocation)
                    return {
                      className: atLocation.name,
                      selfTypeNode,
                      args: contextTagCall.arguments,
                      Identifier: tagType.Identifier,
                      Tag: parsedContextModule.value
                    }
                  }
                }
              }
            }
          }
        }
      }
      return yield* typeParserIssue("Class does not extend Context.Tag", undefined, atLocation)
    }),
    "TypeParser.extendsContextTag",
    (atLocation) => atLocation
  )

  const extendsEffectService = Nano.cachedBy(
    Nano.fn("TypeParser.extendsEffectService")(function*(
      atLocation: ts.ClassDeclaration
    ) {
      if (!atLocation.name) {
        return yield* typeParserIssue("Class has no name", undefined, atLocation)
      }
      const classSym = typeChecker.getSymbolAtLocation(atLocation.name)
      if (!classSym) return yield* typeParserIssue("Class has no symbol", undefined, atLocation)
      const type = typeChecker.getTypeOfSymbol(classSym)
      const heritageClauses = atLocation.heritageClauses
      if (!heritageClauses) {
        return yield* typeParserIssue("Class has no heritage clauses", undefined, atLocation)
      }
      for (const heritageClause of heritageClauses) {
        for (const typeX of heritageClause.types) {
          if (ts.isExpressionWithTypeArguments(typeX)) {
            const wholeCall = typeX.expression
            if (ts.isCallExpression(wholeCall)) {
              const effectServiceCall = wholeCall.expression
              if (
                ts.isCallExpression(effectServiceCall) &&
                effectServiceCall.typeArguments && effectServiceCall.typeArguments.length > 0
              ) {
                const effectServiceIdentifier = effectServiceCall.expression
                const selfTypeNode = effectServiceCall.typeArguments[0]!
                if (
                  ts.isPropertyAccessExpression(effectServiceIdentifier) &&
                  ts.isIdentifier(effectServiceIdentifier.name) && effectServiceIdentifier.name.text === "Service"
                ) {
                  const parsedContextTag = yield* pipe(
                    importedEffectModule(effectServiceIdentifier.expression),
                    Nano.flatMap(() => contextTag(type, atLocation)),
                    Nano.option
                  )
                  if (Option.isSome(parsedContextTag)) {
                    // try to parse some settings
                    let accessors: boolean | undefined = undefined
                    let dependencies: ts.NodeArray<ts.Expression> | undefined = undefined
                    if (wholeCall.arguments.length >= 2) {
                      const args = wholeCall.arguments[1]
                      if (ts.isObjectLiteralExpression(args)) {
                        for (const property of args.properties) {
                          if (
                            ts.isPropertyAssignment(property) && property.name && ts.isIdentifier(property.name) &&
                            property.name.text === "accessors" && property.initializer &&
                            property.initializer.kind === ts.SyntaxKind.TrueKeyword
                          ) {
                            accessors = true
                          }
                          if (
                            ts.isPropertyAssignment(property) && property.name && ts.isIdentifier(property.name) &&
                            property.name.text === "dependencies" && property.initializer &&
                            ts.isArrayLiteralExpression(property.initializer)
                          ) {
                            dependencies = property.initializer.elements
                          }
                        }
                      }
                    }
                    return ({
                      ...parsedContextTag.value,
                      className: atLocation.name,
                      selfTypeNode,
                      args: wholeCall.arguments,
                      options: wholeCall.arguments[1],
                      accessors,
                      dependencies
                    })
                  }
                }
              }
            }
          }
        }
      }

      return yield* typeParserIssue("Class does not extend Effect.Service", undefined, atLocation)
    }),
    "TypeParser.extendsEffectService",
    (atLocation) => atLocation
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
    pipeableType,
    pipeCall,
    scopeType,
    promiseLike,
    extendsEffectService,
    extendsContextTag,
    extendsSchemaClass,
    extendsSchemaTaggedClass,
    extendsSchemaTaggedError,
    extendsSchemaTaggedRequest
  }
}
