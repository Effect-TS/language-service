import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

type SupportedFunctionNode = ts.FunctionExpression | ts.ArrowFunction | ts.FunctionDeclaration

export interface EffectFnOpportunityTarget {
  readonly node: SupportedFunctionNode
  readonly nameIdentifier: ts.Identifier | ts.StringLiteral | undefined
  readonly effectModule: ts.Expression
  readonly generatorFunction: ts.FunctionExpression
  readonly effectModuleName: string
  readonly traceName: string | undefined
  readonly hasReturnTypeAnnotation: boolean
  readonly effectTypes: { A: ts.Type; E: ts.Type; R: ts.Type }
  readonly pipeArguments: ReadonlyArray<ts.Expression>
}

/**
 * Checks if a node is a function that returns Effect.gen and can be converted to Effect.fn.
 * Fails with TypeParserIssue if the node doesn't match.
 */
export const parseEffectFnOpportunityTarget = (
  node: ts.Node,
  sourceFile: ts.SourceFile
): Nano.Nano<
  EffectFnOpportunityTarget,
  TypeParser.TypeParserIssue,
  TypeScriptApi.TypeScriptApi | TypeCheckerApi.TypeCheckerApi | TypeParser.TypeParser | TypeScriptUtils.TypeScriptUtils
> =>
  Nano.gen(function*() {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    // We're looking for function expressions, arrow functions, or function declarations
    if (
      !ts.isFunctionExpression(node) && !ts.isArrowFunction(node) &&
      !ts.isFunctionDeclaration(node)
    ) {
      return yield* TypeParser.TypeParserIssue.issue
    }

    // Skip generator functions (they can't be converted)
    if ((ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) && node.asteriskToken) {
      return yield* TypeParser.TypeParserIssue.issue
    }

    // Skip named function expressions (they are typically used for recursion)
    if (ts.isFunctionExpression(node) && node.name) {
      return yield* TypeParser.TypeParserIssue.issue
    }

    // Get the body expression to check if it's Effect.gen
    let bodyExpression: ts.Expression | undefined

    if (ts.isArrowFunction(node)) {
      if (ts.isBlock(node.body)) {
        // Arrow function with block body - look for return statement
        const returnStatement = findSingleReturnStatement(ts, node.body)
        if (returnStatement?.expression) {
          bodyExpression = returnStatement.expression
        }
      } else {
        // Arrow function with expression body
        bodyExpression = node.body
      }
    } else if ((ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) && node.body) {
      // Function expression or declaration - look for return statement
      const returnStatement = findSingleReturnStatement(ts, node.body)
      if (returnStatement?.expression) {
        bodyExpression = returnStatement.expression
      }
    }

    if (!bodyExpression) return yield* TypeParser.TypeParserIssue.issue

    // Extract subject and pipe arguments - either from a pipe call or directly from body expression
    const { pipeArguments, subject } = yield* pipe(
      typeParser.pipeCall(bodyExpression),
      Nano.map(({ args, subject }) => ({ subject, pipeArguments: args })),
      Nano.orElse(() => Nano.succeed({ subject: bodyExpression, pipeArguments: [] as Array<ts.Expression> }))
    )

    // Parse Effect.gen from the subject
    const { effectModule, generatorFunction } = yield* typeParser.effectGen(subject)

    // Get the type of the function to check call signatures
    // Note: we use typeChecker directly because typeCheckerUtils.getTypeAtLocation
    // only works for expressions, not function declarations
    const functionType = typeChecker.getTypeAtLocation(node)
    if (!functionType) return yield* TypeParser.TypeParserIssue.issue

    // Check if the function has only one call signature (no overloads)
    const callSignatures = typeChecker.getSignaturesOfType(functionType, ts.SignatureKind.Call)
    if (callSignatures.length !== 1) return yield* TypeParser.TypeParserIssue.issue

    // Get the return type of the function for the annotation
    const signature = callSignatures[0]
    const returnType = typeChecker.getReturnTypeOfSignature(signature)

    // Parse the Effect type to get A, E, R
    const { A, E, R } = yield* typeParser.strictEffectType(returnType, node)

    // Get Effect module identifier name
    const effectModuleName = ts.isIdentifier(effectModule)
      ? ts.idText(effectModule)
      : tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
        sourceFile,
        "effect",
        "Effect"
      ) || "Effect"

    // Try to get a name identifier and trace name
    const nameIdentifier = getNameIdentifier(ts, node)
    const traceName = nameIdentifier
      ? ts.isIdentifier(nameIdentifier) ? ts.idText(nameIdentifier) : nameIdentifier.text
      : undefined

    // Check if the original function had a return type annotation
    const hasReturnTypeAnnotation = !!node.type

    return {
      node,
      nameIdentifier,
      effectModule,
      generatorFunction,
      effectModuleName,
      traceName,
      hasReturnTypeAnnotation,
      effectTypes: { A, E, R },
      pipeArguments
    }
  })

