import * as AST from "@effect/language-service/ast"
import type ts from "typescript/lib/tsserverlibrary"

export function isPipeCall(ts: AST.TypeScriptApi) {
  return (node: ts.Node) => {
    if (!ts.isCallExpression(node)) return false
    const expression = node.expression
    if (!ts.isIdentifier(expression)) return false
    if (expression.getText(node.getSourceFile()) !== "pipe") return false
    return true
  }
}

export function asPipeableCallExpression(ts: AST.TypeScriptApi) {
  return (node: ts.Node) => {
    // ensure the node is a call expression
    if (!ts.isCallExpression(node)) return Maybe.none
    // with just 1 arg
    if (node.arguments.length !== 1) return Maybe.none
    const arg = node.arguments[0]!
    // ideally T.map(n => n * 2) could be piped to pipe(n => n * 2, T.map)
    // but does not make any sense.
    if (ts.isArrowFunction(arg)) return Maybe.none
    // same goes for identifiers, string literal or numbers
    if (ts.isStringLiteral(arg) || ts.isNumericLiteral(arg) || ts.isIdentifier(arg)) return Maybe.none
    return Maybe.some([node.expression, arg] as const)
  }
}

export function asPipeArguments(ts: AST.TypeScriptApi) {
  return (initialNode: ts.Node) => {
    let result = Chunk.empty<ts.Expression>()
    let currentNode: Maybe<ts.Node> = Maybe.some(initialNode)
    while (currentNode.isSome()) {
      const node = currentNode.value
      const maybePipeable = asPipeableCallExpression(ts)(node)
      if (maybePipeable.isNone()) {
        result = result.append(node as ts.Expression)
        break
      }
      const [exp, arg] = maybePipeable.value
      result = result.append(exp)
      currentNode = Maybe.some(arg)
    }
    return result.reverse
  }
}

export function isPipeableCallExpression(ts: AST.TypeScriptApi) {
  return (node: ts.Node): node is ts.CallExpression => asPipeableCallExpression(ts)(node).isSome()
}

export function findModuleImportIdentifierName(
  ts: AST.TypeScriptApi
) {
  return (sourceFile: ts.SourceFile, moduleName: string) => {
    return Maybe.fromNullable(ts.forEachChild(sourceFile, node => {
      if (!ts.isImportDeclaration(node)) return
      const moduleSpecifier = node.moduleSpecifier
      if (!ts.isStringLiteral(moduleSpecifier)) return
      if (moduleSpecifier.text !== moduleName) return
      const importClause = node.importClause
      if (!importClause) return
      const namedBindings = importClause.namedBindings
      if (!namedBindings) return
      if (!ts.isNamespaceImport(namedBindings)) return
      return namedBindings.name.text
    }))
  }
}

export function isCurryArrow(ts: AST.TypeScriptApi) {
  return (arrow: ts.Node): arrow is ts.ArrowFunction => {
    if (!ts.isArrowFunction(arrow)) return false
    if (arrow.parameters.length !== 1) return false
    const parameter = arrow.parameters[0]!
    const parameterName = parameter.name
    if (!ts.isIdentifier(parameterName)) return false
    const body = arrow.body
    if (!ts.isCallExpression(body)) return false
    const args = body.arguments
    if (args.length !== 1) return false
    const identifier = args[0]!
    if (!ts.isIdentifier(identifier)) return false
    return identifier.text === parameterName.text
  }
}

export function isLiteralConstantValue(ts: AST.TypeScriptApi) {
  return (node: ts.Node) =>
    ts.isStringLiteral(node) || ts.isNumericLiteral(node) || node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.NullKeyword
}

export function transformAsyncAwaitToEffectGen(
  node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  effectName: string,
  onAwait: (expression: ts.Expression) => ts.Expression
) {
  return Do($ => {
    const ts = $(Effect.service(AST.TypeScriptApi))

    function visitor(_: ts.Node): ts.Node {
      if (ts.isAwaitExpression(_)) {
        const expression = ts.visitEachChild(_.expression, visitor, ts.nullTransformationContext)

        return ts.factory.createYieldExpression(
          ts.factory.createToken(ts.SyntaxKind.AsteriskToken),
          ts.factory.createCallExpression(ts.factory.createIdentifier("$"), undefined, [onAwait(expression)])
        )
      }
      return ts.visitEachChild(_, visitor, ts.nullTransformationContext)
    }
    const generatorBody = visitor(node.body!)

    const generator = ts.factory.createFunctionExpression(
      [],
      ts.factory.createToken(ts.SyntaxKind.AsteriskToken),
      undefined,
      [],
      [ts.factory.createParameterDeclaration(undefined, undefined, "$")],
      undefined,
      generatorBody as any // NOTE(mattia): intended, to use same routine for both ConciseBody and Body
    )

    const effectGenCallExp = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier(effectName),
        "gen"
      ),
      undefined,
      [generator as any]
    )

    let currentFlags = ts.getCombinedModifierFlags(node)
    currentFlags &= ~ts.ModifierFlags.Async
    const newModifiers = ts.factory.createModifiersFromModifierFlags(currentFlags)

    if (ts.isArrowFunction(node)) {
      return ts.factory.createArrowFunction(
        newModifiers,
        node.typeParameters,
        node.parameters,
        undefined,
        node.equalsGreaterThanToken,
        effectGenCallExp
      )
    }

    const newBody = ts.factory.createBlock([
      ts.factory.createReturnStatement(effectGenCallExp)
    ])

    if (ts.isFunctionDeclaration(node)) {
      return ts.factory.createFunctionDeclaration(
        newModifiers,
        node.asteriskToken,
        node.name,
        node.typeParameters,
        node.parameters,
        undefined,
        newBody
      )
    }
    return ts.factory.createFunctionExpression(
      newModifiers,
      node.asteriskToken,
      node.name,
      node.typeParameters,
      node.parameters,
      undefined,
      newBody
    )
  })
}
