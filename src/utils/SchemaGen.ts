import * as Array from "effect/Array"
import { identity, pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as Nano from "../core/Nano"
import * as TypeCheckerApi from "../core/TypeCheckerApi"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

export class TypeParametersNotSupportedError {
  readonly _tag = "@effect/language-service/TypeParametersNotSupportedError"
  constructor(
    readonly node: ts.Node
  ) {
  }

  toString() {
    return `Could not process types with type parameters.`
  }
}

export class OnlyLiteralPropertiesSupportedError {
  readonly _tag = "@effect/language-service/OnlyLiteralPropertiesSupportedError"
  constructor(
    readonly node: ts.Node
  ) {
  }

  toString() {
    return `Could not process ${this.node.getText()} as only literal properties are supported.`
  }
}

export class RequiredExplicitTypesError {
  readonly _tag = "@effect/language-service/RequiredExplicitTypesError"
  constructor(
    readonly node: ts.Node
  ) {
  }
  toString() {
    return `Could not process ${this.node.getText()} as only explicit types are supported.`
  }
}

export class IndexSignatureWithMoreThanOneParameterError {
  readonly _tag = "@effect/language-service/IndexSignatureWithMoreThanOneParameterError"
  constructor(
    readonly node: ts.Node
  ) {
  }
  toString() {
    return `Could not process ${this.node.getText()} as only index signatures with one parameter are supported.`
  }
}

interface SchemaGenContext {
  sourceFile: ts.SourceFile
  ts: TypeScriptApi.TypeScriptApi
  createApiPropertyAccess(apiName: string): ts.PropertyAccessExpression
  createApiCall(apiName: string, args: Array<ts.Expression>): ts.CallExpression
  entityNameToDataTypeName(name: ts.EntityName): Option.Option<string>
}
const SchemaGenContext = Nano.Tag<SchemaGenContext>("SchemaGenContext")

export const makeSchemaGenContext = Nano.fn("SchemaGen.makeSchemaGenContext")(function*(
  sourceFile: ts.SourceFile
) {
  const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

  const effectSchemaIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
    sourceFile,
    "effect",
    "Schema"
  ) || "Schema"

  const moduleToImportedName: Record<string, string> = {}
  for (const moduleName of ["Option", "Either", "Chunk", "Duration"]) {
    const importedName = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(sourceFile, "effect", moduleName)
    if (importedName) moduleToImportedName[moduleName] = importedName
  }

  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

  return {
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
    entityNameToDataTypeName: (name) => {
      if (ts.isIdentifier(name)) {
        switch (name.text) {
          case "Date":
          case "Pick":
          case "Omit":
          case "Record":
            return Option.some(name.text)
          case "ReadonlyArray":
          case "Array":
            return Option.some("Array")
        }
        return Option.none()
      }
      if (!ts.isIdentifier(name.left)) return Option.none()
      for (const moduleName in moduleToImportedName) {
        if (name.left.text === moduleToImportedName[moduleName] && name.right.text === moduleName) {
          return Option.some(moduleName)
        }
      }
      return Option.none()
    },
    ts
  } satisfies SchemaGenContext
})

const typeEntityNameToNode: (
  entityName: ts.EntityName
) => Nano.Nano<ts.Identifier | ts.PropertyAccessExpression, never, SchemaGenContext> = Nano.fn(
  "SchemaGen.typeEntityNameToNode"
)(
  function*(entityName: ts.EntityName) {
    const { ts } = yield* Nano.service(SchemaGenContext)
    if (ts.isIdentifier(entityName)) return ts.factory.createIdentifier(entityName.text)
    const left = yield* typeEntityNameToNode(entityName.left)
    return ts.factory.createPropertyAccessExpression(
      left,
      ts.factory.createIdentifier(entityName.right.text)
    )
  }
)

const parseAllLiterals: (
  node: ts.TypeNode
) => Nano.Nano<
  Array<ts.StringLiteral | ts.NumericLiteral | ts.NullLiteral | ts.TrueLiteral | ts.FalseLiteral>,
  ts.TypeNode,
  SchemaGenContext