export const effectFnOpportunity = LSP.createDiagnostic({
  name: "effectFnOpportunity",
  code: 41,
  description: "Suggests using Effect.fn for functions that return Effect.gen",
  severity: "suggestion",
  apply: Nano.fn("effectFnOpportunity.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    /**
     * Creates the return type annotation: Effect.fn.Return<A, E, R>
     */
    const createReturnTypeAnnotation = (
      effectModuleName: string,
      effectTypes: { A: ts.Type; E: ts.Type; R: ts.Type },
      enclosingNode: ts.Node
    ): ts.TypeNode | undefined => {
      const { A, E, R } = effectTypes

      // Convert types to type nodes (NoTruncation to avoid ... in long types)
      const aTypeNode = typeChecker.typeToTypeNode(A, enclosingNode, ts.NodeBuilderFlags.NoTruncation)
      const eTypeNode = typeChecker.typeToTypeNode(E, enclosingNode, ts.NodeBuilderFlags.NoTruncation)
      const rTypeNode = typeChecker.typeToTypeNode(R, enclosingNode, ts.NodeBuilderFlags.NoTruncation)

      if (!aTypeNode || !eTypeNode || !rTypeNode) return undefined

      // Create Effect.fn.Return<A, E, R>
      return ts.factory.createTypeReferenceNode(
        ts.factory.createQualifiedName(
          ts.factory.createQualifiedName(
            ts.factory.createIdentifier(effectModuleName),
            "fn"
          ),
          "Return"
        ),
        [aTypeNode, eTypeNode, rTypeNode]
      )
    }

    /**
     * Creates the Effect.fn node
     */
    const createEffectFnNode = (
      originalNode: SupportedFunctionNode,
      generatorFunction: ts.FunctionExpression,
      effectModuleName: string,
      traceName: string | undefined,
      effectTypes: { A: ts.Type; E: ts.Type; R: ts.Type } | undefined,
      pipeArguments: ReadonlyArray<ts.Expression>
    ): ts.Node => {
      // Create the generator function with the original parameters
      const returnTypeAnnotation = effectTypes
        ? createReturnTypeAnnotation(effectModuleName, effectTypes, originalNode)
        : undefined

      const newGeneratorFunction = ts.factory.createFunctionExpression(
        undefined,
        ts.factory.createToken(ts.SyntaxKind.AsteriskToken),
        undefined,
        originalNode.typeParameters,
        originalNode.parameters,
        returnTypeAnnotation,
        generatorFunction.body
      )

      // Effect.fn
      let fnExpression: ts.Expression = ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier(effectModuleName),
        "fn"
      )

      // Effect.fn("traceName") if we have a trace name
      if (traceName) {
        fnExpression = ts.factory.createCallExpression(
          fnExpression,
          undefined,
          [ts.factory.createStringLiteral(traceName)]
        )
      }

      // Effect.fn("traceName")(function*() { ... }, ...pipeArguments)
      const effectFnCall = ts.factory.createCallExpression(
        fnExpression,
        undefined,
        [newGeneratorFunction, ...pipeArguments]
      )

      // For function declarations, we need to wrap in a variable statement
      if (ts.isFunctionDeclaration(originalNode)) {
        return tsUtils.tryPreserveDeclarationSemantics(originalNode, effectFnCall, false)
      }

      return effectFnCall
    }

    /**
     * Creates the Effect.fnUntraced node
     */
    const createEffectFnUntracedNode = (
      originalNode: SupportedFunctionNode,
      generatorFunction: ts.FunctionExpression,
      effectModuleName: string,
      effectTypes: { A: ts.Type; E: ts.Type; R: ts.Type } | undefined,
      pipeArguments: ReadonlyArray<ts.Expression>
    ): ts.Node => {
      // Create the generator function with the original parameters
      const returnTypeAnnotation = effectTypes
        ? createReturnTypeAnnotation(effectModuleName, effectTypes, originalNode)
        : undefined

      const newGeneratorFunction = ts.factory.createFunctionExpression(
        undefined,
        ts.factory.createToken(ts.SyntaxKind.AsteriskToken),
        undefined,
        originalNode.typeParameters,
        originalNode.parameters,
        returnTypeAnnotation,
        generatorFunction.body
      )

      // Effect.fnUntraced(function*() { ... }, ...pipeArguments)
      const effectFnCall = ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
          ts.factory.createIdentifier(effectModuleName),
          "fnUntraced"
        ),
        undefined,
        [newGeneratorFunction, ...pipeArguments]
      )

      // For function declarations, we need to wrap in a variable statement
      if (ts.isFunctionDeclaration(originalNode)) {
        return tsUtils.tryPreserveDeclarationSemantics(originalNode, effectFnCall, false)
      }

      return effectFnCall
    }

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      const target = yield* pipe(
        parseEffectFnOpportunityTarget(node, sourceFile),
        Nano.option
      )
      if (Option.isNone(target)) continue

      const {
        effectModuleName,
        effectTypes,
        generatorFunction,
        hasReturnTypeAnnotation,
        nameIdentifier,
        node: targetNode,
        pipeArguments,
        traceName
      } = target.value

      // Build the fixes
      const fixes: Array<LSP.ApplicableDiagnosticDefinitionFix> = []

      // Fix 1: Convert to Effect.fn (traced)
      fixes.push({
        fixName: "effectFnOpportunity_toEffectFn",
        description: traceName
          ? `Convert to Effect.fn("${traceName}")`
          : "Convert to Effect.fn",
        apply: Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
          const newNode = createEffectFnNode(
            targetNode,
            generatorFunction,
            effectModuleName,
            traceName,
            hasReturnTypeAnnotation ? effectTypes : undefined,
            pipeArguments
          )
          changeTracker.replaceNode(sourceFile, targetNode, newNode)
        })
      })

      // Fix 2: Convert to Effect.fnUntraced
      fixes.push({
        fixName: "effectFnOpportunity_toEffectFnUntraced",
        description: "Convert to Effect.fnUntraced",
        apply: Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
          const newNode = createEffectFnUntracedNode(
            targetNode,
            generatorFunction,
            effectModuleName,
            hasReturnTypeAnnotation ? effectTypes : undefined,
            pipeArguments
          )
          changeTracker.replaceNode(sourceFile, targetNode, newNode)
        })
      })

      report({
        location: nameIdentifier ?? targetNode,
        messageText:
          `This function could benefit from Effect.fn's automatic tracing and concise syntax, or Effect.fnUntraced to get just a more concise syntax.`,
        fixes
      })
    }
  })
})

