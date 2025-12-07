import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import type ts from "typescript/lib/tsserverlibrary"
import * as Nano from "../core/Nano"
import * as TypeCheckerApi from "../core/TypeCheckerApi"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils"
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
  typeChecker: TypeCheckerApi.TypeCheckerApi
  typeCheckerUtils: TypeCheckerUtils.TypeCheckerUtils
  sourceFile: ts.SourceFile
  createApiPropertyAccess(apiName: string): ts.PropertyAccessExpression
  createApiCall(apiName: string, args: Array<ts.Expression>): ts.CallExpression
}

const StructuralSchemaGenContext = Nano.Tag<StructuralSchemaGenContext>("StructuralSchemaGenContext")

export const makeStructuralSchemaGenContext = Nano.fn("StructuralSchemaGen.makeContext")(
  function*(sourceFile: ts.SourceFile, schemaIdentifier?: string) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    const effectSchemaIdentifier = schemaIdentifier || "Schema"

    return {
      ts,
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
        )
    } satisfies StructuralSchemaGenContext
  }
)

/**
 * Processing context for tracking state during type traversal
 */
interface ProcessingContext {
  depth: number
  maxDepth: number
  visitedTypes: WeakMap<ts.Type, ts.Expression>
}

const createProcessingContext = (maxDepth: number = 50): ProcessingContext => ({
  depth: 0,
  maxDepth,
  visitedTypes: new WeakMap()
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

    // NOTE: Caching disabled because AST nodes cannot be reused in multiple parent positions
    // When processing Array<string> twice, both would try to use the same Schema.String node
    // which causes "Debug Failure" during printing

    // Check depth limit
    if (processingContext.depth >= processingContext.maxDepth) {
      return yield* Nano.fail(new UnsupportedTypeError(type, "Maximum depth exceeded"))
    }

    // Create nested context for recursive processing
    const nestedContext: ProcessingContext = {
      ...processingContext,
      depth: processingContext.depth + 1
    }

    // Process the type and get the schema expression
    const schemaExpr: ts.Expression = yield* processTypeImpl(type, nestedContext)

    return schemaExpr
  }
)

/**
 * Core implementation that determines type kind and delegates to specific handlers
 */
