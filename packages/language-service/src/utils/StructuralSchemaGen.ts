import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Function from "effect/Function"
import type ts from "typescript/lib/tsserverlibrary"
import * as Nano from "../core/Nano"
import * as TypeCheckerApi from "../core/TypeCheckerApi"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils"
import * as TypeParser from "../core/TypeParser"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

/**
 * Structural Type-based Schema Generator
 *
 * Unlike the existing SchemaGen which works with TypeScript AST nodes,
 * this generator works directly with resolved TypeScript types using
 * a work queue pattern for processing complex type hierarchies.
 */

export class UnsupportedTypeError {
  readonly _tag = "@effect/language-service/UnsupportedTypeError"
  constructor(
    readonly type: ts.Type,
    readonly reason: string
  ) {}

  toString() {
    return `Unsupported type: ${this.reason}`
  }
}

interface StructuralSchemaGenContext {
  ts: TypeScriptApi.TypeScriptApi
  program: TypeScriptApi.TypeScriptProgram
  typeChecker: TypeCheckerApi.TypeCheckerApi
  typeCheckerUtils: TypeCheckerUtils.TypeCheckerUtils
  sourceFile: ts.SourceFile
  createApiPropertyAccess(apiName: string): ts.PropertyAccessExpression
  createApiCall(apiName: string, args: Array<ts.Expression>): ts.CallExpression
  hoistedSchemas: Map<ts.Type, () => ts.Expression>
  typeToStatementIndex: Map<ts.Type, number>
  nameToType: Map<string, ts.Type>
  schemaStatements: Array<ts.VariableStatement | ts.ClassDeclaration>
  usedGlobalIdentifiers: Map<string, number>
  rangesToDelete: Array<ts.TextRange>
}

const StructuralSchemaGenContext = Nano.Tag<StructuralSchemaGenContext>("StructuralSchemaGenContext")

export const makeStructuralSchemaGenContext = Nano.fn("StructuralSchemaGen.makeContext")(
  function*(sourceFile: ts.SourceFile, schemaIdentifier?: string) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    const effectSchemaIdentifier = schemaIdentifier || "Schema"

    return Function.identity<StructuralSchemaGenContext>({
      ts,
      program,
      typeChecker,
      typeCheckerUtils,
      sourceFile,
      createApiPropertyAccess: (apiName) =>
        ts.factory.createPropertyAccessExpression(
          ts.factory.createIdentifier(effectSchemaIdentifier),
          apiName
        ),
      createApiCall: (apiName, args) =>
        ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(
            ts.factory.createIdentifier(effectSchemaIdentifier),
            apiName
          ),
          [],
          args
        ),
      hoistedSchemas: new Map(),
      typeToStatementIndex: new Map(),
      nameToType: new Map(),
      usedGlobalIdentifiers: new Map(),
      schemaStatements: [],
      rangesToDelete: []
    })
  }
)

const pushHoistedStatement = Nano.fn("StructuralSchemaGen.pushHoistedStatement")(
  function*(
    ctx: StructuralSchemaGenContext,
    name: string,
    type: ts.Type,
    statement: ts.VariableStatement | ts.ClassDeclaration,
    createReference: () => ts.Expression
  ) {
    ctx.usedGlobalIdentifiers.set(name, (ctx.usedGlobalIdentifiers.get(name) || 0) + 1)
    ctx.schemaStatements.push(statement)
    ctx.typeToStatementIndex.set(type, ctx.schemaStatements.length - 1)
    ctx.hoistedSchemas.set(type, createReference)
  }
)

const pushHoistedVariableStatement = Nano.fn("StructuralSchemaGen.pushHoistedVariableStatement")(
  function*(
    ts: TypeScriptApi.TypeScriptApi,
    ctx: StructuralSchemaGenContext,
    name: string,
    type: ts.Type,
    result: ts.Expression
  ) {
    return yield* pushHoistedStatement(
      ctx,
      name,
      type,
      ts.factory.createVariableStatement(
        undefined,
        ts.factory.createVariableDeclarationList(
          [ts.factory.createVariableDeclaration(ts.factory.createIdentifier(name), undefined, undefined, result)],
          ts.NodeFlags.Const
        )
      ),
      () => ts.factory.createIdentifier(name)
    )
  }
)

/**
 * Processing context for tracking state during type traversal
 */
interface ProcessingContext {
  depth: number
  maxDepth: number
  hoistName: string | undefined
}

