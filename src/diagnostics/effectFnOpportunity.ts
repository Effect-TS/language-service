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
  /** Inferred trace name from the function/variable name */
  readonly inferredTraceName: string | undefined
  /** Explicit trace expression extracted from withSpan (if last pipe arg is withSpan) */
  readonly explicitTraceExpression: ts.Expression | undefined
  readonly pipeArguments: ReadonlyArray<ts.Expression>
  /** Present if the opportunity originated from an Effect.gen call */
  readonly generatorFunction: ts.FunctionExpression | undefined
  /** True if function parameters are referenced in pipe arguments (unsafe to convert) */
  readonly hasParamsInPipeArgs: boolean
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
      readonly generatorFunction: ts.FunctionExpression | undefined
      /** Explicit trace expression extracted from withSpan (if last pipe arg is withSpan) */
      readonly explicitTraceExpression: ts.Expression | undefined
    }

    /**
     * Checks if any of the function's parameter symbols are referenced within the given nodes.
     * Uses declaration position checking: if a symbol's declaration is within the function's
     * parameters range, it's a parameter reference.
     */
    const areParametersReferencedIn = (
      fnNode: SupportedFunctionNode,
      nodes: ReadonlyArray<ts.Node>
    ): boolean => {
      if (fnNode.parameters.length === 0 || nodes.length === 0) return false

      // Get the position range of all parameters
      const firstParam = fnNode.parameters[0]
      const lastParam = fnNode.parameters[fnNode.parameters.length - 1]
      const paramsStart = firstParam.pos
      const paramsEnd = lastParam.end

      // Check if a symbol's declaration is within the parameters range
      const isSymbolDeclaredInParams = (symbol: ts.Symbol): boolean => {
        const declarations = symbol.declarations
        if (!declarations) return false
        return declarations.some((decl) => decl.pos >= paramsStart && decl.end <= paramsEnd)
      }

      // Walk all nodes looking for symbols declared in the function parameters
      const nodesToVisit: Array<ts.Node> = [...nodes]
      while (nodesToVisit.length > 0) {
        const node = nodesToVisit.shift()!

        // Check regular identifiers
        if (ts.isIdentifier(node)) {
          const symbol = typeChecker.getSymbolAtLocation(node)
          if (symbol && isSymbolDeclaredInParams(symbol)) {
            return true
          }
        }

        // Check shorthand property assignments like { a, b }
        if (ts.isShorthandPropertyAssignment(node)) {
          const valueSymbol = typeChecker.getShorthandAssignmentValueSymbol(node)
          if (valueSymbol && isSymbolDeclaredInParams(valueSymbol)) {
            return true
          }
        }

        ts.forEachChild(node, (child) => {
          nodesToVisit.push(child)
          return undefined
        })
      }

      return false
    }

    /**
     * Checks if an expression is a call to Effect.withSpan and extracts the span name expression.
     * Returns the span name expression if it's a withSpan call, undefined otherwise.
     */
    const tryExtractWithSpanExpression = (
      expr: ts.Expression
    ): Nano.Nano<ts.Expression | undefined, never, never> =>
      Nano.gen(function*() {
        // Check if it's a call expression
        if (!ts.isCallExpression(expr)) return undefined

        // Check if the callee is Effect.withSpan
        const callee = expr.expression
        const isWithSpan = yield* pipe(
          typeParser.isNodeReferenceToEffectModuleApi("withSpan")(callee),
          Nano.map(() => true),
          Nano.orElse(() => Nano.succeed(false))
        )

        if (!isWithSpan) return undefined

        // withSpan has at least one argument (the span name)
        if (expr.arguments.length === 0) return undefined

        return expr.arguments[0]
      })

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

        // Check if the last pipe argument is Effect.withSpan and extract the span name
        // We keep all pipe arguments intact here; the autofix will remove withSpan when needed
        let explicitTraceExpression: ts.Expression | undefined

        if (pipeArguments.length > 0) {
          const lastArg = pipeArguments[pipeArguments.length - 1]
          const withSpanExpr = yield* tryExtractWithSpanExpression(lastArg)
          if (withSpanExpr) {
            explicitTraceExpression = withSpanExpr
          }
        }

        return { effectModuleName, generatorFunction, pipeArguments, explicitTraceExpression }
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

        // Skip functions with return type annotations (they could be recursive)
        if (node.type) {
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

        // Only if we have a traceName, that means basically either declaration name or parent
        if (!traceName) return yield* TypeParser.TypeParserIssue.issue

        // Try to parse as Gen opportunity, then fall back to Regular opportunity
        // For regular functions (not Effect.gen), only suggest if:
        // - Not an arrow function with concise body (expression body)
        // - Has a block body with more than 5 statements
        const opportunity = yield* pipe(
          tryParseGenOpportunity(node),
          Nano.orElse(() => {
            // Skip arrow functions with concise body (expression body, no braces)
            if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
              return TypeParser.TypeParserIssue.issue
            }
            // For functions with a block body, only suggest if there are more than 5 statements
            const body = ts.isArrowFunction(node) ? node.body as ts.Block : node.body
            if (!body || !ts.isBlock(body) || body.statements.length <= 5) {
              return TypeParser.TypeParserIssue.issue
            }
            return Nano.succeed({
              effectModuleName: sourceEffectModuleName,
              pipeArguments: [],
              generatorFunction: undefined,
              explicitTraceExpression: undefined
            })
          })
        )

        return {
          node,
          nameIdentifier,
          effectModuleName: opportunity.effectModuleName,
          inferredTraceName: traceName,
          explicitTraceExpression: opportunity.explicitTraceExpression,
          pipeArguments: opportunity.pipeArguments,
          generatorFunction: opportunity.generatorFunction,
          hasParamsInPipeArgs: areParametersReferencedIn(node, opportunity.pipeArguments)
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
     * Creates the Effect.fn node for both Gen and Regular opportunities.
     * @param traceNameOrExpression - Either an inferred string trace name or an explicit expression from withSpan
     */
    const createEffectFnNode = (
      originalNode: SupportedFunctionNode,
      innerFunction: ts.FunctionExpression | ts.ArrowFunction | ts.FunctionDeclaration,
      effectModuleName: string,
      traceNameOrExpression: string | ts.Expression | undefined,
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

      if (traceNameOrExpression) {
        // If it's a string, create a string literal; otherwise use the expression directly
        const traceArg = typeof traceNameOrExpression === "string"
          ? ts.factory.createStringLiteral(traceNameOrExpression)
          : traceNameOrExpression

        fnExpression = ts.factory.createCallExpression(
          fnExpression,
          undefined,
          [traceArg]
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

      // Skip if function parameters are referenced in pipe arguments
      // (unsafe to convert - parameters wouldn't be in scope after transformation)
      if (target.value.hasParamsInPipeArgs) continue

      const {
        effectModuleName,
        explicitTraceExpression,
        inferredTraceName,
        nameIdentifier,
        node: targetNode,
        pipeArguments
      } = target.value
      const innerFunction = target.value.generatorFunction ?? targetNode

      const fixes: Array<LSP.ApplicableDiagnosticDefinitionFix> = []

      // toEffectFnWithSpan: available when we have explicit span from withSpan
      if (explicitTraceExpression) {
        fixes.push({
          fixName: "effectFnOpportunity_toEffectFnWithSpan",
          description: "Convert to Effect.fn (with span from withSpan)",
          apply: Nano.gen(function*() {
            const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
            // Remove the withSpan from pipe args since Effect.fn adds the span
            const finalPipeArguments = pipeArguments.slice(0, -1)
            const newNode = createEffectFnNode(
              targetNode,
              innerFunction,
              effectModuleName,
              explicitTraceExpression,
              finalPipeArguments
            )
            changeTracker.replaceNode(sourceFile, targetNode, newNode)
          })
        })
      }

      // toEffectFnUntraced: available when we have a generator function
      // Keeps ALL pipe arguments including withSpan since fnUntraced doesn't add tracing
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

      // toEffectFnNoSpan: available always
      fixes.push({
        fixName: "effectFnOpportunity_toEffectFnNoSpan",
        description: "Convert to Effect.fn (no span)",
        apply: Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
          const newNode = createEffectFnNode(targetNode, innerFunction, effectModuleName, undefined, pipeArguments)
          changeTracker.replaceNode(sourceFile, targetNode, newNode)
        })
      })

      // toEffectFnSpanInferred: available if we have inferred span name AND no explicit one
      if (inferredTraceName && !explicitTraceExpression) {
        fixes.push({
          fixName: "effectFnOpportunity_toEffectFnSpanInferred",
          description: `Convert to Effect.fn("${inferredTraceName}")`,
          apply: Nano.gen(function*() {
            const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
            const newNode = createEffectFnNode(
              targetNode,
              innerFunction,
              effectModuleName,
              inferredTraceName,
              pipeArguments
            )
            changeTracker.replaceNode(sourceFile, targetNode, newNode)
          })
        })
      }

      const pipeArgsSuffix = pipeArguments.length > 0
        ? ` Effect.fn also accepts the piped transformations as additional arguments.`
        : ``

      const suggestConsultingQuickFixes =
        ` Your editor quickfixes or the "effect-language-service" cli can show you how to convert to Effect.fn or Effect.fnUntraced.`

      const orFnUntraced = target.value.generatorFunction ? `, or Effect.fnUntraced` : ``

      report({
        location: nameIdentifier ?? targetNode,
        messageText:
          `This function could benefit from Effect.fn's automatic tracing and concise syntax${orFnUntraced}.${pipeArgsSuffix}${suggestConsultingQuickFixes}`,
        fixes
      })
    }
  })
})
