import { pipe } from "effect/Function"
import * as Predicate from "effect/Predicate"
import type ts from "typescript"
import * as Nano from "./Nano.js"
import * as TypeCheckerApi from "./TypeCheckerApi.js"
import * as TypeCheckerUtils from "./TypeCheckerUtils.js"
import * as TypeScriptApi from "./TypeScriptApi.js"
import * as TypeScriptUtils from "./TypeScriptUtils.js"

export type ResolvedPackagesCache = Record<string, Record<string, any>>
const checkedPackagesCache = new Map<string, ResolvedPackagesCache>()
const programResolvedCacheSize = new Map<string, number>()

export interface ParsedPipeCall {
  node: ts.CallExpression
  subject: ts.Expression
  args: Array<ts.Expression>
  kind: "pipe" | "pipeable"
}

export interface ParsedSingleArgCall {
  node: ts.CallExpression
  callee: ts.Expression
  subject: ts.Expression
}

export interface ParsedLazyExpression {
  node: ts.ArrowFunction | ts.FunctionExpression
  body: ts.Expression | ts.Block
  expression: ts.Expression
  returnType: ts.TypeNode | undefined
}

export interface ParsedEmptyFunction {
  node: ts.ArrowFunction | ts.FunctionExpression
  body: ts.Block
  returnType: ts.TypeNode | undefined
}

export interface ParsedPipingFlow {
  node: ts.Expression // the whole piping flow expression
  subject: ParsedPipingFlowSubject // the starting expression (before any transformations)
  transformations: Array<ParsedPipingFlowTransformation>
}

export interface ParsedPipingFlowSubject {
  node: ts.Expression
  outType: ts.Type | undefined
}