const createProcessingContext = (maxDepth: number = 200): ProcessingContext => ({
  depth: 0,
  maxDepth,
  hoistName: undefined
})

/**
 * Main processing function that converts a TypeScript type to a Schema expression
 */
const processType: (
  type: ts.Type,
  context?: ProcessingContext
) => Nano.Nano<ts.Expression, UnsupportedTypeError, StructuralSchemaGenContext> = Nano.fn(
  "StructuralSchemaGen.processType"
)(
  function*(type, context) {
    const processingContext = context || createProcessingContext()
    const { hoistedSchemas, nameToType, ts, typeChecker, usedGlobalIdentifiers } = yield* Nano.service(
      StructuralSchemaGenContext
    )

    // Check depth limit
    if (processingContext.depth >= processingContext.maxDepth) {
      return yield* Nano.fail(new UnsupportedTypeError(type, "Maximum depth exceeded"))
    }

    // get the interface or type alias name
    let hoistName = Array.fromIterable(nameToType.entries()).find(([_, existingType]) => existingType === type)?.[0]
    if (!hoistName && type && type.symbol && type.symbol.declarations && type.symbol.declarations.length === 1) {
      const declaration = type.symbol.declarations[0]
      if (ts.isInterfaceDeclaration(declaration)) {
        hoistName = ts.idText(declaration.name)
      } else if (
        declaration.parent && ts.isTypeAliasDeclaration(declaration.parent)
      ) {
        hoistName = ts.idText(declaration.parent.name)
      }
      if (hoistName) {
        const existingType = nameToType.get(hoistName)
        const isSame = existingType && typeChecker.isTypeAssignableTo(type, existingType) &&
          typeChecker.isTypeAssignableTo(existingType, type)
        if (!isSame) {
          // appends a counter to the name to avoid conflicts
          const usedCount = usedGlobalIdentifiers.get(hoistName) || 0
          usedGlobalIdentifiers.set(hoistName, usedCount + 1)
          hoistName = usedCount > 0 ? hoistName + "_" + usedCount : hoistName
        }
      }
    }

    // Create nested context for recursive processing
    const nestedContext: ProcessingContext = {
      ...processingContext,
      depth: processingContext.depth + 1,
      hoistName
    }

    // Check if we can reuse something from the hoistedSchemas map
    for (const [hoistedType, hoistedSchema] of hoistedSchemas.entries()) {
      if (
        hoistedType === type ||
        (typeChecker.isTypeAssignableTo(type, hoistedType) && typeChecker.isTypeAssignableTo(hoistedType, type))
      ) {
        return hoistedSchema()
      }
    }

    // Process the type and get the schema expression
    const [schemaExpr, skipHoisting] = yield* processTypeImpl(type, nestedContext)

    // From the type symbol, try to grab the name to use when hoisting the schema
    if (!skipHoisting && hoistName) {
      const ctx = yield* Nano.service(StructuralSchemaGenContext)
      yield* pushHoistedVariableStatement(ts, ctx, hoistName, type, schemaExpr)
      return ctx.hoistedSchemas.get(type)!()
    }

    return schemaExpr
  }
)

/**
 * Core implementation that determines type kind and delegates to specific handlers
 */