> = Nano
  .fn(
    "SchemaGen.parseAllLiterals"
  )(
    function*(node: ts.TypeNode) {
      const { ts } = yield* Nano.service(SchemaGenContext)
      if (ts.isLiteralTypeNode(node)) {
        switch (node.literal.kind) {
          case ts.SyntaxKind.StringLiteral:
            return [ts.factory.createStringLiteral(node.literal.text)]
          case ts.SyntaxKind.NumericLiteral:
            return [ts.factory.createNumericLiteral(node.literal.text)]
          case ts.SyntaxKind.TrueKeyword:
            return [ts.factory.createTrue()]
          case ts.SyntaxKind.FalseKeyword:
            return [ts.factory.createFalse()]
        }
      }
      if (ts.isUnionTypeNode(node)) {
        return Array.flatten(yield* Nano.all(...node.types.map((_) => parseAllLiterals(_))))
      }
      if (ts.isParenthesizedTypeNode(node)) {
        return yield* parseAllLiterals(node.type)
      }
      return yield* Nano.fail(node)
    }
  )

const createUnsupportedNodeComment = (
  ts: TypeScriptApi.TypeScriptApi,
  sourceFile: ts.SourceFile,
  node: ts.Node
) =>
  ts.addSyntheticTrailingComment(
    ts.factory.createIdentifier(""),
    ts.SyntaxKind.MultiLineCommentTrivia,
    " Not supported conversion: " + node.getText(sourceFile) + " "
  )

export const processNode = (
  node: ts.Node,
  isVirtualTypeNode: boolean
): Nano.Nano<
  ts.Expression,
  | RequiredExplicitTypesError
  | TypeParametersNotSupportedError
  | OnlyLiteralPropertiesSupportedError
  | IndexSignatureWithMoreThanOneParameterError,
  TypeScriptApi.TypeScriptApi | TypeCheckerApi.TypeCheckerApi | SchemaGenContext
