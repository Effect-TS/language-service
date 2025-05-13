import { identity, pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as AST from "../core/AST"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"

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
}
const SchemaGenContext = Nano.Tag<SchemaGenContext>("SchemaGenContext")

export const makeSchemaGenContext = Nano.fn("SchemaGen.makeSchemaGenContext")(function*(
  sourceFile: ts.SourceFile
) {
  const effectSchemaIdentifier = pipe(
    yield* Nano.option(
      AST.findImportedModuleIdentifierByPackageAndNameOrBarrel(sourceFile, "effect", "Schema")
    ),
    Option.match({
      onNone: () => "Schema",
      onSome: (_) => _.text
    })
  )

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

export const processNode = (
  node: ts.Node
): Nano.Nano<
  ts.Expression,
  | RequiredExplicitTypesError
  | TypeParametersNotSupportedError
  | OnlyLiteralPropertiesSupportedError
  | IndexSignatureWithMoreThanOneParameterError,
  TypeScriptApi.TypeScriptApi | SchemaGenContext
> =>
  Nano.gen(function*() {
    const { createApiCall, createApiPropertyAccess, sourceFile, ts } = yield* Nano.service(
      SchemaGenContext
    )
    // string | number | boolean | undefined | void | never
    switch (node.kind) {
      case ts.SyntaxKind.NullKeyword:
        return (createApiPropertyAccess("Null"))
      case ts.SyntaxKind.UndefinedKeyword:
        return (createApiPropertyAccess("Undefined"))
      case ts.SyntaxKind.StringKeyword:
        return (createApiPropertyAccess("String"))
      case ts.SyntaxKind.NumberKeyword:
        return (createApiPropertyAccess("Number"))
      case ts.SyntaxKind.BooleanKeyword:
        return (createApiPropertyAccess("Boolean"))
      case ts.SyntaxKind.BigIntKeyword:
        return (createApiPropertyAccess("BigInt"))
    }
    // true | false | null
    if (ts.isLiteralTypeNode(node)) {
      switch (node.literal.kind) {
        case ts.SyntaxKind.NullKeyword:
          return (createApiPropertyAccess("Null"))
        case ts.SyntaxKind.TrueKeyword:
          return (createApiCall("Literal", [ts.factory.createTrue()]))
        case ts.SyntaxKind.FalseKeyword:
          return (createApiCall("Literal", [ts.factory.createFalse()]))
        case ts.SyntaxKind.StringLiteral:
          return (
            createApiCall("Literal", [ts.factory.createStringLiteral(node.literal.text)])
          )
        case ts.SyntaxKind.NumericLiteral:
          return (
            createApiCall("Literal", [ts.factory.createNumericLiteral(node.literal.text)])
          )
      }
    }
    // A | B
    if (ts.isUnionTypeNode(node)) {
      const members = yield* Nano.all(...node.types.map((_) => processNode(_)))
      return createApiCall("Union", members)
    }
    // string[]
    if (ts.isArrayTypeNode(node)) {
      const typeSchema = yield* processNode(node.elementType)
      return createApiCall("Array", [typeSchema])
    }
    // { a: string, b: boolean }
    if (ts.isTypeLiteralNode(node)) {
      const { properties, records } = yield* processMembers(node.members)

      return createApiCall(
        "Struct",
        [ts.factory.createObjectLiteralExpression(properties, true)].concat(records)
      )
    }
    // known type references
    if (
      ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)
    ) {
      const typeName = node.typeName.text
      switch (typeName) {
        case "Date":
          return createApiPropertyAccess("Date")
        case "ReadonlyArray":
        case "Array": {
          const elements = yield* Nano.all(
            ...(node.typeArguments ? node.typeArguments.map(processNode) : [])
          )
          return createApiCall("Array", elements)
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
    return ts.addSyntheticTrailingComment(
      ts.factory.createIdentifier(""),
      ts.SyntaxKind.MultiLineCommentTrivia,
      " " + node.getText(sourceFile) + " "
    )
  })

export const processDate = Nano.fn("SchemaGen.processBooleanKeyword")(
  function*() {
    const { createApiPropertyAccess } = yield* Nano.service(SchemaGenContext)
    return createApiPropertyAccess("Date")
  }
)

export const processInterfaceDeclaration = Nano.fn("SchemaGen.processInterfaceDeclaration")(
  function*(sourceFile: ts.SourceFile, node: ts.InterfaceDeclaration) {
    const ctx = yield* makeSchemaGenContext(sourceFile)

    return yield* pipe(
      processInterfaceDeclarationWorker(node),
      Nano.provideService(SchemaGenContext, ctx)
    )
  }
)

const processMembers = Nano.fn(
  "SchemaGen.processMembers"
)(
  function*(members: ts.NodeArray<ts.TypeElement>) {
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
        yield* processNode(propertySignature.type),
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
      const key = yield* processNode(parameterType)
      const value = yield* processNode(indexSignature.type)
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

const processInterfaceDeclarationWorker = Nano.fn(
  "SchemaGen.processInterfaceDeclarationWorker"
)(
  function*(node: ts.InterfaceDeclaration) {
    if (node.typeParameters && node.typeParameters.length > 0) {
      return yield* Nano.fail(new TypeParametersNotSupportedError(node))
    }
    const { createApiCall, ts } = yield* Nano.service(
      SchemaGenContext
    )

    const { properties, records } = yield* processMembers(node.members)

    const schemaStruct = createApiCall(
      "Struct",
      [ts.factory.createObjectLiteralExpression(properties, true)].concat(records)
    )

    return ts.factory.createVariableStatement(
      node.modifiers,
      ts.factory.createVariableDeclarationList([
        ts.factory.createVariableDeclaration(
          ts.factory.createIdentifier(node.name.text),
          undefined,
          undefined,
          schemaStruct
        )
      ], ts.NodeFlags.Const)
    )
  }
)