const processTypeImpl: (
  type: ts.Type,
  context: ProcessingContext
) => Nano.Nano<[expr: ts.Expression, skipHoisting: boolean], UnsupportedTypeError, StructuralSchemaGenContext> = Nano
  .fn(
    "StructuralSchemaGen.processTypeImpl"
  )(
    function*(type, context) {
      const { createApiCall, createApiPropertyAccess, ts, typeChecker, typeCheckerUtils } = yield* Nano
        .service(
          StructuralSchemaGenContext
        )

      // Handle primitive types
      if (type.flags & ts.TypeFlags.String) {
        return [createApiPropertyAccess("String"), true]
      }
      if (type.flags & ts.TypeFlags.Number) {
        return [createApiPropertyAccess("Number"), true]
      }
      if (type.flags & ts.TypeFlags.Boolean) {
        return [createApiPropertyAccess("Boolean"), true]
      }
      if (type.flags & ts.TypeFlags.BigInt) {
        return [createApiPropertyAccess("BigInt"), true]
      }
      if (type.flags & ts.TypeFlags.Void) {
        return [createApiPropertyAccess("Void"), true]
      }
      if (type.flags & ts.TypeFlags.Undefined) {
        return [createApiPropertyAccess("Undefined"), true]
      }
      if (type.flags & ts.TypeFlags.Null) {
        return [createApiPropertyAccess("Null"), true]
      }
      if (type.flags & ts.TypeFlags.Never) {
        return [createApiPropertyAccess("Never"), true]
      }
      if (type.flags & ts.TypeFlags.Any) {
        return [createApiPropertyAccess("Any"), true]
      }
      if (type.flags & ts.TypeFlags.Unknown) {
        return [createApiPropertyAccess("Unknown"), true]
      }

      // Handle string/number/boolean literal types
      if (type.flags & ts.TypeFlags.StringLiteral) {
        const literalType = type as ts.StringLiteralType
        return [createApiCall("Literal", [ts.factory.createStringLiteral(literalType.value)]), true]
      }
      if (type.flags & ts.TypeFlags.NumberLiteral) {
        const literalType = type as ts.NumberLiteralType
        return [createApiCall("Literal", [ts.factory.createNumericLiteral(literalType.value)]), true]
      }
      if (type.flags & ts.TypeFlags.BooleanLiteral) {
        const value = (type as any).intrinsicName === "true"
        return [createApiCall("Literal", [value ? ts.factory.createTrue() : ts.factory.createFalse()]), true]
      }

      // Handle union types
      if (typeCheckerUtils.isUnion(type)) {
        return yield* processUnionType(type.types, context)
      }

      // Handle intersection types
      if (type.flags & ts.TypeFlags.Intersection) {
        return yield* processIntersectionType(type as ts.IntersectionType, context)
      }

      // Handle array types
      if (typeChecker.isArrayType(type)) {
        return yield* processArrayType(type, context)
      }

      // Handle tuple types
      if (typeChecker.isTupleType(type)) {
        return yield* processTupleType(type as ts.TupleType, context)
      }

      // Handle object types (interfaces, type literals, etc.)
      if (type.flags & ts.TypeFlags.Object) {
        // Check if it's a special built-in type
        const symbol = type.symbol || type.aliasSymbol
        if (symbol) {
          const typeName = typeChecker.symbolToString(symbol)

          // Handle Date
          if (typeName === "Date") {
            return [createApiPropertyAccess("Date"), false]
          }

          // Handle ReadonlyArray
          if (typeName === "ReadonlyArray" || typeName === "Array") {
            return yield* processArrayType(type, context)
          }
        }

        // Handle object literal types and interfaces
        const objectType = type as ts.ObjectType
        return yield* processObjectType(objectType, context)
      }

      // If we couldn't process the type, fail
      return yield* Nano.fail(
        new UnsupportedTypeError(
          type,
          `Type with flags ${type.flags} is not supported`
        )
      )
    }
  )

/**
 * Process union types as Schema.Union
 */
const processUnionType: (
  types: Array<ts.Type>,
  context: ProcessingContext
) => Nano.Nano<[expr: ts.Expression, skipHoisting: boolean], UnsupportedTypeError, StructuralSchemaGenContext> = Nano
  .fn(
    "StructuralSchemaGen.processUnionType"
  )(
    function*(types, context) {
      const { createApiCall, ts } = yield* Nano.service(StructuralSchemaGenContext)

      // Check if all members are literals - can optimize to single Literal call
      const allLiterals = types.every((t) =>
        (t.flags & ts.TypeFlags.StringLiteral) ||
        (t.flags & ts.TypeFlags.NumberLiteral) ||
        (t.flags & ts.TypeFlags.BooleanLiteral)
      )

      if (allLiterals) {
        const literals: Array<ts.Expression> = yield* Nano.all(
          ...types.map((t) => processType(t, context))
        )
        // Extract literal values from Schema.Literal calls
        const literalValues: Array<ts.Expression> = literals.map((expr: ts.Expression) => {
          if (ts.isCallExpression(expr) && expr.arguments.length > 0) {
            return expr.arguments[0]
          }
          return expr
        }).filter((arg: ts.Expression | undefined): arg is ts.Expression => arg !== undefined)

        return [createApiCall("Literal", literalValues), false]
      }

      // Process each union member
      const members: Array<ts.Expression> = yield* Nano.all(
        ...types.map((t) => processType(t, context))
      )

      if (members.length === 1) {
        return [members[0], false]
      }

      return [createApiCall("Union", members), false]
    }
  )

/**
 * Process intersection types as Schema.extend
 */