const processTypeImpl: (
  type: ts.Type,
  context: ProcessingContext
) => Nano.Nano<ts.Expression, UnsupportedTypeError, StructuralSchemaGenContext> = Nano.fn(
  "StructuralSchemaGen.processTypeImpl"
)(
  function*(type, context) {
    const { createApiCall, createApiPropertyAccess, ts, typeChecker, typeCheckerUtils } = yield* Nano.service(
      StructuralSchemaGenContext
    )

    // Handle primitive types
    if (type.flags & ts.TypeFlags.String) {
      return createApiPropertyAccess("String")
    }
    if (type.flags & ts.TypeFlags.Number) {
      return createApiPropertyAccess("Number")
    }
    if (type.flags & ts.TypeFlags.Boolean) {
      return createApiPropertyAccess("Boolean")
    }
    if (type.flags & ts.TypeFlags.BigInt) {
      return createApiPropertyAccess("BigInt")
    }
    if (type.flags & ts.TypeFlags.Void) {
      return createApiPropertyAccess("Void")
    }
    if (type.flags & ts.TypeFlags.Undefined) {
      return createApiPropertyAccess("Undefined")
    }
    if (type.flags & ts.TypeFlags.Null) {
      return createApiPropertyAccess("Null")
    }
    if (type.flags & ts.TypeFlags.Never) {
      return createApiPropertyAccess("Never")
    }
    if (type.flags & ts.TypeFlags.Any) {
      return createApiPropertyAccess("Any")
    }
    if (type.flags & ts.TypeFlags.Unknown) {
      return createApiPropertyAccess("Unknown")
    }

    // Handle string/number/boolean literal types
    if (type.flags & ts.TypeFlags.StringLiteral) {
      const literalType = type as ts.StringLiteralType
      return createApiCall("Literal", [ts.factory.createStringLiteral(literalType.value)])
    }
    if (type.flags & ts.TypeFlags.NumberLiteral) {
      const literalType = type as ts.NumberLiteralType
      return createApiCall("Literal", [ts.factory.createNumericLiteral(literalType.value)])
    }
    if (type.flags & ts.TypeFlags.BooleanLiteral) {
      const value = (type as any).intrinsicName === "true"
      return createApiCall("Literal", [value ? ts.factory.createTrue() : ts.factory.createFalse()])
    }

    // Handle union types
    if (typeCheckerUtils.isUnion(type)) {
      return yield* processUnionType(type, context)
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
          return createApiPropertyAccess("Date")
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
  type: ts.UnionType,
  context: ProcessingContext
) => Nano.Nano<ts.Expression, UnsupportedTypeError, StructuralSchemaGenContext> = Nano.fn(
  "StructuralSchemaGen.processUnionType"
)(
  function*(type, context) {
    const { createApiCall, ts } = yield* Nano.service(StructuralSchemaGenContext)

    // Check if all members are literals - can optimize to single Literal call
    const allLiterals = type.types.every((t) =>
      (t.flags & ts.TypeFlags.StringLiteral) ||
      (t.flags & ts.TypeFlags.NumberLiteral) ||
      (t.flags & ts.TypeFlags.BooleanLiteral)
    )

    if (allLiterals) {
      const literals: Array<ts.Expression> = yield* Nano.all(
        ...type.types.map((t) => processType(t, context))
      )
      // Extract literal values from Schema.Literal calls
      const literalValues: Array<ts.Expression> = literals.map((expr: ts.Expression) => {
        if (ts.isCallExpression(expr) && expr.arguments.length > 0) {
          return expr.arguments[0]
        }
        return expr
      }).filter((arg: ts.Expression | undefined): arg is ts.Expression => arg !== undefined)

      return createApiCall("Literal", literalValues)
    }

    // Process each union member
    const members: Array<ts.Expression> = yield* Nano.all(
      ...type.types.map((t) => processType(t, context))
    )

    return createApiCall("Union", members)
  }
)

/**
 * Process intersection types as Schema.extend
 */
const processIntersectionType: (
  type: ts.IntersectionType,
  context: ProcessingContext
) => Nano.Nano<ts.Expression, UnsupportedTypeError, StructuralSchemaGenContext> = Nano.fn(
  "StructuralSchemaGen.processIntersectionType"
)(
  function*(type, context) {
    const { createApiCall, ts } = yield* Nano.service(StructuralSchemaGenContext)

    const [firstSchema, ...otherSchemas]: Array<ts.Expression> = yield* Nano.all(
      ...type.types.map((t) => processType(t, context))
    )

    if (otherSchemas.length === 0) {
      return firstSchema
    }

    return ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        firstSchema,
        "pipe"
      ),
      [],
      otherSchemas.map((schema) => createApiCall("extend", [schema]))
    )
  }
)

/**
 * Process array types as Schema.Array
 */
const processArrayType: (
  type: ts.Type,
  context: ProcessingContext
) => Nano.Nano<ts.Expression, UnsupportedTypeError, StructuralSchemaGenContext> = Nano.fn(
  "StructuralSchemaGen.processArrayType"
)(
  function*(type, context) {
    const { createApiCall, typeChecker } = yield* Nano.service(StructuralSchemaGenContext)

    // Get the element type
    const typeArgs = typeChecker.getTypeArguments(type as ts.TypeReference)
    if (typeArgs.length === 0) {
      return yield* Nano.fail(new UnsupportedTypeError(type, "Array type has no type arguments"))
    }

    const elementSchema: ts.Expression = yield* processType(typeArgs[0], context)
    return createApiCall("Array", [elementSchema])
  }
)

/**
 * Process tuple types as Schema.Tuple
 */