/**
 * Finds a single return statement in a block, returning undefined if there are
 * multiple returns or complex control flow
 */
function findSingleReturnStatement(
  ts: TypeScriptApi.TypeScriptApi,
  block: ts.Block
): ts.ReturnStatement | undefined {
  // We only want blocks with a single statement that is a return
  if (block.statements.length !== 1) return undefined
  const statement = block.statements[0]
  if (!ts.isReturnStatement(statement)) return undefined
  return statement
}

/**
 * Gets the name identifier node from the context (variable name or function declaration name)
 */
function getNameIdentifier(
  ts: TypeScriptApi.TypeScriptApi,
  node: SupportedFunctionNode
): ts.Identifier | ts.StringLiteral | undefined {
  // Check if it's a function declaration with a name
  if (ts.isFunctionDeclaration(node) && node.name) {
    return node.name
  }

  // Check if assigned to a variable
  if (node.parent && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
    return node.parent.name
  }

  // Check if it's a property assignment
  if (node.parent && ts.isPropertyAssignment(node.parent)) {
    const name = node.parent.name
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
      return name
    }
  }

  // Check if it's a property declaration
  if (node.parent && ts.isPropertyDeclaration(node.parent)) {
    const name = node.parent.name
    if (ts.isIdentifier(name)) {
      return name
    }
  }

  return undefined
}