const processIntersectionType: (
  type: ts.IntersectionType,
  context: ProcessingContext
) => Nano.Nano<[expr: ts.Expression, skipHoisting: boolean], UnsupportedTypeError, StructuralSchemaGenContext> = Nano
  .fn(
    "StructuralSchemaGen.processIntersectionType"
  )(
    function*(type, context) {
      const { createApiCall, ts } = yield* Nano.service(StructuralSchemaGenContext)

      const [firstSchema, ...otherSchemas]: Array<ts.Expression> = yield* Nano.all(
        ...type.types.map((t) => processType(t, context))
      )

      if (otherSchemas.length === 0) {
        return [firstSchema, false]
      }

      return [
        ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(
            firstSchema,
            "pipe"
          ),
          [],
          otherSchemas.map((schema) => createApiCall("extend", [schema]))
        ),
        false
      ]
    }
  )

/**
 * Process array types as Schema.Array
 */
const processArrayType: (
  type: ts.Type,
  context: ProcessingContext
) => Nano.Nano<[expr: ts.Expression, skipHoisting: boolean], UnsupportedTypeError, StructuralSchemaGenContext> = Nano
  .fn(
    "StructuralSchemaGen.processArrayType"
  )(
    function*(type, context) {
      const { createApiCall, typeChecker, typeCheckerUtils } = yield* Nano.service(StructuralSchemaGenContext)

      // Get the element type
      const typeArgs = typeChecker.getTypeArguments(type as ts.TypeReference)
      if (typeArgs.length === 0) {
        return yield* Nano.fail(new UnsupportedTypeError(type, "Array type has no type arguments"))
      }

      const elementSchema: ts.Expression = yield* processType(typeArgs[0], context)
      const expr = createApiCall("Array", [elementSchema])
      if (typeCheckerUtils.isReadonlyArrayType(type)) return [expr, false]
      return [createApiCall("mutable", [expr]), false]
    }
  )

/**
 * Process tuple types as Schema.Tuple
 */
const processTupleType: (
  type: ts.TupleType,
  context: ProcessingContext
) => Nano.Nano<[expr: ts.Expression, skipHoisting: boolean], UnsupportedTypeError, StructuralSchemaGenContext> = Nano
  .fn(
    "StructuralSchemaGen.processTupleType"
  )(
    function*(type, context) {
      const { createApiCall, typeChecker } = yield* Nano.service(StructuralSchemaGenContext)

      const typeArgs = typeChecker.getTypeArguments(type as ts.TypeReference)
      const elementSchemas: Array<ts.Expression> = yield* Nano.all(
        ...typeArgs.map((t) => processType(t, context))
      )

      return [createApiCall("Tuple", elementSchemas), false]
    }
  )

/**
 * Process object types as Schema.Struct
 */
