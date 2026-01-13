import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

type SupportedFunctionNode = ts.FunctionExpression | ts.ArrowFunction | ts.FunctionDeclaration

interface EffectFnOpportunityTarget {
  readonly node: SupportedFunctionNode
  readonly nameIdentifier: ts.Identifier | ts.StringLiteral | undefined
  readonly effectModuleName: string
  readonly traceName: string | undefined
  readonly pipeArguments: ReadonlyArray<ts.Expression>
  /** Present if the opportunity originated from an Effect.gen call */
  readonly generatorFunction: ts.FunctionExpression | undefined
}

export const effectFnOpportunity = LSP.createDiagnostic({
  name: "effectFnOpportunity",
  code: 41,
  description: "Suggests using Effect.fn for functions that returns an Effect",
  severity: "suggestion",
  apply: Nano.fn("effectFnOpportunity.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    const sourceEffectModuleName = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "effect",
      "Effect"
    ) || "Effect"

    // ==================== Parsing helpers ====================

    /**
     * Finds a single return statement in a block, returning undefined if there are
     * multiple returns or complex control flow
     */
    const findSingleReturnStatement = (block: ts.Block): ts.ReturnStatement | undefined => {
      if (block.statements.length !== 1) return undefined
      const statement = block.statements[0]
      if (!ts.isReturnStatement(statement)) return undefined
      return statement
    }

    /**
     * Gets the body expression from a function node.
     * For block bodies, requires a single return statement.
     */
    const getBodyExpression = (fnNode: SupportedFunctionNode): ts.Expression | undefined => {
      if (ts.isArrowFunction(fnNode)) {
        if (ts.isBlock(fnNode.body)) {
          return findSingleReturnStatement(fnNode.body)?.expression
        }
        return fnNode.body
      } else if ((ts.isFunctionExpression(fnNode) || ts.isFunctionDeclaration(fnNode)) && fnNode.body) {
        return findSingleReturnStatement(fnNode.body)?.expression
      }
      return undefined
    }

    /**
     * Gets the name identifier node from the context (variable name or function declaration name)
     */
    const getNameIdentifier = (node: SupportedFunctionNode): ts.Identifier | ts.StringLiteral | undefined => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        return node.name
      }
      if (node.parent && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
        return node.parent.name
      }
      if (node.parent && ts.isPropertyAssignment(node.parent)) {
        const name = node.parent.name
        if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
          return name
        }
      }
      if (node.parent && ts.isPropertyDeclaration(node.parent)) {
        const name = node.parent.name
        if (ts.isIdentifier(name)) {
          return name
        }
      }
      return undefined
    }

    interface ParsedOpportunity {
      readonly effectModuleName: string
      readonly pipeArguments: ReadonlyArray<ts.Expression>
      readonly generatorFunction?: ts.FunctionExpression
    }

    /**
     * Tries to parse a function as a Gen opportunity (returning Effect.gen with a single return statement).
     */
    const tryParseGenOpportunity = (
      fnNode: SupportedFunctionNode
    ): Nano.Nano<ParsedOpportunity, TypeParser.TypeParserIssue, never> =>
      Nano.gen(function*() {
        const bodyExpression = getBodyExpression(fnNode)
        if (!bodyExpression) return yield* TypeParser.TypeParserIssue.issue

        const { pipeArguments, subject } = yield* pipe(
          typeParser.pipeCall(bodyExpression),
          Nano.map(({ args, subject }) => ({ subject, pipeArguments: args })),
          Nano.orElse(() => Nano.succeed({ subject: bodyExpression, pipeArguments: [] as Array<ts.Expression> }))
        )

        const { effectModule, generatorFunction } = yield* typeParser.effectGen(subject)

        const effectModuleName = ts.isIdentifier(effectModule)
          ? ts.idText(effectModule)
          : sourceEffectModuleName

        return { effectModuleName, generatorFunction, pipeArguments }
      })

    /**
     * Checks if a function node is already inside an Effect.fn or Effect.fnUntraced call.
     */
    const isInsideEffectFn = (fnNode: ts.Node): Nano.Nano<boolean, never, never> => {
      const parent = fnNode.parent
      if (!parent || !ts.isCallExpression(parent)) {
        return Nano.succeed(false)
      }
      if (parent.arguments[0] !== fnNode) {
        return Nano.succeed(false)
      }
      return pipe(
        typeParser.effectFn(parent),
        Nano.orElse(() => typeParser.effectFnUntraced(parent)),
        Nano.orElse(() => typeParser.effectFnGen(parent)),
        Nano.orElse(() => typeParser.effectFnUntracedGen(parent)),
        Nano.map(() => true),
        Nano.orElse(() => Nano.succeed(false))
      )
    }

    /**
     * Parses a node as an Effect.fn opportunity target.
     */
    const parseEffectFnOpportunityTarget = (
      node: ts.Node
    ): Nano.Nano<EffectFnOpportunityTarget, TypeParser.TypeParserIssue, never> =>
      Nano.gen(function*() {
        // We're looking for function expressions, arrow functions, or function declarations
        if (!ts.isFunctionExpression(node) && !ts.isArrowFunction(node) && !ts.isFunctionDeclaration(node)) {
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

        // Check if this function is already inside an Effect.fn call
        if (yield* isInsideEffectFn(node)) {
          return yield* TypeParser.TypeParserIssue.issue
        }

        // Get the type of the function to check call signatures
        const functionType = typeChecker.getTypeAtLocation(node)
        if (!functionType) return yield* TypeParser.TypeParserIssue.issue

        // Check if the function has only one call signature (no overloads)
        const callSignatures = typeChecker.getSignaturesOfType(functionType, ts.SignatureKind.Call)
        if (callSignatures.length !== 1) return yield* TypeParser.TypeParserIssue.issue

        // Get the return type of the function
        const signature = callSignatures[0]
        const returnType = typeChecker.getReturnTypeOfSignature(signature)

        // Unroll union members and check that ALL are strict Effect types
        const unionMembers = typeCheckerUtils.unrollUnionMembers(returnType)
        yield* Nano.all(...unionMembers.map((member) => typeParser.strictEffectType(member, node)))

        // Try to get a name identifier and trace name
        const nameIdentifier = getNameIdentifier(node)
        const traceName = nameIdentifier
          ? ts.isIdentifier(nameIdentifier) ? ts.idText(nameIdentifier) : nameIdentifier.text
          : undefined

        // Try to parse as Gen opportunity, then fall back to Regular opportunity
        const opportunity = yield* pipe(
          tryParseGenOpportunity(node),
          Nano.orElse(() =>
            Nano.succeed({ effectModuleName: sourceEffectModuleName, pipeArguments: [], generatorFunction: undefined })
          )
        )

        return {
          node,
          nameIdentifier,
          effectModuleName: opportunity.effectModuleName,
          traceName,
          pipeArguments: opportunity.pipeArguments,
          generatorFunction: opportunity.generatorFunction
        }
      })

    // ==================== Fix creation helpers ====================

    /**
     * Gets the function body as a Block
     */
    const getFunctionBodyBlock = (
      node: ts.FunctionExpression | ts.ArrowFunction | ts.FunctionDeclaration
    ): ts.Block => {
      if (ts.isArrowFunction(node)) {
        if (ts.isBlock(node.body)) {
          return node.body
        }
        return ts.factory.createBlock([ts.factory.createReturnStatement(node.body)], true)
      }
      return node.body!
    }

    /**
     * Checks if a function node is a generator (has asterisk token)
     */
    const isGeneratorFunction = (node: ts.FunctionExpression | ts.ArrowFunction | ts.FunctionDeclaration): boolean => {
      if (ts.isArrowFunction(node)) return false
      return node.asteriskToken !== undefined
    }

    /**
     * Creates the Effect.fn node for both Gen and Regular opportunities
     */
    const createEffectFnNode = (
      originalNode: SupportedFunctionNode,
      innerFunction: ts.FunctionExpression | ts.ArrowFunction | ts.FunctionDeclaration,
      effectModuleName: string,
      traceName: string | undefined,
      pipeArguments: ReadonlyArray<ts.Expression>
    ): ts.Node => {
      const isGenerator = isGeneratorFunction(innerFunction)
      const newFunction = ts.factory.createFunctionExpression(
        undefined,
        isGenerator ? ts.factory.createToken(ts.SyntaxKind.AsteriskToken) : undefined,
        undefined,
        originalNode.typeParameters,
        originalNode.parameters,
        undefined,
        getFunctionBodyBlock(innerFunction)
      )

      let fnExpression: ts.Expression = ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier(effectModuleName),
        "fn"
      )

      if (traceName) {
        fnExpression = ts.factory.createCallExpression(
          fnExpression,
          undefined,
          [ts.factory.createStringLiteral(traceName)]
        )
      }

      const effectFnCall = ts.factory.createCallExpression(fnExpression, undefined, [newFunction, ...pipeArguments])

      if (ts.isFunctionDeclaration(originalNode)) {
        return tsUtils.tryPreserveDeclarationSemantics(originalNode, effectFnCall, false)
      }

      return effectFnCall
    }

    /**
     * Creates the Effect.fnUntraced node for both Gen and Regular opportunities
     */
    const createEffectFnUntracedNode = (
      originalNode: SupportedFunctionNode,
      innerFunction: ts.FunctionExpression | ts.ArrowFunction | ts.FunctionDeclaration,
      effectModuleName: string,
      pipeArguments: ReadonlyArray<ts.Expression>
    ): ts.Node => {
      const isGenerator = isGeneratorFunction(innerFunction)
      const newFunction = ts.factory.createFunctionExpression(
        undefined,
        isGenerator ? ts.factory.createToken(ts.SyntaxKind.AsteriskToken) : undefined,
        undefined,
        originalNode.typeParameters,
        originalNode.parameters,
        undefined,
        getFunctionBodyBlock(innerFunction)
      )

      const effectFnCall = ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier(effectModuleName), "fnUntraced"),
        undefined,
        [newFunction, ...pipeArguments]
      )

      if (ts.isFunctionDeclaration(originalNode)) {
        return tsUtils.tryPreserveDeclarationSemantics(originalNode, effectFnCall, false)
      }

      return effectFnCall
    }

    // ==================== Main visitor loop ====================

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      const target = yield* pipe(parseEffectFnOpportunityTarget(node), Nano.option)
      if (Option.isNone(target)) continue

      const { effectModuleName, nameIdentifier, node: targetNode, pipeArguments, traceName } = target.value
      const innerFunction = target.value.generatorFunction ?? targetNode

      const fixes: Array<LSP.ApplicableDiagnosticDefinitionFix> = []

      fixes.push({
        fixName: "effectFnOpportunity_toEffectFn",
        description: traceName ? `Convert to Effect.fn("${traceName}")` : "Convert to Effect.fn",
        apply: Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
          const newNode = createEffectFnNode(targetNode, innerFunction, effectModuleName, traceName, pipeArguments)
          changeTracker.replaceNode(sourceFile, targetNode, newNode)
        })
      })

      // Only offer fnUntraced when there's a generator function (from Effect.gen),
      // since that's the only case where tracing overhead exists to be avoided
      if (target.value.generatorFunction) {
        fixes.push({
          fixName: "effectFnOpportunity_toEffectFnUntraced",
          description: "Convert to Effect.fnUntraced",
          apply: Nano.gen(function*() {
            const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
            const newNode = createEffectFnUntracedNode(targetNode, innerFunction, effectModuleName, pipeArguments)
            changeTracker.replaceNode(sourceFile, targetNode, newNode)
          })
        })
      }

      report({
        location: nameIdentifier ?? targetNode,
        messageText: target.value.generatorFunction
          ? `This function could benefit from Effect.fn's automatic tracing and concise syntax, or Effect.fnUntraced to get just a more concise syntax.`
          : `This function could benefit from Effect.fn's automatic tracing and concise syntax.`,
        fixes
      })
    }
  })
})
