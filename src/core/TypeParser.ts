import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as Nano from "./Nano.js"
import * as TypeCheckerApi from "./TypeCheckerApi.js"
import * as TypeCheckerUtils from "./TypeCheckerUtils.js"
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
  isNodeReferenceToEffectModuleApi: (
    memberName: string
  ) => (node: ts.Node) => Nano.Nano<ts.SourceFile, TypeParserIssue, never>
  isNodeReferenceToEffectSchemaModuleApi: (
    memberName: string
  ) => (node: ts.Node) => Nano.Nano<ts.SourceFile, TypeParserIssue, never>
  effectGen: (
    node: ts.Node
  ) => Nano.Nano<
    {
      node: ts.Node
      effectModule: ts.Expression
      generatorFunction: ts.FunctionExpression
      body: ts.Block
    },
    TypeParserIssue
  >
  effectFnUntracedGen: (
    node: ts.Node
  ) => Nano.Nano<
    {
      node: ts.Node
      effectModule: ts.Node
      generatorFunction: ts.FunctionExpression
      body: ts.Block
    },
    TypeParserIssue
  >
  effectFnGen: (
    node: ts.Node
  ) => Nano.Nano<
    {
      node: ts.Node
      generatorFunction: ts.FunctionExpression
      effectModule: ts.Node
      body: ts.Block
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
  effectCauseYieldableErrorTypes: (fromSourceFile: ts.SourceFile) => Nano.Nano<Array<ts.Type>, TypeParserIssue, never>
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
      keyStringLiteral: ts.StringLiteral | undefined
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
      keyStringLiteral: ts.StringLiteral | undefined
    },
    TypeParserIssue,
    never
  >
  extendsEffectTag: (atLocation: ts.ClassDeclaration) => Nano.Nano<
    {
      className: ts.Identifier
      selfTypeNode: ts.TypeNode
      args: ts.NodeArray<ts.Expression>
      Identifier: ts.Type
      Service: ts.Type
      keyStringLiteral: ts.StringLiteral | undefined
    },
    TypeParserIssue,
    never
  >
  extendsSchemaClass: (atLocation: ts.ClassDeclaration) => Nano.Nano<
    {
      className: ts.Identifier
      selfTypeNode: ts.TypeNode
    },
    TypeParserIssue,
    never
  >
  extendsSchemaTaggedClass: (atLocation: ts.ClassDeclaration) => Nano.Nano<
    {
      className: ts.Identifier
      selfTypeNode: ts.TypeNode
      keyStringLiteral: ts.StringLiteral | undefined
      tagStringLiteral: ts.StringLiteral | undefined
    },
    TypeParserIssue,
    never
  >
  extendsSchemaTaggedError: (atLocation: ts.ClassDeclaration) => Nano.Nano<
    {
      className: ts.Identifier
      selfTypeNode: ts.TypeNode
      keyStringLiteral: ts.StringLiteral | undefined
      tagStringLiteral: ts.StringLiteral | undefined
    },
    TypeParserIssue,
    never
  >
  extendsSchemaTaggedRequest: (atLocation: ts.ClassDeclaration) => Nano.Nano<
    {
      className: ts.Identifier
      selfTypeNode: ts.TypeNode
      keyStringLiteral: ts.StringLiteral | undefined
      tagStringLiteral: ts.StringLiteral | undefined
    },
    TypeParserIssue,
    never
  >
  extendsDataTaggedError: (atLocation: ts.ClassDeclaration) => Nano.Nano<
    {
      className: ts.Identifier
      keyStringLiteral: ts.StringLiteral | undefined
      Data: ts.Node
    },
    TypeParserIssue,
    never
  >
  extendsDataTaggedClass: (atLocation: ts.ClassDeclaration) => Nano.Nano<
    {
      className: ts.Identifier
      keyStringLiteral: ts.StringLiteral | undefined
      Data: ts.Node
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
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)

    return yield* pipe(
      fa,
      Nano.provideService(TypeParser, make(ts, tsUtils, typeChecker, typeCheckerUtils, program))
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
  typeChecker: TypeCheckerApi.TypeCheckerApi,
  typeCheckerUtils: TypeCheckerUtils.TypeCheckerUtils,
  program: TypeScriptApi.TypeScriptProgram
): TypeParser {
  const getSourceFilePackageInfo = Nano.cachedBy(
    Nano.fn("TypeParser.getSourceFilePackageInfo")(function*(sourceFile: ts.SourceFile) {
      return tsUtils.resolveModuleWithPackageInfoFromSourceFile(program, sourceFile)
    }),
    `TypeParser.getSourceFilePackageInfo`,
    (sourceFile) => sourceFile
  )

  const getSourceFilesDeclaringSymbolModule = (
    packageName: string
  ) =>
    Nano.cachedBy(
      Nano.fn("TypeParser.getSourceFilesDeclaringSymbolModule")(function*(symbol: ts.Symbol) {
        const result: Array<ts.SourceFile> = []
        if (!symbol) return result
        if (!symbol.declarations) return yield* typeParserIssue("Symbol has no declarations", undefined, undefined)
        for (const sourceFile of symbol.declarations) {
          if (!ts.isSourceFile(sourceFile)) continue
          const packageInfo = yield* getSourceFilePackageInfo(sourceFile)
          if (!packageInfo || packageInfo.name.toLowerCase() !== packageName.toLowerCase()) continue
          result.push(sourceFile)
        }
        if (result.length > 0) {
          return result
        }
        return yield* typeParserIssue(`Symbol has no source file declarations`, undefined, undefined)
      }),
      `TypeParser.getSourceFilesDeclaringSymbolModule(${packageName})`,
      (symbol) => symbol
    )

  const isSymbolReferenceToPackageModule = <T, E, R>(
    givenSymbol: ts.Symbol,
    packageName: string,
    checkSourceFile: (sourceFile: ts.SourceFile) => Nano.Nano<T, E, R>
  ) => {
    let symbol = givenSymbol
    while (symbol.flags & ts.SymbolFlags.Alias) {
      symbol = typeChecker.getAliasedSymbol(symbol)
    }
    return pipe(
      getSourceFilesDeclaringSymbolModule(packageName)(symbol),
      Nano.flatMap((sourceFiles) =>
        Nano.firstSuccessOf(
          sourceFiles.map((_) => checkSourceFile(_))
        )
      )
    )
  }

  const isNodeReferenceToPackageModule = <T, E, R>(
    givenNode: ts.Node,
    packageName: string,
    isCorrectSourceFile: (
      sourceFile: ts.SourceFile
    ) => Nano.Nano<T, E, R>
  ) => {
    const symbol = typeChecker.getSymbolAtLocation(givenNode)
    if (!symbol) return typeParserIssue("Node has no symbol", undefined, givenNode)
    return isSymbolReferenceToPackageModule(symbol, packageName, isCorrectSourceFile)
  }

  const getSourceFilesDeclaringSymbolExportedUnderPackageModule = (
    packageName: string,
    memberName: string
  ) =>
    Nano.cachedBy(
      Nano.fn("TypeParser.getSourceFilesDeclaringSymbolUnderPackageExportedMember")(function*(symbol: ts.Symbol) {
        const result: Array<{ memberSymbol: ts.Symbol; moduleSymbol: ts.Symbol; sourceFile: ts.SourceFile }> = []
        if (!symbol) return result
        if (!symbol.declarations) return yield* typeParserIssue("Symbol has no declarations", undefined, undefined)
        for (const declaration of symbol.declarations) {
          const sourceFile = tsUtils.getSourceFileOfNode(declaration)
          if (!sourceFile) continue
          const packageInfo = yield* getSourceFilePackageInfo(sourceFile)
          if (!packageInfo || packageInfo.name.toLowerCase() !== packageName.toLowerCase()) continue
          const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile)
          if (!moduleSymbol) continue
          const memberSymbol = typeChecker.tryGetMemberInModuleExports(memberName, moduleSymbol)
          if (memberSymbol) {
            if (memberSymbol === symbol) {
              result.push({ memberSymbol, moduleSymbol, sourceFile })
            } else if (memberSymbol.flags & ts.SymbolFlags.Alias) {
              const aliased = typeChecker.getAliasedSymbol(memberSymbol)
              if (aliased === symbol) {
                result.push({ memberSymbol, moduleSymbol, sourceFile })
              }
            }
          }
        }
        if (result.length > 0) {
          return result
        }
        return yield* typeParserIssue(`Symbol has no declarations`, undefined, undefined)
      }),
      `TypeParser.getSourceFilesDeclaringSymbolUnderPackageExportedMember(${packageName}, ${memberName})`,
      (sym) => sym
    )

  const isSymbolExportOfPackageModule = <T, E, R>(
    givenSymbol: ts.Symbol,
    packageName: string,
    memberName: string,
    checkSourceFile: (sourceFile: ts.SourceFile, moduleSymbol: ts.Symbol, memberSymbol: ts.Symbol) => Nano.Nano<T, E, R>
  ) => {
    let symbol = givenSymbol
    while (symbol.flags & ts.SymbolFlags.Alias) {
      symbol = typeChecker.getAliasedSymbol(symbol)
    }
    return pipe(
      getSourceFilesDeclaringSymbolExportedUnderPackageModule(packageName, memberName)(symbol),
      Nano.flatMap((sourceFiles) =>
        Nano.firstSuccessOf(
          sourceFiles.map((_) => checkSourceFile(_.sourceFile, _.moduleSymbol, _.memberSymbol))
        )
      )
    )
  }

  const isNodeReferenceToExportOfPackageModule = <T, E, R>(
    givenNode: ts.Node,
    packageName: string,
    isCorrectSourceFile: (
      sourceFile: ts.SourceFile,
      moduleSymbol: ts.Symbol,
      memberSymbol: ts.Symbol
    ) => Nano.Nano<T, E, R>,
    memberName: string
  ) => {
    const symbol = typeChecker.getSymbolAtLocation(givenNode)
    if (!symbol) return typeParserIssue("Node has no symbol", undefined, givenNode)
    return isSymbolExportOfPackageModule(symbol, packageName, memberName, isCorrectSourceFile)
  }

  const findSymbolsMatchingPackageAndExportedName = (
    packageName: string,
    exportedSymbolName: string
  ) =>
    Nano.cachedBy(
      Nano.fn("TypeParser.findSymbolsMatchingPackageAndExportedName")(function*(_fromSourceFile: ts.SourceFile) {
        const result: Array<[symbol: ts.Symbol, sourceFile: ts.SourceFile]> = []
        for (const sourceFile of program.getSourceFiles()) {
          const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile)
          if (!moduleSymbol) continue
          const symbol = typeChecker.tryGetMemberInModuleExports(exportedSymbolName, moduleSymbol)
          if (!symbol) continue
          const packageInfo = yield* getSourceFilePackageInfo(sourceFile)
          if (!packageInfo || packageInfo.name.toLowerCase() !== packageName.toLowerCase()) continue
          result.push([symbol, sourceFile])
        }
        return result
      }),
      `TypeParser.findSymbolsMatchingPackageAndExportedName(${packageName}, ${exportedSymbolName})`,
      (sourceFile) => sourceFile
    )

  const isCauseTypeSourceFile = Nano.cachedBy(
    Nano.fn("TypeParser.isCauseTypeSourceFile")(function*(
      sourceFile: ts.SourceFile
    ) {
      const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile)
      if (!moduleSymbol) return yield* typeParserIssue("Node has no symbol", undefined, sourceFile)
      const causeTypeSymbol = typeChecker.tryGetMemberInModuleExports("Cause", moduleSymbol)
      if (!causeTypeSymbol) return yield* typeParserIssue("Cause type not found", undefined, sourceFile)
      const type = typeChecker.getDeclaredTypeOfSymbol(causeTypeSymbol)
      yield* pipeableType(type, sourceFile)
      return sourceFile
    }),
    "TypeParser.isCauseTypeSourceFile",
    (sourceFile) => sourceFile
  )

  const effectCauseYieldableErrorTypes = Nano.cachedBy(
    Nano.fn("TypeParser.effectCauseYieldableErrorTypes")(function*(
      fromSourceFile: ts.SourceFile
    ) {
      const symbols = yield* findSymbolsMatchingPackageAndExportedName("effect", "YieldableError")(fromSourceFile)
      const result: Array<ts.Type> = []
      for (const [symbol, sourceFile] of symbols) {
        const causeFile = yield* isCauseTypeSourceFile(sourceFile)
        if (!causeFile) continue
        const type = typeChecker.getDeclaredTypeOfSymbol(symbol)
        result.push(type)
      }
      return result
    }),
    "TypeParser.effectCauseYieldableErrorTypes",
    (fromSourceFile) => fromSourceFile
  )

  function covariantTypeArgument(type: ts.Type): Nano.Nano<ts.Type, TypeParserIssue> {
    const signatures = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call)
    // Covariant<A> has only 1 type signature
    if (signatures.length !== 1) {
      return typeParserIssue("Covariant type has no call signature", type)
    }
    // get the return type
    return Nano.succeed(typeChecker.getReturnTypeOfSignature(signatures[0]))
  }

  function contravariantTypeArgument(type: ts.Type): Nano.Nano<ts.Type, TypeParserIssue> {
    const signatures = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call)
    // Contravariant<A> has only 1 type signature
    if (signatures.length !== 1) {
      return typeParserIssue("Contravariant type has no call signature", type)
    }
    // get the return type
    return Nano.succeed(typeCheckerUtils.getTypeParameterAtPosition(signatures[0], 0))
  }

  function invariantTypeArgument(type: ts.Type): Nano.Nano<ts.Type, TypeParserIssue> {
    const signatures = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call)
    // Invariant<A> has only 1 type signature
    if (signatures.length !== 1) {
      return typeParserIssue("Invariant type has no call signature", type)
    }
    // get the return type
    return Nano.succeed(typeChecker.getReturnTypeOfSignature(signatures[0]))
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
      const signatures = typeChecker.getSignaturesOfType(pipeType, ts.SignatureKind.Call)
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
      propertiesSymbols.sort((a, b) =>
        ts.symbolName(b).indexOf("EffectTypeId") - ts.symbolName(a).indexOf("EffectTypeId")
      )
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
      if (!(type.symbol && ts.symbolName(type.symbol) === "Effect" && !type.aliasSymbol)) {
        return yield* typeParserIssue("Type name should be Effect with no alias symbol", type, atLocation)
      }
      // should be an effect
      return yield* effectType(type, atLocation)
    }),
    "TypeParser.strictEffectType",
    (type) => type
  )

  const isEffectTypeSourceFile = Nano.cachedBy(
    Nano.fn("TypeParser.isEffectTypeSourceFile")(function*(
      sourceFile: ts.SourceFile
    ) {
      const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile)
      if (!moduleSymbol) return yield* typeParserIssue("Node has no symbol", undefined, sourceFile)
      const effectTypeSymbol = typeChecker.tryGetMemberInModuleExports("Effect", moduleSymbol)
      if (!effectTypeSymbol) return yield* typeParserIssue("Effect type not found", undefined, sourceFile)
      const type = typeChecker.getDeclaredTypeOfSymbol(effectTypeSymbol)
      yield* effectType(type, sourceFile)
      return sourceFile
    }),
    "TypeParser.isEffectTypeSourceFile",
    (sourceFile) => sourceFile
  )

  const isNodeReferenceToEffectModuleApi = (memberName: string) =>
    Nano.cachedBy(
      Nano.fn("TypeParser.isNodeReferenceToEffectModuleApi")(function*(
        node: ts.Node
      ) {
        return yield* isNodeReferenceToExportOfPackageModule(node, "effect", isEffectTypeSourceFile, memberName)
      }),
      `TypeParser.isNodeReferenceToEffectModuleApi(${memberName})`,
      (node) => node
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
      propertiesSymbols.sort((a, b) =>
        ts.symbolName(b).indexOf("LayerTypeId") - ts.symbolName(a).indexOf("LayerTypeId")
      )
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

  const importedContextModule = Nano.cachedBy(
    Nano.fn("TypeParser.importedContextModule")(function*(
      node: ts.Node
    ) {
      // should be an expression
      if (!ts.isIdentifier(node)) {
        return yield* typeParserIssue("Node is not an identifier", undefined, node)
      }
      const type = typeChecker.getTypeAtLocation(node)
      // if the type has a property "Tag" that is a function
      const propertySymbol = typeChecker.getPropertyOfType(type, "Tag")
      if (!propertySymbol) {
        return yield* typeParserIssue("Type has no 'Tag' property", type, node)
      }
      const sourceFile = tsUtils.getSourceFileOfNode(node)
      if (!sourceFile) {
        return yield* typeParserIssue("Node is not in a source file", undefined, node)
      }
      const contextIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
        sourceFile,
        "effect",
        "Context"
      )
      if (!contextIdentifier) {
        return yield* typeParserIssue("Context module not found", undefined, node)
      }
      if (ts.idText(node) !== contextIdentifier) {
        return yield* typeParserIssue("Node is not a context module reference", undefined, node)
      }
      // return the node itself
      return node
    }),
    "TypeParser.importedContextModule",
    (node) => node
  )

  const importedEffectModule = (node: ts.Node) =>
    pipe(
      isNodeReferenceToPackageModule(node, "effect", isEffectTypeSourceFile),
      Nano.map(() => node)
    )

  const importedDataModule = Nano.cachedBy(
    Nano.fn("TypeParser.importedDataModule")(function*(
      node: ts.Node
    ) {
      // should be an expression
      if (!ts.isIdentifier(node)) {
        return yield* typeParserIssue("Node is not an expression", undefined, node)
      }
      const type = typeChecker.getTypeAtLocation(node)
      // if the type has a property "TaggedError" that is a function
      const propertySymbol = typeChecker.getPropertyOfType(type, "TaggedError")
      if (!propertySymbol) {
        return yield* typeParserIssue("Type has no 'TaggedError' property", type, node)
      }
      const sourceFile = tsUtils.getSourceFileOfNode(node)
      if (!sourceFile) {
        return yield* typeParserIssue("Node is not in a source file", undefined, node)
      }
      const dataIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
        sourceFile,
        "effect",
        "Data"
      )
      if (!dataIdentifier) {
        return yield* typeParserIssue("Data module not found", undefined, node)
      }
      if (ts.idText(node) !== dataIdentifier) {
        return yield* typeParserIssue("Node is not a data module reference", undefined, node)
      }
      // return the node itself
      return node
    }),
    "TypeParser.importedDataModule",
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
      return pipe(
        isNodeReferenceToEffectModuleApi("gen")(propertyAccess),
        Nano.map(() => ({
          node,
          effectModule: propertyAccess.expression,
          generatorFunction,
          body: generatorFunction.body
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
      return pipe(
        isNodeReferenceToEffectModuleApi("fnUntraced")(propertyAccess),
        Nano.map(() => ({
          node,
          effectModule: propertyAccess.expression,
          generatorFunction,
          body: generatorFunction.body
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
      return pipe(
        isNodeReferenceToEffectModuleApi("fn")(propertyAccess),
        Nano.map(() => ({
          node,
          generatorFunction,
          effectModule: propertyAccess.expression,
          body: generatorFunction.body
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
      propertiesSymbols.sort((a, b) => ts.symbolName(b).indexOf("TypeId") - ts.symbolName(a).indexOf("TypeId"))
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

  const isEffectSchemaTypeSourceFile = Nano.cachedBy(
    Nano.fn("TypeParser.isEffectSchemaTypeSourceFile")(function*(
      sourceFile: ts.SourceFile
    ) {
      const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile)
      if (!moduleSymbol) return yield* typeParserIssue("Node has no symbol", undefined, sourceFile)
      const typeSymbol = typeChecker.tryGetMemberInModuleExports("Schema", moduleSymbol)
      if (!typeSymbol) return yield* typeParserIssue("Schema type not found", undefined, sourceFile)
      const type = typeChecker.getDeclaredTypeOfSymbol(typeSymbol)
      yield* effectSchemaType(type, sourceFile)
      return sourceFile
    }),
    "TypeParser.isEffectSchemaTypeSourceFile",
    (sourceFile) => sourceFile
  )

  const isNodeReferenceToEffectSchemaModuleApi = (memberName: string) =>
    Nano.cachedBy(
      Nano.fn("TypeParser.isNodeReferenceToEffectSchemaModuleApi")(function*(
        node: ts.Node
      ) {
        return yield* isNodeReferenceToExportOfPackageModule(node, "effect", isEffectSchemaTypeSourceFile, memberName)
      }),
      `TypeParser.isNodeReferenceToEffectSchemaModuleApi(${memberName})`,
      (node) => node
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
      propertiesSymbols.sort((a, b) => ts.symbolName(b).indexOf("TypeId") - ts.symbolName(a).indexOf("TypeId"))
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
        ts.idText(node.expression.name) === "pipe"
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
        ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ts.idText(node.expression) === "pipe" &&
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
      propertiesSymbols.sort((a, b) =>
        ts.symbolName(b).indexOf("ScopeTypeId") - ts.symbolName(a).indexOf("ScopeTypeId")
      )
      // has a property scope type id
      for (const propertySymbol of propertiesSymbols) {
        const computedPropertyExpression: ts.ComputedPropertyName = (propertySymbol.valueDeclaration as any).name
        const symbol = typeChecker.getSymbolAtLocation(computedPropertyExpression.expression)
        if (symbol && ts.symbolName(symbol) === "ScopeTypeId") {
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
      for (const callSignature of typeChecker.getSignaturesOfType(thenType, ts.SignatureKind.Call)) {
        // take the callback argument of then
        const parameter = callSignature.parameters[0]
        if (!parameter) continue
        const parameterType = typeCheckerUtils.getTypeParameterAtPosition(callSignature, 0)
        if (!parameterType) continue
        // it can be an union with many types
        let callbackCallSignatures: Array<ts.Signature> = []
        let toTest = [parameterType]
        while (toTest.length > 0) {
          const type = toTest.shift()
          if (!type) continue
          const callSignatures = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call)
          callbackCallSignatures = callbackCallSignatures.concat(callSignatures)
          if (typeCheckerUtils.isUnion(type)) {
            toTest = toTest.concat(type.types)
          }
        }
        for (const callableType of callbackCallSignatures) {
          const callbackParameter = callableType.parameters[0]
          if (!callbackParameter) {
            continue
          }
          const callbackParameterType = typeCheckerUtils.getTypeParameterAtPosition(callableType, 0)
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
                const isEffectSchemaModuleApi = yield* pipe(
                  isNodeReferenceToEffectSchemaModuleApi("Class")(schemaCall.expression),
                  Nano.option
                )
                if (Option.isSome(isEffectSchemaModuleApi)) {
                  return {
                    className: atLocation.name,
                    selfTypeNode: schemaCall.typeArguments[0]!
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
            // Schema.TaggedClass<T>("name")("tag", {})
            const expression = typeX.expression
            if (ts.isCallExpression(expression) && expression.arguments.length > 0) {
              // Schema.TaggedClass<T>("name")
              const schemaTaggedClassTCall = expression.expression
              if (
                ts.isCallExpression(schemaTaggedClassTCall) && schemaTaggedClassTCall.typeArguments &&
                schemaTaggedClassTCall.typeArguments.length > 0
              ) {
                const selfTypeNode = schemaTaggedClassTCall.typeArguments[0]!
                const isEffectSchemaModuleApi = yield* pipe(
                  isNodeReferenceToEffectSchemaModuleApi("TaggedClass")(schemaTaggedClassTCall.expression),
                  Nano.option
                )
                if (Option.isSome(isEffectSchemaModuleApi)) {
                  return {
                    className: atLocation.name,
                    selfTypeNode,
                    keyStringLiteral: schemaTaggedClassTCall.arguments.length > 0 &&
                        ts.isStringLiteral(schemaTaggedClassTCall.arguments[0])
                      ? schemaTaggedClassTCall.arguments[0]
                      : undefined,
                    tagStringLiteral: expression.arguments.length > 0 &&
                        ts.isStringLiteral(expression.arguments[0])
                      ? expression.arguments[0]
                      : undefined
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
            // Schema.TaggedError<T>("name")("tag", {})
            const expression = typeX.expression
            if (ts.isCallExpression(expression)) {
              // Schema.TaggedError<T>("name")
              const schemaTaggedErrorTCall = expression.expression
              if (
                ts.isCallExpression(schemaTaggedErrorTCall) && schemaTaggedErrorTCall.typeArguments &&
                schemaTaggedErrorTCall.typeArguments.length > 0
              ) {
                const selfTypeNode = schemaTaggedErrorTCall.typeArguments[0]!
                const isEffectSchemaModuleApi = yield* pipe(
                  isNodeReferenceToEffectSchemaModuleApi("TaggedError")(schemaTaggedErrorTCall.expression),
                  Nano.option
                )
                if (Option.isSome(isEffectSchemaModuleApi)) {
                  return {
                    className: atLocation.name,
                    selfTypeNode,
                    keyStringLiteral: schemaTaggedErrorTCall.arguments.length > 0 &&
                        ts.isStringLiteral(schemaTaggedErrorTCall.arguments[0])
                      ? schemaTaggedErrorTCall.arguments[0]
                      : undefined,
                    tagStringLiteral: expression.arguments.length > 0 &&
                        ts.isStringLiteral(expression.arguments[0])
                      ? expression.arguments[0]
                      : undefined
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
            // Schema.TaggedRequest<T>("name")("tag", {})
            const expression = typeX.expression
            if (ts.isCallExpression(expression)) {
              // Schema.TaggedRequest<T>("name")
              const schemaTaggedRequestTCall = expression.expression
              if (
                ts.isCallExpression(schemaTaggedRequestTCall) &&
                schemaTaggedRequestTCall.typeArguments &&
                schemaTaggedRequestTCall.typeArguments.length > 0
              ) {
                const selfTypeNode = schemaTaggedRequestTCall.typeArguments[0]!
                const isEffectSchemaModuleApi = yield* pipe(
                  isNodeReferenceToEffectSchemaModuleApi("TaggedRequest")(schemaTaggedRequestTCall.expression),
                  Nano.option
                )
                if (Option.isSome(isEffectSchemaModuleApi)) {
                  return {
                    className: atLocation.name,
                    selfTypeNode,
                    tagStringLiteral: expression.arguments.length > 0 && ts.isStringLiteral(expression.arguments[0])
                      ? expression.arguments[0]
                      : undefined,
                    keyStringLiteral: schemaTaggedRequestTCall.arguments.length > 0 &&
                        ts.isStringLiteral(schemaTaggedRequestTCall.arguments[0])
                      ? schemaTaggedRequestTCall.arguments[0]
                      : undefined
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

  const extendsDataTaggedError = Nano.cachedBy(
    Nano.fn("TypeParser.extendsDataTaggedError")(function*(
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
            // Data.TaggedError("name")<{}>
            const expression = typeX.expression
            if (ts.isCallExpression(expression)) {
              // Data.TaggedError("name")
              const dataTaggedErrorCall = expression
              // Data.TaggedError
              const dataIdentifier = dataTaggedErrorCall.expression
              if (
                ts.isPropertyAccessExpression(dataIdentifier) && ts.isIdentifier(dataIdentifier.name) &&
                ts.idText(dataIdentifier.name) === "TaggedError"
              ) {
                const parsedDataModule = yield* pipe(
                  importedDataModule(dataIdentifier.expression),
                  Nano.option
                )
                if (Option.isSome(parsedDataModule)) {
                  // For Data.TaggedError, the structure is: Data.TaggedError("name")<{}>
                  // The string literal is in the single call expression
                  return {
                    className: atLocation.name,
                    keyStringLiteral: dataTaggedErrorCall.arguments.length > 0 &&
                        ts.isStringLiteral(dataTaggedErrorCall.arguments[0])
                      ? dataTaggedErrorCall.arguments[0]
                      : undefined,
                    Data: parsedDataModule.value
                  }
                }
              }
            }
          }
        }
      }
      return yield* typeParserIssue("Class does not extend Data.TaggedError", undefined, atLocation)
    }),
    "TypeParser.extendsDataTaggedError",
    (atLocation) => atLocation
  )

  const extendsDataTaggedClass = Nano.cachedBy(
    Nano.fn("TypeParser.extendsDataTaggedClass")(function*(
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
            // Data.TaggedClass("name")<{}>
            const expression = typeX.expression
            if (ts.isCallExpression(expression)) {
              // Data.TaggedClass("name")
              const dataTaggedClassCall = expression
              // Data.TaggedClass
              const dataIdentifier = dataTaggedClassCall.expression
              if (
                ts.isPropertyAccessExpression(dataIdentifier) && ts.isIdentifier(dataIdentifier.name) &&
                ts.idText(dataIdentifier.name) === "TaggedClass"
              ) {
                const parsedDataModule = yield* pipe(
                  importedDataModule(dataIdentifier.expression),
                  Nano.option
                )
                if (Option.isSome(parsedDataModule)) {
                  // For Data.TaggedClass, the structure is: Data.TaggedClass("name")<{}>
                  // The string literal is in the single call expression
                  return {
                    className: atLocation.name,
                    keyStringLiteral: dataTaggedClassCall.arguments.length > 0 &&
                        ts.isStringLiteral(dataTaggedClassCall.arguments[0])
                      ? dataTaggedClassCall.arguments[0]
                      : undefined,
                    Data: parsedDataModule.value
                  }
                }
              }
            }
          }
        }
      }
      return yield* typeParserIssue("Class does not extend Data.TaggedClass", undefined, atLocation)
    }),
    "TypeParser.extendsDataTaggedClass",
    (atLocation) => atLocation
  )

  const extendsContextTag = Nano.cachedBy(
    Nano.fn("TypeParser.extendsContextTag")(function*(
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
                  ts.isIdentifier(contextTagIdentifier.name) && ts.idText(contextTagIdentifier.name) === "Tag"
                ) {
                  const parsedContextModule = yield* pipe(
                    importedContextModule(contextTagIdentifier.expression),
                    Nano.option
                  )
                  if (Option.isSome(parsedContextModule)) {
                    const classSym = typeChecker.getSymbolAtLocation(atLocation.name)
                    if (!classSym) return yield* typeParserIssue("Class has no symbol", undefined, atLocation)
                    const type = typeChecker.getTypeOfSymbol(classSym)
                    const tagType = yield* contextTag(type, atLocation)
                    return {
                      className: atLocation.name,
                      selfTypeNode,
                      keyStringLiteral: ts.isStringLiteral(contextTagCall.arguments[0])
                        ? contextTagCall.arguments[0]
                        : undefined,
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

  const extendsEffectTag = Nano.cachedBy(
    Nano.fn("TypeParser.extendsEffectTag")(function*(
      atLocation: ts.ClassDeclaration
    ) {
      if (!atLocation.name) {
        return yield* typeParserIssue("Class has no name", undefined, atLocation)
      }
      const heritageClauses = atLocation.heritageClauses
      if (!heritageClauses) {
        return yield* typeParserIssue("Class has no heritage clauses", undefined, atLocation)
      }
      const classSym = typeChecker.getSymbolAtLocation(atLocation.name)
      if (!classSym) return yield* typeParserIssue("Class has no symbol", undefined, atLocation)
      const type = typeChecker.getTypeOfSymbol(classSym)
      const tagType = yield* contextTag(type, atLocation)
      for (const heritageClause of heritageClauses) {
        for (const typeX of heritageClause.types) {
          if (ts.isExpressionWithTypeArguments(typeX)) {
            const wholeCall = typeX.expression
            if (ts.isCallExpression(wholeCall)) {
              const effectTagCall = wholeCall.expression
              if (
                ts.isCallExpression(effectTagCall) &&
                wholeCall.typeArguments && wholeCall.typeArguments.length > 0
              ) {
                const effectTagIdentifier = effectTagCall.expression
                const selfTypeNode = wholeCall.typeArguments[0]!
                const isEffectTag = yield* pipe(
                  isNodeReferenceToEffectModuleApi("Tag")(effectTagIdentifier),
                  Nano.option
                )
                if (Option.isSome(isEffectTag)) {
                  return {
                    className: atLocation.name,
                    selfTypeNode,
                    keyStringLiteral: ts.isStringLiteral(effectTagCall.arguments[0])
                      ? effectTagCall.arguments[0]
                      : undefined,
                    args: effectTagCall.arguments,
                    Identifier: tagType.Identifier,
                    Service: tagType.Service
                  }
                }
              }
            }
          }
        }
      }
      return yield* typeParserIssue("Class does not extend Effect.Tag", undefined, atLocation)
    }),
    "TypeParser.extendsEffectTag",
    (atLocation) => atLocation
  )

  const extendsEffectService = Nano.cachedBy(
    Nano.fn("TypeParser.extendsEffectService")(function*(
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
            const wholeCall = typeX.expression
            if (ts.isCallExpression(wholeCall)) {
              const effectServiceCall = wholeCall.expression
              if (
                ts.isCallExpression(effectServiceCall) &&
                effectServiceCall.typeArguments && effectServiceCall.typeArguments.length > 0
              ) {
                const effectServiceIdentifier = effectServiceCall.expression
                const selfTypeNode = effectServiceCall.typeArguments[0]!
                const isEffectService = yield* pipe(
                  isNodeReferenceToEffectModuleApi("Service")(effectServiceIdentifier),
                  Nano.option
                )
                if (Option.isSome(isEffectService)) {
                  const classSym = typeChecker.getSymbolAtLocation(atLocation.name)
                  if (!classSym) return yield* typeParserIssue("Class has no symbol", undefined, atLocation)
                  const type = typeChecker.getTypeOfSymbol(classSym)
                  const parsedContextTag = yield* pipe(
                    contextTag(type, atLocation),
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
                            ts.idText(property.name) === "accessors" && property.initializer &&
                            property.initializer.kind === ts.SyntaxKind.TrueKeyword
                          ) {
                            accessors = true
                          }
                          if (
                            ts.isPropertyAssignment(property) && property.name && ts.isIdentifier(property.name) &&
                            ts.idText(property.name) === "dependencies" && property.initializer &&
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
                      keyStringLiteral: ts.isStringLiteral(wholeCall.arguments[0])
                        ? wholeCall.arguments[0]
                        : undefined,
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
    isNodeReferenceToEffectModuleApi,
    isNodeReferenceToEffectSchemaModuleApi,
    effectType,
    strictEffectType,
    layerType,
    fiberType,
    effectSubtype,
    importedEffectModule,
    effectGen,
    effectFnUntracedGen,
    effectFnGen,
    effectCauseYieldableErrorTypes,
    unnecessaryEffectGen,
    effectSchemaType,
    contextTag,
    pipeableType,
    pipeCall,
    scopeType,
    promiseLike,
    extendsEffectTag,
    extendsEffectService,
    extendsContextTag,
    extendsSchemaClass,
    extendsSchemaTaggedClass,
    extendsSchemaTaggedError,
    extendsDataTaggedError,
    extendsDataTaggedClass,
    extendsSchemaTaggedRequest
  }
}