const processObjectType: (
  type: ts.ObjectType,
  context: ProcessingContext
) => Nano.Nano<[expr: ts.Expression, skipHoisting: boolean], UnsupportedTypeError, StructuralSchemaGenContext> = Nano
  .fn(
    "StructuralSchemaGen.processObjectType"
  )(
    function*(type, context) {
      const {
        createApiCall,
        createApiPropertyAccess,
        program,
        ts,
        typeChecker,
        typeCheckerUtils
      } = yield* Nano
        .service(
          StructuralSchemaGenContext
        )
      let hasRecords = false

      const properties = typeChecker.getPropertiesOfType(type)
      const propertyAssignments: Array<ts.PropertyAssignment> = []

      // Process each property
      for (const property of properties) {
        const propertyName = typeChecker.symbolToString(property)
        const propertyType = typeChecker.getTypeOfSymbol(property)

        // Check if property is optional
        const isOptional = (property.flags & ts.SymbolFlags.Optional) !== 0

        let schemaExpr: ts.Expression | undefined
        if (isOptional) {
          if (program.getCompilerOptions().exactOptionalPropertyTypes) {
            if (typeCheckerUtils.isUnion(propertyType)) {
              const typeWithoutMissing = propertyType.types.filter((t) => !typeCheckerUtils.isMissingIntrinsicType(t))
              const [result, _] = yield* processUnionType(typeWithoutMissing, context)
              schemaExpr = createApiCall("optionalWith", [
                result,
                ts.factory.createObjectLiteralExpression([
                  ts.factory.createPropertyAssignment("exact", ts.factory.createTrue())
                ])
              ])
            }
          } else {
            schemaExpr = yield* processType(propertyType, context)
            schemaExpr = createApiCall("optional", [schemaExpr])
          }
        }
        if (!schemaExpr) {
          schemaExpr = yield* processType(propertyType, context)
        }

        // Create property name - use identifier for valid JS identifiers, string literal otherwise
        const propertyNameNode = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(propertyName)
          ? ts.factory.createIdentifier(propertyName)
          : ts.factory.createStringLiteral(propertyName)

        propertyAssignments.push(
          ts.factory.createPropertyAssignment(
            propertyNameNode,
            schemaExpr
          )
        )
      }

      // Handle index signatures
      const indexInfos = typeChecker.getIndexInfosOfType(type)
      const args: Array<ts.Expression> = [
        ts.factory.createObjectLiteralExpression(propertyAssignments, propertyAssignments.length > 0)
      ]

      for (const indexInfo of indexInfos) {
        hasRecords = true
        const keyType = indexInfo.keyType
        const valueType = indexInfo.type

        const keySchema: ts.Expression = yield* processType(keyType, context)
        const valueSchema: ts.Expression = yield* processType(valueType, context)

        args.push(
          ts.factory.createObjectLiteralExpression([
            ts.factory.createPropertyAssignment("key", keySchema),
            ts.factory.createPropertyAssignment("value", valueSchema)
          ])
        )
      }

      if (!hasRecords && context.hoistName) {
        const ctx = yield* Nano.service(StructuralSchemaGenContext)
        yield* pushHoistedStatement(
          ctx,
          context.hoistName,
          type,
          ts.factory.createClassDeclaration(
            undefined,
            ts.factory.createIdentifier(context.hoistName),
            [],
            [ts.factory.createHeritageClause(
              ts.SyntaxKind.ExtendsKeyword,
              [
                ts.factory.createExpressionWithTypeArguments(
                  ts.factory.createCallExpression(
                    ts.factory.createCallExpression(
                      createApiPropertyAccess("Class"),
                      [ts.factory.createTypeReferenceNode(
                        context.hoistName
                      )],
                      [ts.factory.createStringLiteral(context.hoistName)]
                    ),
                    [],
                    args
                  ),
                  []
                )
              ]
            )],
            []
          ),
          () => ts.factory.createIdentifier(context.hoistName!)
        )
        return [ctx.hoistedSchemas.get(type)!(), true]
      }

      return [createApiCall("Struct", args), propertyAssignments.length === 0]
    }
  )

export const findNodeToProcess = Nano.fn("StructuralSchemaGen.findNodeToProcess")(
  function*(sourceFile: ts.SourceFile, textRange: ts.TextRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    return pipe(
      tsUtils.getAncestorNodesInRange(sourceFile, textRange),
      Array.filter((node) => ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)),
      Array.filter((node) => tsUtils.isNodeInRange(textRange)(node.name)),
      Array.filter((node) => (node.typeParameters || []).length === 0),
      Array.map((node) => ({
        node,
        identifier: node.name,
        type: typeCheckerUtils.getTypeAtLocation(node.name)!,
        isExported: node.modifiers ? (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0 : false
      })),
      Array.filter(({ type }) => !!type),
      Array.head
    )
  }
)