const processTupleType: (
  type: ts.TupleType,
  context: ProcessingContext
) => Nano.Nano<ts.Expression, UnsupportedTypeError, StructuralSchemaGenContext> = Nano.fn(
  "StructuralSchemaGen.processTupleType"
)(
  function*(type, context) {
    const { createApiCall, typeChecker } = yield* Nano.service(StructuralSchemaGenContext)

    const typeArgs = typeChecker.getTypeArguments(type as ts.TypeReference)
    const elementSchemas: Array<ts.Expression> = yield* Nano.all(
      ...typeArgs.map((t) => processType(t, context))
    )

    return createApiCall("Tuple", elementSchemas)
  }
)

/**
 * Process object types as Schema.Struct
 */
const processObjectType: (
  type: ts.ObjectType,
  context: ProcessingContext
) => Nano.Nano<ts.Expression, UnsupportedTypeError, StructuralSchemaGenContext> = Nano.fn(
  "StructuralSchemaGen.processObjectType"
)(
  function*(type, context) {
    const { createApiCall, ts, typeChecker } = yield* Nano.service(StructuralSchemaGenContext)

    const properties = typeChecker.getPropertiesOfType(type)
    const propertyAssignments: Array<ts.PropertyAssignment> = []

    // Process each property
    for (const property of properties) {
      const propertyName = typeChecker.symbolToString(property)
      const propertyType = typeChecker.getTypeOfSymbol(property)
      const propertySchema: ts.Expression = yield* processType(propertyType, context)

      // Check if property is optional
      const isOptional = (property.flags & ts.SymbolFlags.Optional) !== 0

      const schemaExpr = isOptional
        ? createApiCall("optional", [propertySchema])
        : propertySchema

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

    return createApiCall("Struct", args)
  }
)

/**
 * Main entry point: Process a type and return the Schema expression
 */
const process = Nano.fn("StructuralSchemaGen.generateSchemaFromType")(
  function*(sourceFile: ts.SourceFile, type: ts.Type, _atLocation: ts.Node) {
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const schemaIdentifier =
      tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(sourceFile, "effect", "Schema") || "Schema"
    const ctx = yield* makeStructuralSchemaGenContext(sourceFile, schemaIdentifier)
    return yield* pipe(
      processType(type),
      Nano.provideService(StructuralSchemaGenContext, ctx)
    )
  }
)

export const findNodeToProcess = Nano.fn("StructuralSchemaGen.findNodeToProcess")(
  function*(sourceFile: ts.SourceFile, textRange: ts.TextRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    return pipe(
      tsUtils.getAncestorNodesInRange(sourceFile, textRange),
      Array.filter((node) => ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)),
      Array.filter((node) => tsUtils.isNodeInRange(textRange)(node.name)),
      Array.filter((node) => (node.typeParameters || []).length === 0),
      Array.map((node) => ({ node, identifier: node.name, type: typeChecker.getTypeAtLocation(node.name) })),
      Array.filter(({ type }) => !!type),
      Array.head
    )
  }
)

export const applyAtNode = Nano.fn("StructuralSchemaGen.applyAtNode")(
  function*(
    sourceFile: ts.SourceFile,
    node: ts.TypeAliasDeclaration | ts.InterfaceDeclaration,
    identifier: ts.Identifier,
    type: ts.Type,
    _preferClass: boolean
  ) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

    // Generate the schema expression from the type
    const schemaExpr = yield* pipe(
      process(sourceFile, type, identifier),
      Nano.orElse((error) =>
        Nano.succeed(ts.addSyntheticLeadingComment(
          ts.factory.createIdentifier(""),
          ts.SyntaxKind.MultiLineCommentTrivia,
          " " + String(error) + " ",
          true
        ))
      )
    )

    // Wrap in a variable declaration statement
    const schemaName = `${identifier.text}Schema`
    const newNode = ts.factory.createVariableStatement(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createVariableDeclarationList(
        [ts.factory.createVariableDeclaration(
          ts.factory.createIdentifier(schemaName),
          undefined,
          undefined,
          schemaExpr
        )],
        ts.NodeFlags.Const
      )
    )

    changeTracker.insertNodeBefore(sourceFile, node, newNode, true, {
      leadingTriviaOption: ts.textChanges.LeadingTriviaOption.StartLine
    })
  }
)