export interface ParsedPipingFlowTransformation {
  callee: ts.Expression
  args: Array<ts.Expression> | undefined // undefined if callee is a constant (e.g., Effect.asVoid)
  outType: ts.Type | undefined // the type of the expression after the transformation
  kind: "pipe" | "pipeable" | "call" | "effectFn" | "effectFnUntraced" // the kind of transformation
}

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
  isNodeReferenceToEffectParseResultModuleApi: (
    memberName: string
  ) => (node: ts.Node) => Nano.Nano<ts.SourceFile, TypeParserIssue, never>
  isNodeReferenceToEffectDataModuleApi: (
    memberName: string
  ) => (node: ts.Node) => Nano.Nano<ts.SourceFile, TypeParserIssue, never>
  isNodeReferenceToEffectContextModuleApi: (
    memberName: string
  ) => (node: ts.Node) => Nano.Nano<ts.SourceFile, TypeParserIssue, never>
  isNodeReferenceToEffectSqlModelModuleApi: (
    memberName: string
  ) => (node: ts.Node) => Nano.Nano<ts.SourceFile, TypeParserIssue, never>
  isNodeReferenceToEffectLayerModuleApi: (
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
      pipeArguments: ReadonlyArray<ts.Expression>
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
      pipeArguments: ReadonlyArray<ts.Expression>
      traceExpression: ts.Expression | undefined
    },
    TypeParserIssue
  >
  findEnclosingScopes: (
    node: ts.Node
  ) => Nano.Nano<
    {
      scopeNode: ts.FunctionLikeDeclaration | undefined
      effectGen: {
        node: ts.Node
        effectModule: ts.Node | ts.Expression
        generatorFunction: ts.FunctionExpression
        body: ts.Block
        pipeArguments?: ReadonlyArray<ts.Expression>
      } | undefined
    },
    never
  >
  effectFn: (
    node: ts.Node
  ) => Nano.Nano<
    {
      node: ts.Node
      effectModule: ts.Node
      regularFunction: ts.FunctionExpression | ts.ArrowFunction
      pipeArguments: ReadonlyArray<ts.Expression>
      traceExpression: ts.Expression | undefined
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
  extendsCauseYieldableError: (type: ts.Type) => Nano.Nano<ts.Type, TypeParserIssue, never>
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
  singleArgCall: (
    node: ts.Node
  ) => Nano.Nano<
    ParsedSingleArgCall,
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
  extendsSchemaRequestClass: (atLocation: ts.ClassDeclaration) => Nano.Nano<
    {
      className: ts.Identifier
      selfTypeNode: ts.TypeNode
      keyStringLiteral: ts.StringLiteral | undefined
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
  extendsEffectSqlModelClass: (atLocation: ts.ClassDeclaration) => Nano.Nano<
    {
      className: ts.Identifier
      selfTypeNode: ts.TypeNode
    },
    TypeParserIssue,
    never
  >
  lazyExpression: (node: ts.Node) => Nano.Nano<
    ParsedLazyExpression,
    TypeParserIssue,
    never
  >
  emptyFunction: (node: ts.Node) => Nano.Nano<
    ParsedEmptyFunction,
    TypeParserIssue,
    never
  >
  pipingFlows: (
    includeEffectFn: boolean
  ) => (sourceFile: ts.SourceFile) => Nano.Nano<Array<ParsedPipingFlow>, never, never>
  reconstructPipingFlow: (flow: Pick<ParsedPipingFlow, "subject" | "transformations">) => ts.Expression
  getEffectRelatedPackages: (sourceFile: ts.SourceFile) => ResolvedPackagesCache
  supportedEffect: () => "v3" | "v4"
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
  function supportedEffect(): "v3" | "v4" {
    for (const fileName of program.getRootFileNames()) {
      const sourceFile = program.getSourceFile(fileName)
      if (!sourceFile) continue
      const resolvedPackages = getEffectRelatedPackages(sourceFile)
      const effectPkgs = resolvedPackages["effect"]
      if (!effectPkgs) continue
      for (const version of Object.keys(effectPkgs)) {
        if (String(version).startsWith("4")) return "v4"
        if (String(version).startsWith("3")) return "v3"
      }
    }
    return "v3"
  }

  function getEffectRelatedPackages(sourceFile: ts.SourceFile) {
    // whenever we detect the resolution cache size has changed, try again the check
    // this should mitigate how frequently this rule is triggered
    let resolvedPackages: ResolvedPackagesCache = checkedPackagesCache.get(sourceFile.fileName) ||
      {}
    const newResolvedModuleSize =
      Predicate.hasProperty(program, "resolvedModules") && Predicate.hasProperty(program.resolvedModules, "size") &&
        Predicate.isNumber(program.resolvedModules.size) ?
        program.resolvedModules.size :
        0
    const oldResolvedSize = programResolvedCacheSize.get(sourceFile.fileName) || -1
    if (newResolvedModuleSize !== oldResolvedSize) {
      const seenPackages = new Set<string>()
      resolvedPackages = {}
      program.getSourceFiles().map((_) => {
        const packageInfo = tsUtils.parsePackageContentNameAndVersionFromScope(_)
        if (!packageInfo) return
        const packageNameAndVersion = packageInfo.name + "@" + packageInfo.version
        if (seenPackages.has(packageNameAndVersion)) return
        seenPackages.add(packageNameAndVersion)
        if (
          !(packageInfo.name === "effect" || packageInfo.hasEffectInPeerDependencies)
        ) return
        resolvedPackages[packageInfo.name] = resolvedPackages[packageInfo.name] || {}
        resolvedPackages[packageInfo.name][packageInfo.version] = packageInfo.packageDirectory
      })
      checkedPackagesCache.set(sourceFile.fileName, resolvedPackages)
      programResolvedCacheSize.set(sourceFile.fileName, newResolvedModuleSize)
    }
    return resolvedPackages
  }

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
      Nano.fn("TypeParser.findSymbolsMatchingPackageAndExportedName")(function*() {
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
      () => program
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

  const extendsCauseYieldableError = Nano.cachedBy(
    Nano.fn("TypeParser.extendsCauseYieldableError")(function*(
      givenType: ts.Type
    ) {
      // never is assignable to everything, so we need to exclude it
      if (givenType.flags & ts.TypeFlags.Never) {
        return yield* typeParserIssue("Type is never", givenType)
      }
      if (givenType.flags & ts.TypeFlags.Any) {
        return yield* typeParserIssue("Type is any", givenType)
      }
      const symbols = yield* findSymbolsMatchingPackageAndExportedName("effect", "YieldableError")()
      for (const [symbol, sourceFile] of symbols) {
        const causeFile = yield* pipe(isCauseTypeSourceFile(sourceFile), Nano.orElse(() => Nano.void_))
        if (!causeFile) continue
        const type = typeChecker.getDeclaredTypeOfSymbol(symbol)
        if (!type) continue
        if (typeChecker.isTypeAssignableTo(givenType, type)) {
          return type
        }
      }
      return yield* typeParserIssue("Type does not extend Cause.YieldableError", givenType)
    }),
    "TypeParser.extendsCauseYieldableError",
    (type) => type
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
      if (supportedEffect() === "v4") {
        // Effect v4 TypeId shortcut
        const typeIdSymbol = typeChecker.getPropertyOfType(type, "~effect/Effect")
        if (typeIdSymbol) {
          const typeIdType = typeChecker.getTypeOfSymbolAtLocation(typeIdSymbol, atLocation)
          return yield* effectVarianceStruct(typeIdType, atLocation)
        }
        return yield* typeParserIssue("Type is not an effect", type, atLocation)
      } else {
        // get the properties to check (exclude non-property and optional properties)
        const propertiesSymbols = typeChecker.getPropertiesOfType(type).filter((_) =>
          _.flags & ts.SymbolFlags.Property && !(_.flags & ts.SymbolFlags.Optional) && _.valueDeclaration
        )
        // early exit
        if (propertiesSymbols.length === 0) {
          return yield* typeParserIssue("Type has no effect variance struct", type, atLocation)
        }
        // try to put typeid first (heuristic to optimize hot path)
        propertiesSymbols.sort((a, b) =>
          ts.symbolName(b).indexOf("EffectTypeId") - ts.symbolName(a).indexOf("EffectTypeId")
        )
        // has a property symbol which is an effect variance struct
        return yield* Nano.firstSuccessOf(propertiesSymbols.map((propertySymbol) => {
          const propertyType = typeChecker.getTypeOfSymbolAtLocation(propertySymbol, atLocation)
          return effectVarianceStruct(propertyType, atLocation)
        }))
      }
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
        _.flags & ts.SymbolFlags.Property && !(_.flags & ts.SymbolFlags.Optional) && _.valueDeclaration
      )
      // early exit
      if (propertiesSymbols.length === 0) {
        return yield* typeParserIssue("Type has no layer variance struct", type, atLocation)
      }
      // try to put typeid first (heuristic to optimize hot path)
      propertiesSymbols.sort((a, b) =>
        ts.symbolName(b).indexOf("LayerTypeId") - ts.symbolName(a).indexOf("LayerTypeId")
      )
      // has a property symbol which is a layer variance struct
      return yield* Nano.firstSuccessOf(propertiesSymbols.map((propertySymbol) => {
        const propertyType = typeChecker.getTypeOfSymbolAtLocation(propertySymbol, atLocation)
        return layerVarianceStruct(propertyType, atLocation)
      }))
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

  const isEffectContextSourceFile = Nano.cachedBy(
    Nano.fn("TypeParser.isEffectContextSourceFile")(function*(
      sourceFile: ts.SourceFile
    ) {
      const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile)
      if (!moduleSymbol) return yield* typeParserIssue("Node has no symbol", undefined, sourceFile)
      const contextSymbol = typeChecker.tryGetMemberInModuleExports("Context", moduleSymbol)
      if (!contextSymbol) return yield* typeParserIssue("Context not found", undefined, sourceFile)
      const tagSymbol = typeChecker.tryGetMemberInModuleExports("Tag", moduleSymbol)
      if (!tagSymbol) return yield* typeParserIssue("Tag not found", undefined, sourceFile)
      const tagType = typeChecker.getDeclaredTypeOfSymbol(tagSymbol)
      yield* contextTag(tagType, sourceFile)
      return sourceFile
    }),
    "TypeParser.isEffectContextSourceFile",
    (sourceFile) => sourceFile
  )

  const isNodeReferenceToEffectContextModuleApi = (memberName: string) =>
    Nano.cachedBy(
      Nano.fn("TypeParser.isNodeReferenceToEffectContextModuleApi")(function*(
        node: ts.Node
      ) {
        return yield* isNodeReferenceToExportOfPackageModule(node, "effect", isEffectContextSourceFile, memberName)
      }),
      `TypeParser.isNodeReferenceToEffectContextModuleApi(${memberName})`,
      (node) => node
    )

  const importedContextModule = Nano.cachedBy(
    (node: ts.Node) =>
      pipe(
        isNodeReferenceToPackageModule(node, "effect", isEffectContextSourceFile),
        Nano.map(() => node)
      ),
    "TypeParser.importedContextModule",
    (node) => node
  )

  const importedEffectModule = Nano.cachedBy(
    (node: ts.Node) =>
      pipe(
        isNodeReferenceToPackageModule(node, "effect", isEffectTypeSourceFile),
        Nano.map(() => node)
      ),
    "TypeParser.importedEffectModule",
    (node) => node
  )

  const isEffectDataSourceFile = Nano.cachedBy(
    Nano.fn("TypeParser.isEffectDataSourceFile")(function*(
      sourceFile: ts.SourceFile
    ) {
      const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile)
      if (!moduleSymbol) return yield* typeParserIssue("Node has no symbol", undefined, sourceFile)
      const taggedEnumSymbol = typeChecker.tryGetMemberInModuleExports("TaggedEnum", moduleSymbol) ||
        typeChecker.tryGetMemberInModuleExports("taggedEnum", moduleSymbol)
      if (!taggedEnumSymbol) return yield* typeParserIssue("TaggedEnum not found", undefined, sourceFile)
      const taggedErrorSymbol = typeChecker.tryGetMemberInModuleExports("TaggedError", moduleSymbol)
      if (!taggedErrorSymbol) return yield* typeParserIssue("TaggedError not found", undefined, sourceFile)

      return sourceFile
    }),
    "TypeParser.isEffectDataSourceFile",
    (sourceFile) => sourceFile
  )

  const isNodeReferenceToEffectDataModuleApi = (memberName: string) =>
    Nano.cachedBy(
      Nano.fn("TypeParser.isNodeReferenceToEffectDataModuleApi")(function*(
        node: ts.Node
      ) {
        return yield* isNodeReferenceToExportOfPackageModule(node, "effect", isEffectDataSourceFile, memberName)
      }),
      `TypeParser.isNodeReferenceToEffectDataModuleApi(${memberName})`,
      (node) => node
    )

  const importedDataModule = Nano.cachedBy(
    (node: ts.Node) =>
      pipe(
        isNodeReferenceToPackageModule(node, "effect", isEffectDataSourceFile),
        Nano.map(() => node)
      ),
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
      const pipeArguments = node.arguments.slice(1)
      return pipe(
        isNodeReferenceToEffectModuleApi("fnUntraced")(propertyAccess),
        Nano.map(() => ({
          node,
          effectModule: propertyAccess.expression,
          generatorFunction,
          body: generatorFunction.body,
          pipeArguments
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
      const traceExpression: ts.Expression | undefined =
        ts.isCallExpression(node.expression) && node.expression.arguments.length > 0
          ? node.expression.arguments[0]
          : undefined
      const propertyAccess = expressionToTest
      const pipeArguments = node.arguments.slice(1)
      return pipe(
        isNodeReferenceToEffectModuleApi("fn")(propertyAccess),
        Nano.map(() => ({
          node,
          generatorFunction,
          effectModule: propertyAccess.expression,
          body: generatorFunction.body,
          pipeArguments,
          traceExpression
        }))
      )
    },
    "TypeParser.effectFnGen",
    (node) => node
  )

  const findEnclosingScopes = Nano.fn("TypeParser.findEnclosingScopes")(function*(
    startNode: ts.Node
  ) {
    let currentParent: ts.Node | undefined = startNode.parent
    let scopeNode: ts.FunctionLikeDeclaration | undefined = undefined
    let effectGenResult: {
      node: ts.Node
      effectModule: ts.Node | ts.Expression
      generatorFunction: ts.FunctionExpression
      body: ts.Block
      pipeArguments?: ReadonlyArray<ts.Expression>
    } | undefined = undefined

    while (currentParent) {
      const nodeToCheck: ts.Node = currentParent

      // Check if this node introduces a function scope
      if (!scopeNode) {
        if (
          ts.isFunctionExpression(nodeToCheck) ||
          ts.isFunctionDeclaration(nodeToCheck) ||
          ts.isMethodDeclaration(nodeToCheck) ||
          ts.isArrowFunction(nodeToCheck) ||
          ts.isGetAccessorDeclaration(nodeToCheck) ||
          ts.isSetAccessorDeclaration(nodeToCheck)
        ) {
          scopeNode = nodeToCheck
        }
      }

      // Try to parse as Effect.gen, Effect.fnUntraced, or Effect.fn
      if (!effectGenResult) {
        const isEffectGen = yield* pipe(
          effectGen(nodeToCheck),
          Nano.map((result) => ({
            node: result.node,
            effectModule: result.effectModule,
            generatorFunction: result.generatorFunction,
            body: result.body
          })),
          Nano.orElse(() =>
            pipe(
              effectFnUntracedGen(nodeToCheck),
              Nano.map((result) => ({
                node: result.node,
                effectModule: result.effectModule,
                generatorFunction: result.generatorFunction,
                body: result.body,
                pipeArguments: result.pipeArguments
              }))
            )
          ),
          Nano.orElse(() =>
            pipe(
              effectFnGen(nodeToCheck),
              Nano.map((result) => ({
                node: result.node,
                effectModule: result.effectModule,
                generatorFunction: result.generatorFunction,
                body: result.body,
                pipeArguments: result.pipeArguments
              }))
            )
          ),
          Nano.orUndefined
        )

        if (isEffectGen) {
          effectGenResult = isEffectGen
        }
      }

      // If we found both, we can stop
      if (scopeNode && effectGenResult) {
        break
      }

      currentParent = nodeToCheck.parent
    }

    return { scopeNode, effectGen: effectGenResult }
  })

  const effectFn = Nano.cachedBy(
    function(node: ts.Node) {
      // Effect.fn("name")(regularFunction, ...pipeArgs) or Effect.fn(regularFunction, ...pipeArgs)
      if (!ts.isCallExpression(node)) {
        return typeParserIssue("Node is not a call expression", undefined, node)
      }
      if (node.arguments.length === 0) {
        return typeParserIssue("Node has no arguments", undefined, node)
      }
      // first argument is a regular function (function expression or arrow function, without asterisk)
      const regularFunction = node.arguments[0]
      if (!ts.isFunctionExpression(regularFunction) && !ts.isArrowFunction(regularFunction)) {
        return typeParserIssue("Node is not a function expression or arrow function", undefined, node)
      }
      // skip generator functions - those are handled by effectFnGen
      if (ts.isFunctionExpression(regularFunction) && regularFunction.asteriskToken !== undefined) {
        return typeParserIssue("Node is a generator function, not a regular function", undefined, node)
      }
      // either we are using Effect.fn("name")(regularFunction) or we are using Effect.fn(regularFunction)
      const expressionToTest = ts.isCallExpression(node.expression)
        ? node.expression.expression
        : node.expression
      if (!ts.isPropertyAccessExpression(expressionToTest)) {
        return typeParserIssue("Node is not a property access expression", undefined, node)
      }
      const traceExpression: ts.Expression | undefined =
        ts.isCallExpression(node.expression) && node.expression.arguments.length > 0
          ? node.expression.arguments[0]
          : undefined
      const propertyAccess = expressionToTest
      const pipeArguments = node.arguments.slice(1)
      return pipe(
        isNodeReferenceToEffectModuleApi("fn")(propertyAccess),
        Nano.map(() => ({
          node,
          effectModule: propertyAccess.expression,
          regularFunction,
          pipeArguments,
          traceExpression
        }))
      )
    },
    "TypeParser.effectFn",
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
          const type = typeCheckerUtils.getTypeAtLocation(yieldedExpression)
          if (!type) continue
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
      // Effect v4 shortcut
      const typeId = typeChecker.getPropertyOfType(type, "~effect/Schema/Schema")
      if (typeId) {
        const typeKey = typeChecker.getPropertyOfType(type, "Type")
        const encodedKey = typeChecker.getPropertyOfType(type, "Encoded")
        if (typeKey && encodedKey) {
          const typeType = typeChecker.getTypeOfSymbolAtLocation(typeKey, atLocation)
          const encodedType = typeChecker.getTypeOfSymbolAtLocation(encodedKey, atLocation)
          return {
            A: typeType,
            I: encodedType,
            R: typeChecker.getNeverType()
          }
        }
        return yield* typeParserIssue("missing Type and Encoded")
      }
      // should have an 'ast' property
      const ast = typeChecker.getPropertyOfType(type, "ast")
      if (!ast) return yield* typeParserIssue("Has no 'ast' property", type, atLocation)
      // get the properties to check (exclude non-property and optional properties)
      const propertiesSymbols = typeChecker.getPropertiesOfType(type).filter((_) =>
        _.flags & ts.SymbolFlags.Property && !(_.flags & ts.SymbolFlags.Optional) && _.valueDeclaration
      )
      // early exit
      if (propertiesSymbols.length === 0) {
        return yield* typeParserIssue("Type has no schema variance struct", type, atLocation)
      }
      // try to put typeid first (heuristic to optimize hot path)
      propertiesSymbols.sort((a, b) => ts.symbolName(b).indexOf("TypeId") - ts.symbolName(a).indexOf("TypeId"))
      // has a property symbol which is an effect variance struct
      return yield* Nano.firstSuccessOf(propertiesSymbols.map((propertySymbol) => {
        const propertyType = typeChecker.getTypeOfSymbolAtLocation(propertySymbol, atLocation)
        return effectSchemaVarianceStruct(propertyType, atLocation)
      }))
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

  const isEffectParseResultSourceFile = Nano.cachedBy(
    Nano.fn("TypeParser.isEffectParseResultSourceFile")(function*(
      sourceFile: ts.SourceFile
    ) {
      const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile)
      if (!moduleSymbol) return yield* typeParserIssue("Node has no symbol", undefined, sourceFile)
      // Check for ParseIssue type
      const parseIssueSymbol = typeChecker.tryGetMemberInModuleExports("ParseIssue", moduleSymbol)
      if (!parseIssueSymbol) return yield* typeParserIssue("ParseIssue type not found", undefined, sourceFile)
      // Check for decodeSync export
      const decodeSyncSymbol = typeChecker.tryGetMemberInModuleExports("decodeSync", moduleSymbol)
      if (!decodeSyncSymbol) return yield* typeParserIssue("decodeSync not found", undefined, sourceFile)
      // Check for encodeSync export
      const encodeSyncSymbol = typeChecker.tryGetMemberInModuleExports("encodeSync", moduleSymbol)
      if (!encodeSyncSymbol) return yield* typeParserIssue("encodeSync not found", undefined, sourceFile)
      return sourceFile
    }),
    "TypeParser.isEffectParseResultSourceFile",
    (sourceFile) => sourceFile
  )

  const isNodeReferenceToEffectParseResultModuleApi = (memberName: string) =>
    Nano.cachedBy(
      Nano.fn("TypeParser.isNodeReferenceToEffectParseResultModuleApi")(function*(
        node: ts.Node
      ) {
        return yield* isNodeReferenceToExportOfPackageModule(node, "effect", isEffectParseResultSourceFile, memberName)
      }),
      `TypeParser.isNodeReferenceToEffectParseResultModuleApi(${memberName})`,
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
        _.flags & ts.SymbolFlags.Property && !(_.flags & ts.SymbolFlags.Optional) && _.valueDeclaration
      )
      // early exit
      if (propertiesSymbols.length === 0) {
        return yield* typeParserIssue("Type has no tag variance struct", type, atLocation)
      }
      // try to put typeid first (heuristic to optimize hot path)
      propertiesSymbols.sort((a, b) => ts.symbolName(b).indexOf("TypeId") - ts.symbolName(a).indexOf("TypeId"))
      // has a property symbol which is a context tag variance struct
      return yield* Nano.firstSuccessOf(propertiesSymbols.map((propertySymbol) => {
        const propertyType = typeChecker.getTypeOfSymbolAtLocation(propertySymbol, atLocation)
        return contextTagVarianceStruct(propertyType, atLocation)
      }))
    }),
    "TypeParser.contextTag",
    (type) => type
  )

  const effectFunctionImportedName = Nano.cachedBy(
    Nano.fn("TypeParser.effectFunctionImportedName")(function*(
      sourceFile: ts.SourceFile
    ) {
      return tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(sourceFile, "effect", "Function")
    }),
    "TypeParser.effectFunctionImportedName",
    (node) => node
  )

  const pipeCall = Nano.cachedBy(
    function(
      node: ts.Node
    ): Nano.Nano<
      ParsedPipeCall,
      TypeParserIssue,
      never
    > {
      // Function.pipe(A, B, ...) or expression.pipe(.....)
      if (
        ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.name) &&
        ts.idText(node.expression.name) === "pipe"
      ) {
        const baseExpression = node.expression.expression
        return pipe(
          effectFunctionImportedName(tsUtils.getSourceFileOfNode(node)!),
          Nano.flatMap((functionIdentifier) => {
            if (
              functionIdentifier && ts.isIdentifier(baseExpression) && ts.idText(baseExpression) === functionIdentifier
            ) {
              // Namespace.pipe(A, B, ...)
              if (node.arguments.length === 0) {
                return typeParserIssue("Node is not a pipe call", undefined, node)
              }
              const [subject, ...args] = node.arguments
              return Nano.succeed<ParsedPipeCall>({
                node,
                subject,
                args,
                kind: "pipe"
              })
            }
            // expression.pipe(.....)
            return Nano.succeed<ParsedPipeCall>({
              node,
              subject: baseExpression,
              args: Array.from(node.arguments),
              kind: "pipeable"
            })
          })
        )
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

  const singleArgCall = Nano.cachedBy(
    function(
      node: ts.Node
    ): Nano.Nano<ParsedSingleArgCall, TypeParserIssue, never> {
      // Must be a call expression with exactly one argument
      // Any call of the shape fn(arg) can be rewritten as pipe(arg, fn)
      if (!ts.isCallExpression(node)) {
        return typeParserIssue("Node is not a call expression", undefined, node)
      }
      if (node.arguments.length !== 1) {
        return typeParserIssue("Node must have exactly one argument", undefined, node)
      }

      return Nano.succeed({
        node,
        callee: node.expression,
        subject: node.arguments[0]
      })
    },
    "TypeParser.singleArgCall",
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
        _.flags & ts.SymbolFlags.Property && !(_.flags & ts.SymbolFlags.Optional) && _.valueDeclaration
      )
      // has a property scope type id (symbol name contains ScopeTypeId)
      if (propertiesSymbols.some((s) => ts.symbolName(s).indexOf("ScopeTypeId") !== -1)) {
        return type
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
                  Nano.orUndefined
                )
                if (isEffectSchemaModuleApi) {
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
                  Nano.orUndefined
                )
                if (isEffectSchemaModuleApi) {
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
                  Nano.orUndefined
                )
                if (isEffectSchemaModuleApi) {
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
      if (supportedEffect() === "v4") {
        return yield* typeParserIssue("Schema.TaggedClass is not supported in Effect v4", undefined, atLocation)
      }
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
                  Nano.orUndefined
                )
                if (isEffectSchemaModuleApi) {
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

  const extendsSchemaRequestClass = Nano.cachedBy(
    Nano.fn("TypeParser.extendsSchemaRequestClass")(function*(
      atLocation: ts.ClassDeclaration
    ) {
      if (supportedEffect() === "v3") {
        return yield* typeParserIssue("Schema.RequestClass is not supported in Effect v3", undefined, atLocation)
      }
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
            // Schema.RequestClass<T>("name")({})
            const expression = typeX.expression
            if (ts.isCallExpression(expression)) {
              // Schema.RequestClass<T>("name")
              const schemaTaggedRequestTCall = expression.expression
              if (
                ts.isCallExpression(schemaTaggedRequestTCall) &&
                schemaTaggedRequestTCall.typeArguments &&
                schemaTaggedRequestTCall.typeArguments.length > 0
              ) {
                const selfTypeNode = schemaTaggedRequestTCall.typeArguments[0]!
                const isEffectSchemaModuleApi = yield* pipe(
                  isNodeReferenceToEffectSchemaModuleApi("RequestClass")(schemaTaggedRequestTCall.expression),
                  Nano.orUndefined
                )
                if (isEffectSchemaModuleApi) {
                  return {
                    className: atLocation.name,
                    selfTypeNode,
                    tagStringLiteral: undefined,
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
      return yield* typeParserIssue("Class does not extend Schema.RequestClass", undefined, atLocation)
    }),
    "TypeParser.extendsSchemaRequestClass",
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
                  Nano.orUndefined
                )
                if (parsedDataModule) {
                  // For Data.TaggedError, the structure is: Data.TaggedError("name")<{}>
                  // The string literal is in the single call expression
                  return {
                    className: atLocation.name,
                    keyStringLiteral: dataTaggedErrorCall.arguments.length > 0 &&
                        ts.isStringLiteral(dataTaggedErrorCall.arguments[0])
                      ? dataTaggedErrorCall.arguments[0]
                      : undefined,
                    Data: parsedDataModule
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
                  Nano.orUndefined
                )
                if (parsedDataModule) {
                  // For Data.TaggedClass, the structure is: Data.TaggedClass("name")<{}>
                  // The string literal is in the single call expression
                  return {
                    className: atLocation.name,
                    keyStringLiteral: dataTaggedClassCall.arguments.length > 0 &&
                        ts.isStringLiteral(dataTaggedClassCall.arguments[0])
                      ? dataTaggedClassCall.arguments[0]
                      : undefined,
                    Data: parsedDataModule
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
                    Nano.orUndefined
                  )
                  if (parsedContextModule) {
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
                      Tag: parsedContextModule
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
                  Nano.orUndefined
                )
                if (isEffectTag) {
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
                  Nano.orUndefined
                )
                if (isEffectService) {
                  const classSym = typeChecker.getSymbolAtLocation(atLocation.name)
                  if (!classSym) return yield* typeParserIssue("Class has no symbol", undefined, atLocation)
                  const type = typeChecker.getTypeOfSymbol(classSym)
                  const parsedContextTag = yield* pipe(
                    contextTag(type, atLocation),
                    Nano.orUndefined
                  )
                  if (parsedContextTag) {
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
                      ...parsedContextTag,
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

  const isEffectSqlModelTypeSourceFile = Nano.cachedBy(
    Nano.fn("TypeParser.isEffectSqlModelTypeSourceFile")(function*(
      sourceFile: ts.SourceFile
    ) {
      const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile)
      if (!moduleSymbol) return yield* typeParserIssue("Node has no symbol", undefined, sourceFile)
      // check for Class
      const classSymbol = typeChecker.tryGetMemberInModuleExports("Class", moduleSymbol)
      if (!classSymbol) return yield* typeParserIssue("Model's Class type not found", undefined, sourceFile)
      // check for makeRepository
      const makeRepositorySymbol = typeChecker.tryGetMemberInModuleExports("makeRepository", moduleSymbol)
      if (!makeRepositorySymbol) {
        return yield* typeParserIssue("Model's makeRepository type not found", undefined, sourceFile)
      }
      // check for makeDataLoaders
      const makeDataLoadersSymbol = typeChecker.tryGetMemberInModuleExports("makeDataLoaders", moduleSymbol)
      if (!makeDataLoadersSymbol) {
        return yield* typeParserIssue("Model's makeDataLoaders type not found", undefined, sourceFile)
      }
      return sourceFile
    }),
    "TypeParser.isEffectSqlModelTypeSourceFile",
    (sourceFile) => sourceFile
  )

  const isNodeReferenceToEffectSqlModelModuleApi = (memberName: string) =>
    Nano.cachedBy(
      Nano.fn("TypeParser.isNodeReferenceToEffectSqlModelModuleApi")(function*(
        node: ts.Node
      ) {
        return yield* isNodeReferenceToExportOfPackageModule(
          node,
          "@effect/sql",
          isEffectSqlModelTypeSourceFile,
          memberName
        )
      }),
      `TypeParser.isNodeReferenceToEffectSqlModelModuleApi(${memberName})`,
      (node) => node
    )

  const extendsEffectSqlModelClass = Nano.cachedBy(
    Nano.fn("TypeParser.extendsEffectSqlModelClass")(function*(
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
              // Model.Class<T>("name")({})
              const schemaCall = expression.expression
              if (ts.isCallExpression(schemaCall) && schemaCall.typeArguments && schemaCall.typeArguments.length > 0) {
                const isEffectSchemaModuleApi = yield* pipe(
                  isNodeReferenceToEffectSqlModelModuleApi("Class")(schemaCall.expression),
                  Nano.orUndefined
                )
                if (isEffectSchemaModuleApi) {
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
      return yield* typeParserIssue("Class does not extend @effect/sql's Model.Class", undefined, atLocation)
    }),
    "TypeParser.extendsEffectSqlModelClass",
    (atLocation) => atLocation
  )

  const isEffectLayerTypeSourceFile = Nano.cachedBy(
    Nano.fn("TypeParser.isEffectLayerTypeSourceFile")(function*(
      sourceFile: ts.SourceFile
    ) {
      const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile)
      if (!moduleSymbol) return yield* typeParserIssue("Node has no symbol", undefined, sourceFile)
      const layerTypeSymbol = typeChecker.tryGetMemberInModuleExports("Layer", moduleSymbol)
      if (!layerTypeSymbol) return yield* typeParserIssue("Layer type not found", undefined, sourceFile)
      const type = typeChecker.getDeclaredTypeOfSymbol(layerTypeSymbol)
      yield* layerType(type, sourceFile)
      return sourceFile
    }),
    "TypeParser.isEffectLayerTypeSourceFile",
    (sourceFile) => sourceFile
  )

  const isNodeReferenceToEffectLayerModuleApi = (memberName: string) =>
    Nano.cachedBy(
      Nano.fn("TypeParser.isNodeReferenceToEffectLayerModuleApi")(function*(
        node: ts.Node
      ) {
        return yield* isNodeReferenceToExportOfPackageModule(
          node,
          "effect",
          isEffectLayerTypeSourceFile,
          memberName
        )
      }),
      `TypeParser.isNodeReferenceToEffectLayerModuleApi(${memberName})`,
      (node) => node
    )

  const lazyExpression = Nano.cachedBy(
    function(node: ts.Node): Nano.Nano<ParsedLazyExpression, TypeParserIssue, never> {
      // Must be an arrow function or function expression
      if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) {
        return typeParserIssue("Node is not an arrow function or function expression", undefined, node)
      }

      // Must have zero parameters
      if (node.parameters.length !== 0) {
        return typeParserIssue("Function must have zero parameters", undefined, node)
      }

      // Must have no type parameters
      if (node.typeParameters && node.typeParameters.length > 0) {
        return typeParserIssue("Function must have no type parameters", undefined, node)
      }

      const body = node.body

      const returnType = node.type

      // For arrow functions with expression body: () => expression
      if (ts.isArrowFunction(node) && !ts.isBlock(body)) {
        return Nano.succeed({
          node,
          body,
          expression: body,
          returnType
        })
      }

      // For block body: must have exactly one statement which is a return statement with an expression
      if (ts.isBlock(body)) {
        if (body.statements.length !== 1) {
          return typeParserIssue("Block must have exactly one statement", undefined, node)
        }

        const stmt = body.statements[0]
        if (!ts.isReturnStatement(stmt)) {
          return typeParserIssue("Statement must be a return statement", undefined, node)
        }

        if (!stmt.expression) {
          return typeParserIssue("Return statement must have an expression", undefined, node)
        }

        return Nano.succeed({
          node,
          body,
          expression: stmt.expression,
          returnType
        })
      }

      return typeParserIssue("Invalid function body", undefined, node)
    },
    "TypeParser.lazyExpression",
    (node) => node
  )

  const emptyFunction = Nano.cachedBy(
    function(node: ts.Node): Nano.Nano<ParsedEmptyFunction, TypeParserIssue, never> {
      // Must be an arrow function or function expression
      if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) {
        return typeParserIssue("Node is not an arrow function or function expression", undefined, node)
      }

      const body = node.body
      const returnType = node.type

      // Must be a block with zero statements
      if (!ts.isBlock(body)) {
        return typeParserIssue("Body must be a block", undefined, node)
      }

      if (body.statements.length !== 0) {
        return typeParserIssue("Block must have zero statements", undefined, node)
      }

      return Nano.succeed({
        node,
        body,
        returnType
      })
    },
    "TypeParser.emptyFunction",
    (node) => node
  )

  const pipingFlows = (includeEffectFn: boolean) =>
    Nano.cachedBy(
      Nano.fn("TypeParser.pipingFlows")(function*(
        sourceFile: ts.SourceFile
      ) {
        const result: Array<ParsedPipingFlow> = []

        // Work queue: [node, parentFlow | undefined]
        // When parentFlow is set, we're traversing down a pipe's subject chain
        const workQueue: Array<[ts.Node, ParsedPipingFlow | undefined]> = [[sourceFile, undefined]]

        while (workQueue.length > 0) {
          const [node, parentFlow] = workQueue.pop()!

          // Try to parse as a pipe call or single-argument call
          if (ts.isCallExpression(node)) {
            const parsed = yield* pipe(
              pipeCall(node),
              Nano.map((p) => ({ _tag: "pipe" as const, ...p })),
              Nano.orElse(() =>
                pipe(
                  singleArgCall(node),
                  Nano.map((s) => ({ _tag: "call" as const, ...s }))
                )
              ),
              Nano.orUndefined
            )

            if (parsed) {
              // Build transformations based on parse result type
              let transformations: Array<ParsedPipingFlowTransformation>
              let flowNode: ts.Expression
              let childrenToTraverse: Array<ts.Node> = []

              if (parsed._tag === "pipe") {
                // Get the resolved signature to extract intermediate types
                const signature = typeChecker.getResolvedSignature(parsed.node)
                const typeArguments = signature
                  ? typeChecker.getTypeArgumentsForResolvedSignature(signature) as Array<ts.Type> | undefined
                  : undefined

                transformations = []
                for (let i = 0; i < parsed.args.length; i++) {
                  const arg = parsed.args[i]
                  // For pipe(subject, f1, f2, f3), typeArguments are [A, B, C, D]
                  // where A=input, B=after f1, C=after f2, D=after f3
                  // So for transformation at index i, outType is typeArguments[i+1]
                  const outType = typeArguments?.[i + 1]

                  if (ts.isCallExpression(arg)) {
                    // CallExpression like Effect.map((x) => x + 1)
                    transformations.push({
                      callee: arg.expression, // e.g., Effect.map
                      args: Array.from(arg.arguments), // e.g., [(x) => x + 1]
                      outType,
                      kind: parsed.kind
                    })
                  } else {
                    // Constant like Effect.asVoid
                    transformations.push({
                      callee: arg, // e.g., Effect.asVoid
                      args: undefined,
                      outType,
                      kind: parsed.kind
                    })
                  }
                }

                flowNode = parsed.node
                // Queue the transformation arguments for independent traversal
                childrenToTraverse = parsed.args
              } else {
                // Single-argument call (dual API pattern)
                const callSignature = typeChecker.getResolvedSignature(node)
                const outType = callSignature ? typeChecker.getReturnTypeOfSignature(callSignature) : undefined

                transformations = [{
                  callee: parsed.callee,
                  args: undefined,
                  outType,
                  kind: "call"
                }]
                flowNode = node
              }

              // Handle parent flow or create new flow (common logic)
              if (parentFlow) {
                // Extend parent flow: prepend our transformations (we're inner, they're outer)
                parentFlow.transformations.unshift(...transformations)
                // Update subject to the inner expression (will be updated further if chain continues)
                parentFlow.subject = {
                  node: parsed.subject,
                  outType: typeCheckerUtils.getTypeAtLocation(parsed.subject)
                }
                workQueue.push([parsed.subject, parentFlow])
              } else {
                // Start a new flow with subject set to current inner expression
                const newFlow: ParsedPipingFlow = {
                  node: flowNode,
                  subject: {
                    node: parsed.subject,
                    outType: typeCheckerUtils.getTypeAtLocation(parsed.subject)
                  },
                  transformations
                }
                workQueue.push([parsed.subject, newFlow])
              }

              // Queue children for independent traversal (they may contain their own pipe flows)
              for (const child of childrenToTraverse) {
                ts.forEachChild(child, (c) => {
                  workQueue.push([c, undefined])
                })
              }
              continue
            }

            // Try to parse as Effect.fn or Effect.fnUntraced with pipe transformations
            if (includeEffectFn) {
              // Try generator versions first
              const effectFnKind = yield* pipe(
                Nano.map(effectFnGen(node), (_) => ({ kind: "effectFnGen" as const, ..._ })),
                Nano.orElse(() =>
                  Nano.map(effectFnUntracedGen(node), (_) => ({ kind: "effectFnUntracedGen" as const, ..._ }))
                ),
                Nano.orElse(() => Nano.map(effectFn(node), (_) => ({ kind: "effectFn" as const, ..._ }))),
                Nano.orUndefined
              )

              // Handle generator versions (Effect.fn with function*() or Effect.fnUntraced with function*())
              if (
                effectFnKind && (effectFnKind.kind === "effectFnGen" || effectFnKind.kind === "effectFnUntracedGen")
              ) {
                if (effectFnKind.pipeArguments.length > 0) {
                  const fnResult = effectFnKind
                  const pipeArgs = fnResult.pipeArguments

                  // Build transformations from pipeArguments
                  // For Effect.fn(gen, f1, f2), each fi is a function Effect<A,E,R> => Effect<B,E,R>
                  // We get the contextual type of each argument to get the resolved/instantiated types
                  const transformations: Array<ParsedPipingFlowTransformation> = []
                  let subjectType: ts.Type | undefined

                  for (let i = 0; i < pipeArgs.length; i++) {
                    const arg = pipeArgs[i]
                    // Get the contextual type of the argument within the Effect.fn call
                    // This gives us the instantiated type with concrete type parameters
                    const contextualType = typeChecker.getContextualType(arg)
                    // Get the call signature from the contextual type to find input/output types
                    const callSigs = contextualType
                      ? typeChecker.getSignaturesOfType(contextualType, ts.SignatureKind.Call)
                      : []
                    const outType = callSigs.length > 0
                      ? typeChecker.getReturnTypeOfSignature(callSigs[0])
                      : undefined

                    // Get the subject type from the first transformation's input parameter
                    if (i === 0 && callSigs.length > 0) {
                      const params = callSigs[0].parameters
                      if (params.length > 0) {
                        subjectType = typeChecker.getTypeOfSymbol(params[0])
                      }
                    }

                    if (ts.isCallExpression(arg)) {
                      transformations.push({
                        callee: arg.expression,
                        args: Array.from(arg.arguments),
                        outType,
                        kind: effectFnKind.kind === "effectFnUntracedGen" ? "effectFnUntraced" : "effectFn"
                      })
                    } else {
                      transformations.push({
                        callee: arg,
                        args: undefined,
                        outType,
                        kind: effectFnKind.kind === "effectFnUntracedGen" ? "effectFnUntraced" : "effectFn"
                      })
                    }
                  }

                  const newFlow: ParsedPipingFlow = {
                    node,
                    subject: {
                      node,
                      outType: subjectType
                    },
                    transformations
                  }
                  result.push(newFlow)

                  // Queue children (generator function body) for independent traversal
                  workQueue.push([fnResult.body, undefined])
                  // Queue pipe arguments for independent traversal
                  for (const arg of pipeArgs) {
                    ts.forEachChild(arg, (c) => {
                      workQueue.push([c, undefined])
                    })
                  }
                  continue
                }
              }

              // Handle non-generator version (Effect.fn with regular function or arrow function)
              if (
                effectFnKind && effectFnKind.kind === "effectFn" &&
                effectFnKind.pipeArguments.length > 0
              ) {
                const fnResult = effectFnKind
                const pipeArgs = fnResult.pipeArguments

                // Build transformations from pipeArguments
                const transformations: Array<ParsedPipingFlowTransformation> = []
                let subjectType: ts.Type | undefined

                for (let i = 0; i < pipeArgs.length; i++) {
                  const arg = pipeArgs[i]
                  const contextualType = typeChecker.getContextualType(arg)
                  const callSigs = contextualType
                    ? typeChecker.getSignaturesOfType(contextualType, ts.SignatureKind.Call)
                    : []
                  const outType = callSigs.length > 0
                    ? typeChecker.getReturnTypeOfSignature(callSigs[0])
                    : undefined

                  if (i === 0 && callSigs.length > 0) {
                    const params = callSigs[0].parameters
                    if (params.length > 0) {
                      subjectType = typeChecker.getTypeOfSymbol(params[0])
                    }
                  }

                  if (ts.isCallExpression(arg)) {
                    transformations.push({
                      callee: arg.expression,
                      args: Array.from(arg.arguments),
                      outType,
                      kind: "effectFn"
                    })
                  } else {
                    transformations.push({
                      callee: arg,
                      args: undefined,
                      outType,
                      kind: "effectFn"
                    })
                  }
                }

                const newFlow: ParsedPipingFlow = {
                  node,
                  subject: {
                    node,
                    outType: subjectType
                  },
                  transformations
                }
                result.push(newFlow)

                // Queue children (regular function body) for independent traversal
                const regularFn = fnResult.regularFunction
                if (ts.isArrowFunction(regularFn)) {
                  if (ts.isBlock(regularFn.body)) {
                    workQueue.push([regularFn.body, undefined])
                  } else {
                    workQueue.push([regularFn.body, undefined])
                  }
                } else if (regularFn.body) {
                  workQueue.push([regularFn.body, undefined])
                }
                // Queue pipe arguments for independent traversal
                for (const arg of pipeArgs) {
                  ts.forEachChild(arg, (c) => {
                    workQueue.push([c, undefined])
                  })
                }
                continue
              }
            }
          }

          // Not a pipe call (or failed to parse)
          if (parentFlow && parentFlow.transformations.length > 0) {
            // The subject chain ended - subject is already set, push the flow
            result.push(parentFlow)
          }

          // Queue all children for traversal (no parent flow)
          ts.forEachChild(node, (child) => {
            workQueue.push([child, undefined])
          })
        }

        // Sort flows by position for consistent ordering
        result.sort((a, b) => a.node.pos - b.node.pos)

        return result
      }),
      `TypeParser.pipingFlows(${includeEffectFn})`,
      (sourceFile) => sourceFile
    )

  /**
   * Reconstructs a piping flow into an AST expression by applying transformations sequentially.
   * For example: subject with transformations [f, g] becomes g(f(subject))
   *
   * Note: Effect.fn and Effect.fnUntraced transformations cannot be reconstructed as a chain
   * since they are part of the Effect.fn call itself. In this case, the original node is returned.
   */
  const reconstructPipingFlow = (
    flow: Pick<ParsedPipingFlow, "subject" | "transformations">
  ): ts.Expression => {
    // Check if all transformations are effectFn or effectFnUntraced
    // In this case, reconstruction is not possible - return the original node
    if (
      flow.transformations.length > 0 &&
      flow.transformations.every((t) => t.kind === "effectFn" || t.kind === "effectFnUntraced")
    ) {
      return flow.subject.node
    }

    let result: ts.Expression = flow.subject.node

    for (const t of flow.transformations) {
      if (t.kind === "call") {
        // Single-arg call: callee(result)
        result = ts.factory.createCallExpression(
          t.callee,
          undefined,
          [result]
        )
      } else if (t.kind === "effectFn" || t.kind === "effectFnUntraced") {
        // Effect.fn transformations cannot be reconstructed as part of a chain
        // This should not happen in practice since we check above, but handle it gracefully
        continue
      } else {
        // Pipe or pipeable: we need to apply the transformation
        if (t.args) {
          // It's like Effect.map(fn) - create call and wrap result
          const transformCall = ts.factory.createCallExpression(
            t.callee,
            undefined,
            t.args
          )
          result = ts.factory.createCallExpression(
            transformCall,
            undefined,
            [result]
          )
        } else {
          // It's a constant like Effect.asVoid
          result = ts.factory.createCallExpression(
            t.callee,
            undefined,
            [result]
          )
        }
      }
    }

    return result
  }

  return {
    isNodeReferenceToEffectModuleApi,
    isNodeReferenceToEffectSchemaModuleApi,
    isNodeReferenceToEffectParseResultModuleApi,
    isNodeReferenceToEffectDataModuleApi,
    isNodeReferenceToEffectContextModuleApi,
    isNodeReferenceToEffectSqlModelModuleApi,
    isNodeReferenceToEffectLayerModuleApi,
    effectType,
    strictEffectType,
    layerType,
    fiberType,
    effectSubtype,
    importedEffectModule,
    effectGen,
    effectFnUntracedGen,
    effectFnGen,
    findEnclosingScopes,
    effectFn,
    extendsCauseYieldableError,
    unnecessaryEffectGen,
    effectSchemaType,
    contextTag,
    pipeableType,
    pipeCall,
    singleArgCall,
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
    extendsSchemaTaggedRequest,
    extendsSchemaRequestClass,
    extendsEffectSqlModelClass,
    lazyExpression,
    emptyFunction,
    pipingFlows,
    reconstructPipingFlow,
    getEffectRelatedPackages,
    supportedEffect
  }
}