> =>
  Nano.gen(function*() {
    const { createApiCall, createApiPropertyAccess, entityNameToDataTypeName, sourceFile, ts } = yield* Nano.service(
      SchemaGenContext
    )
    // string | number | boolean | undefined | void | never
    switch (node.kind) {
      case ts.SyntaxKind.AnyKeyword:
        return createApiPropertyAccess("Any")
      case ts.SyntaxKind.NeverKeyword:
        return createApiPropertyAccess("Never")
      case ts.SyntaxKind.UnknownKeyword:
        return createApiPropertyAccess("Unknown")
      case ts.SyntaxKind.VoidKeyword:
        return createApiPropertyAccess("Void")
      case ts.SyntaxKind.NullKeyword:
        return createApiPropertyAccess("Null")
      case ts.SyntaxKind.UndefinedKeyword:
        return createApiPropertyAccess("Undefined")
      case ts.SyntaxKind.StringKeyword:
        return createApiPropertyAccess("String")
      case ts.SyntaxKind.NumberKeyword:
        return createApiPropertyAccess("Number")
      case ts.SyntaxKind.BooleanKeyword:
        return createApiPropertyAccess("Boolean")
      case ts.SyntaxKind.BigIntKeyword:
        return createApiPropertyAccess("BigInt")
    }
    // null and other literals
    if (ts.isLiteralTypeNode(node)) {
      if (node.literal.kind === ts.SyntaxKind.NullKeyword) return createApiPropertyAccess("Null")
      const literalMembers = yield* Nano.option(parseAllLiterals(node))
      if (Option.isSome(literalMembers)) return createApiCall("Literal", literalMembers.value)
    }
    // A | B
    if (ts.isUnionTypeNode(node)) {
      // "a" | "b" can be optimized into a single Schema.Literal("a", "b")
      const allLiterals = yield* Nano.option(parseAllLiterals(node))
      if (Option.isSome(allLiterals)) return createApiCall("Literal", allLiterals.value)
      // regular union
      const members = yield* Nano.all(...node.types.map((_) => processNode(_, isVirtualTypeNode)))
      return createApiCall("Union", members)
    }
    // {a: 1} & {b: 2} & {c: 3}
    if (ts.isIntersectionTypeNode(node)) {
      const [firstSchema, ...otherSchemas] = yield* Nano.all(
        ...node.types.map((_) => processNode(_, isVirtualTypeNode))
      )
      if (otherSchemas.length === 0) return firstSchema
      return ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
          firstSchema,
          "pipe"
        ),
        [],
        otherSchemas.map((_) => createApiCall("extend", [_]))
      )
    }
    // keyof A
    if (ts.isTypeOperatorNode(node)) {
      if (node.operator === ts.SyntaxKind.KeyOfKeyword) {
        return createApiCall("keyof", [yield* processNode(node.type, isVirtualTypeNode)])
      } else if (node.operator === ts.SyntaxKind.ReadonlyKeyword) {
        return yield* processNode(node.type, isVirtualTypeNode)
      }
    }
    // string[]
    if (ts.isArrayTypeNode(node)) {
      const typeSchema = yield* processNode(node.elementType, isVirtualTypeNode)
      return createApiCall("Array", [typeSchema])
    }
    // { a: string, b: boolean }
    if (ts.isTypeLiteralNode(node)) {
      const { properties, records } = yield* processMembers(node.members, isVirtualTypeNode)

      return createApiCall(
        "Struct",
        [ts.factory.createObjectLiteralExpression(properties, true)].concat(records)
      )
    }
    // parenthesided (A)
    if (ts.isParenthesizedTypeNode(node)) {
      return yield* processNode(node.type, isVirtualTypeNode)
    }
    // typeof A
    if (ts.isTypeQueryNode(node)) {
      const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
      const type = typeChecker.getTypeAtLocation(node.exprName)
      const typeNode = typeChecker.typeToTypeNode(type, undefined, ts.NodeBuilderFlags.NoTruncation)
      if (typeNode) return yield* processNode(typeNode, true)
    }
    // special pattern (typeof A)[keyof typeof A]
    if (
      !isVirtualTypeNode &&
      ts.isIndexedAccessTypeNode(node) && ts.isParenthesizedTypeNode(node.objectType) &&
      ts.isTypeQueryNode(node.objectType.type) && ts.isTypeOperatorNode(node.indexType) &&
      node.indexType.operator === ts.SyntaxKind.KeyOfKeyword && ts.isTypeQueryNode(node.indexType.type) &&
      node.indexType.type.exprName.getText().trim() === node.objectType.type.exprName.getText().trim()
    ) {
      const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
      const type = typeChecker.getTypeAtLocation(node)
      const typeNode = typeChecker.typeToTypeNode(type, undefined, ts.NodeBuilderFlags.NoTruncation)
      if (typeNode) return yield* processNode(typeNode, true)
    }
    // type reference
    if (ts.isTypeReferenceNode(node)) {
      const parsedName = entityNameToDataTypeName(node.typeName)
      if (Option.isSome(parsedName)) {
        switch (parsedName.value) {
          case "Duration":
          case "Date":
            return createApiPropertyAccess(parsedName.value)
          case "Option":
          case "Chunk":
          case "Array": {
            const elements = yield* Nano.all(
              ...(node.typeArguments
                ? node.typeArguments.map((_) => processNode(_, isVirtualTypeNode))
                : [])
            )
            return createApiCall(parsedName.value, elements)
          }
          case "Record": {
            const elements = yield* Nano.all(
              ...(node.typeArguments
                ? node.typeArguments.map((_) => processNode(_, isVirtualTypeNode))
                : [])
            )
            if (elements.length >= 2) {
              return createApiCall(parsedName.value, [
                ts.factory.createObjectLiteralExpression([
                  ts.factory.createPropertyAssignment("key", elements[0]),
                  ts.factory.createPropertyAssignment("value", elements[1])
                ])
              ])
            }
            return createUnsupportedNodeComment(ts, sourceFile, node)
          }
          case "Either": {
            const elements = yield* Nano.all(
              ...(node.typeArguments
                ? node.typeArguments.map((_) => processNode(_, isVirtualTypeNode))
                : [])
            )
            if (elements.length >= 2) {
              return createApiCall(parsedName.value, [
                ts.factory.createObjectLiteralExpression([
                  ts.factory.createPropertyAssignment("right", elements[0]),
                  ts.factory.createPropertyAssignment("left", elements[1])
                ])
              ])
            }
            return createUnsupportedNodeComment(ts, sourceFile, node)
          }
          case "Pick":
          case "Omit": {
            const typeArguments = Array.fromIterable(node.typeArguments || [])
            if (typeArguments.length !== 2) {
              return createUnsupportedNodeComment(ts, sourceFile, node)
            }
            const baseType = yield* processNode(typeArguments[0], isVirtualTypeNode)
            const stringLiteralArguments = yield* Nano.option(parseAllLiterals(typeArguments[1]))

            if (Option.isNone(stringLiteralArguments)) {
              return createUnsupportedNodeComment(ts, sourceFile, node)
            }
            return ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                baseType,
                "pipe"
              ),
              [],
              [createApiCall(parsedName.value.toLowerCase(), stringLiteralArguments.value)]
            )
          }
        }
      }
    }
    // type reference
    if (ts.isTypeReferenceNode(node)) {
      if (!(node.typeArguments && node.typeArguments.length > 0)) {
        return yield* typeEntityNameToNode(node.typeName)
      }
    }

    // wtf
    return createUnsupportedNodeComment(ts, sourceFile, node)
  })