export const process = Nano.fn("StructuralSchemaGen.process")(
  function*(
    sourceFile: ts.SourceFile,
    scope: ts.Node,
    typeMap: Map<string, ts.Type>,
    isExported: boolean,
    handleCodegeneratedComments: boolean
  ) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const schemaIdentifier =
      tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(sourceFile, "effect", "Schema") || "Schema"
    const ctx = yield* makeStructuralSchemaGenContext(sourceFile, schemaIdentifier)

    for (const [name, type] of typeMap.entries()) {
      ctx.nameToType.set(name, type)
    }

    if (handleCodegeneratedComments) {
      for (const declaration of sourceFile.statements) {
        const nodeText = sourceFile.text.slice(declaration.pos, declaration.end)
        if (!nodeText.toLowerCase().includes("@effect-schema-codegenerated")) continue
        const interleavingRange = ctx.rangesToDelete.find((range) =>
          range.pos < declaration.end && range.end > declaration.pos
        )
        if (interleavingRange) {
          interleavingRange.pos = Math.min(interleavingRange.pos, declaration.pos)
          interleavingRange.end = Math.max(interleavingRange.end, declaration.end)
        } else {
          ctx.rangesToDelete.push({
            pos: declaration.pos,
            end: declaration.end
          })
        }
      }
    }

    for (const symbol of typeChecker.getSymbolsInScope(scope, ts.SymbolFlags.Value)) {
      const name = typeChecker.symbolToString(symbol)
      ctx.usedGlobalIdentifiers.set(name, 1)
      const type = typeChecker.getTypeOfSymbolAtLocation(symbol, sourceFile)
      if (type) {
        const schemaType = yield* pipe(
          typeParser.effectSchemaType(type, scope),
          Nano.orElse(() => Nano.void_)
        )
        if (schemaType) {
          ctx.hoistedSchemas.set(
            schemaType.A,
            () => {
              const expression = typeChecker.symbolToExpression(
                symbol,
                ts.SymbolFlags.Value,
                scope,
                ts.NodeBuilderFlags.NoTruncation
              )
              if (expression) {
                return expression
              }
              return ts.factory.createIdentifier(name)
            }
          )
        }
      }
    }

    // Generate the schema expression from the type
    const results = yield* pipe(
      Nano.all(
        ...Array.fromIterable(ctx.nameToType.entries()).map(([name, type]) =>
          pipe(
            processType(type),
            Nano.orElse((error) =>
              Nano.succeed(ts.addSyntheticLeadingComment(
                ts.factory.createIdentifier(""),
                ts.SyntaxKind.MultiLineCommentTrivia,
                " " + String(error) + " ",
                true
              ))
            ),
            Nano.map((_) => ({ requestedName: name, type, result: _ }))
          )
        )
      ),
      Nano.provideService(StructuralSchemaGenContext, ctx)
    )

    // Add variable statements for types that were not hoisted
    for (const { requestedName, result, type } of results) {
      const statementIndex = ctx.typeToStatementIndex.get(type)
      if (statementIndex !== undefined) continue
      ctx.schemaStatements.push(ts.factory.createVariableStatement(
        [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        ts.factory.createVariableDeclarationList(
          [ts.factory.createVariableDeclaration(
            ts.factory.createIdentifier(requestedName),
            undefined,
            undefined,
            result
          )],
          ts.NodeFlags.Const
        )
      ))
      ctx.typeToStatementIndex.set(type, ctx.schemaStatements.length - 1)
    }

    // Update to add an export keyword to the variable statements
    if (isExported) {
      const statementsToExport = pipe(
        Array.fromIterable(ctx.nameToType),
        Array.map(([_, type]) => ctx.typeToStatementIndex.get(type)),
        Array.filter((index) => index !== undefined),
        Array.dedupe
      )
      for (let i = 0; i < ctx.schemaStatements.length; i++) {
        if (!statementsToExport.includes(i)) continue
        const statement = ctx.schemaStatements[i]
        if (ts.isVariableStatement(statement)) {
          ctx.schemaStatements[i] = ts.factory.updateVariableStatement(
            statement,
            ts.factory.createModifiersFromModifierFlags(ts.ModifierFlags.Export),
            statement.declarationList
          )
        } else if (ts.isClassDeclaration(statement)) {
          ctx.schemaStatements[i] = ts.factory.updateClassDeclaration(
            statement,
            ts.factory.createModifiersFromModifierFlags(ts.ModifierFlags.Export),
            statement.name,
            statement.typeParameters,
            statement.heritageClauses,
            statement.members
          )
        }
      }
    }

    if (handleCodegeneratedComments) {
      for (let i = 0; i < ctx.schemaStatements.length; i++) {
        const statement = ctx.schemaStatements[i]
        ctx.schemaStatements[i] = ts.addSyntheticLeadingComment(
          statement,
          ts.SyntaxKind.SingleLineCommentTrivia,
          " @effect-schema-codegenerated: This schema will be re-generated by the effect-schema-codegens command, remove this comment to disable re-generation.",
          true
        )
      }
    }

    return ctx
  }
)

export const applyAtNode = Nano.fn("StructuralSchemaGen.applyAtNode")(
  function*(
    sourceFile: ts.SourceFile,
    node: ts.TypeAliasDeclaration | ts.InterfaceDeclaration,
    identifier: ts.Identifier,
    type: ts.Type,
    isExported: boolean
  ) {
    const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const ctx = yield* process(sourceFile, node, new Map([[ts.idText(identifier), type]]), isExported, false)
    for (const statement of ctx.schemaStatements) {
      changeTracker.insertNodeAt(sourceFile, node.pos, statement, { prefix: "\n", suffix: "\n" })
    }
  }
)