const processMembers = Nano.fn(
  "SchemaGen.processMembers"
)(
  function*(members: ts.NodeArray<ts.TypeElement>, isVirtualTypeNode: boolean) {
    const { createApiCall, ts } = yield* Nano.service(
      SchemaGenContext
    )

    const properties: Array<ts.PropertyAssignment> = []
    for (const propertySignature of members.filter(ts.isPropertySignature)) {
      const name = propertySignature.name
      if (!(ts.isIdentifier(name) || ts.isStringLiteral(name))) {
        return yield* Nano.fail(new OnlyLiteralPropertiesSupportedError(propertySignature))
      }
      if (!propertySignature.type) {
        return yield* Nano.fail(new RequiredExplicitTypesError(propertySignature))
      }
      const propertyAssignment = pipe(
        yield* processNode(propertySignature.type, isVirtualTypeNode),
        propertySignature.questionToken ? (_) => createApiCall("optional", [_]) : identity,
        (_) => ts.factory.createPropertyAssignment(name, _)
      )

      properties.push(propertyAssignment)
    }

    const records: Array<ts.ObjectLiteralExpression> = []
    for (const indexSignature of members.filter(ts.isIndexSignatureDeclaration)) {
      if (indexSignature.parameters.length !== 1) {
        return yield* Nano.fail(new IndexSignatureWithMoreThanOneParameterError(indexSignature))
      }
      const parameter = indexSignature.parameters[0]
      if (!parameter.type) return yield* Nano.fail(new RequiredExplicitTypesError(parameter))
      const parameterType = parameter.type
      const key = yield* processNode(parameterType, isVirtualTypeNode)
      const value = yield* processNode(indexSignature.type, isVirtualTypeNode)
      records.push(
        ts.factory.createObjectLiteralExpression([
          ts.factory.createPropertyAssignment("key", key),
          ts.factory.createPropertyAssignment("value", value)
        ])
      )
    }

    return { properties, records }
  }
)

const processInterfaceDeclaration = Nano.fn("SchemaGen.processInterfaceDeclaration")(
  function*(node: ts.InterfaceDeclaration, preferClass: boolean) {
    if (node.typeParameters && node.typeParameters.length > 0) {
      return yield* Nano.fail(new TypeParametersNotSupportedError(node))
    }
    const { createApiCall, ts } = yield* Nano.service(
      SchemaGenContext
    )

    const { properties, records } = yield* processMembers(node.members, false)

    if (preferClass && records.length === 0) {
      return yield* createExportSchemaClassDeclaration(node.name.text, properties)
    }

    const schemaStruct = createApiCall(
      "Struct",
      [ts.factory.createObjectLiteralExpression(properties, true)].concat(records)
    )

    return yield* createExportVariableDeclaration(node.name.text, schemaStruct)
  }
)

const processTypeAliasDeclaration = Nano.fn("SchemaGen.processInterfaceDeclaration")(
  function*(node: ts.TypeAliasDeclaration, preferClass: boolean) {
    const { ts } = yield* Nano.service(SchemaGenContext)

    if (node.typeParameters && node.typeParameters.length > 0) {
      return yield* Nano.fail(new TypeParametersNotSupportedError(node))
    }

    if (preferClass && ts.isTypeLiteralNode(node.type)) {
      const { properties, records } = yield* processMembers(node.type.members, false)
      if (records.length === 0) {
        return yield* createExportSchemaClassDeclaration(node.name.text, properties)
      }
    }

    const effectSchema = yield* processNode(node.type, false)

    return yield* createExportVariableDeclaration(node.name.text, effectSchema)
  }
)

const createExportVariableDeclaration = Nano.fn("SchemaGen.createExportVariableDeclaration")(
  function*(
    name: string,
    initializer: ts.Expression
  ) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    return ts.factory.createVariableStatement(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createVariableDeclarationList([
        ts.factory.createVariableDeclaration(
          ts.factory.createIdentifier(name),
          undefined,
          undefined,
          initializer
        )
      ], ts.NodeFlags.Const)
    )
  }
)

const createExportSchemaClassDeclaration = Nano.fn("SchemaGen.createExportSchemaClassDeclaration")(
  function*(
    name: string,
    members: Array<ts.PropertyAssignment>
  ) {
    const { createApiPropertyAccess } = yield* Nano.service(SchemaGenContext)
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    return ts.factory.createClassDeclaration(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(name),
      [],
      [ts.factory.createHeritageClause(
        ts.SyntaxKind.ExtendsKeyword,
        [
          ts.factory.createExpressionWithTypeArguments(
            ts.factory.createCallExpression(
              ts.factory.createCallExpression(
                createApiPropertyAccess("Class"),
                [ts.factory.createTypeReferenceNode(
                  name
                )],
                [ts.factory.createStringLiteral(name)]
              ),
              [],
              [ts.factory.createObjectLiteralExpression(
                members,
                true
              )]
            ),
            []
          )
        ]
      )],
      []
    )
  }
)

export const process = Nano.fn("SchemaGen.process")(
  function*(
    sourceFile: ts.SourceFile,
    node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
    preferClass: boolean
  ) {
    const ctx = yield* makeSchemaGenContext(sourceFile)
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    return yield* pipe(
      ts.isInterfaceDeclaration(node)
        ? processInterfaceDeclaration(node, preferClass)
        : processTypeAliasDeclaration(node, preferClass),
      Nano.provideService(SchemaGenContext, ctx)
    )
  }
)

export const findNodeToProcess = Nano.fn("SchemaGen.findNodeToProcess")(
  function*(sourceFile: ts.SourceFile, textRange: ts.TextRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    return pipe(
      tsUtils.getAncestorNodesInRange(sourceFile, textRange),
      Array.filter((node) => ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)),
      Array.filter((node) => tsUtils.isNodeInRange(textRange)(node.name)),
      Array.filter((node) => (node.typeParameters || []).length === 0),
      Array.head
    )
  }
)

export const applyAtNode = Nano.fn("SchemaGen.applyAtNode")(
  function*(
    sourceFile: ts.SourceFile,
    node: ts.TypeAliasDeclaration | ts.InterfaceDeclaration,
    preferClass: boolean
  ) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
    const newNode = yield* pipe(
      process(sourceFile, node, preferClass),
      Nano.orElse((error) =>
        Nano.succeed(ts.addSyntheticLeadingComment(
          ts.factory.createIdentifier(""),
          ts.SyntaxKind.MultiLineCommentTrivia,
          " " + String(error) + " ",
          true
        ))
      )
    )
    changeTracker.insertNodeBefore(sourceFile, node, newNode, true, {
      leadingTriviaOption: ts.textChanges.LeadingTriviaOption.StartLine
    })
  }
)
