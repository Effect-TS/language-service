import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as Order from "effect/Order"
import type ts from "typescript"
import * as TypeParser from "../utils/TypeParser.js"
import type { TypeScriptApi } from "./TSAPI.js"

/**
 * Collects the given node and all its ancestor nodes that fully contain the specified TextRange.
 *
 * This function starts from the provided node and traverses up the AST, collecting
 * the node itself and its ancestors that encompass the given range.
 *
 * @param node - The starting AST node.
 * @param textRange - The range of text to use for filtering nodes.
 * @returns An array of nodes, including the starting node and its ancestors, that fully contain the specified range.
 */
function collectSelfAndAncestorNodesInRange(
  node: ts.Node,
  textRange: ts.TextRange
): Array<ts.Node> {
  let result = ReadonlyArray.empty<ts.Node>()
  let parent = node
  while (parent) {
    if (parent.end >= textRange.end) {
      result = pipe(result, ReadonlyArray.append(parent))
    }
    parent = parent.parent
  }
  return result
}

/**
 * Collects the node at the given position and all its ancestor nodes
 * that fully contain the specified TextRange.
 *
 * This function starts from the closest token at the given position
 * and traverses up the AST, collecting nodes that encompass the range.
 *
 * @param ts - The TypeScript API.
 * @returns A function that takes a SourceFile and a TextRange, and returns
 *          an array of nodes containing the range.
 */
export function getAncestorNodesInRange(
  ts: TypeScriptApi
) {
  return ((sourceFile: ts.SourceFile, textRange: ts.TextRange) => {
    const precedingToken = ts.findPrecedingToken(textRange.pos, sourceFile)
    if (!precedingToken) return ReadonlyArray.empty<ts.Node>()
    return collectSelfAndAncestorNodesInRange(precedingToken, textRange)
  })
}

/**
 * Finds the deepest AST node at the specified position within the given SourceFile.
 *
 * This function traverses the AST to locate the node that contains the given position.
 * If multiple nodes overlap the position, it returns the most specific (deepest) node.
 *
 * @param sourceFile - The TypeScript SourceFile to search within.
 * @param position - The position in the file to locate the node for.
 * @returns An `Option`:
 *          - `Option.some<ts.Node>` if a node is found at the specified position.
 *          - `Option.none` if no node is found at the specified position.
 */
function findNodeAtPosition(
  ts: TypeScriptApi,
  sourceFile: ts.SourceFile,
  position: number
): Option.Option<ts.Node> {
  function find(node: ts.Node): ts.Node | undefined {
    if (position >= node.getStart() && position < node.getEnd()) {
      // If the position is within this node, keep traversing its children
      return ts.forEachChild(node, find) || node
    }
    return undefined
  }
  return Option.fromNullable(find(sourceFile))
}

/**
 * Collects the node at the given position, its descendants, and all its ancestor nodes
 * that fully contain the specified TextRange.
 *
 * This function starts by locating the node at the given position within the AST,
 * traverses down to include its descendants, and then traverses up to include its ancestors,
 * collecting all nodes that encompass the specified range.
 *
 * @param sourceFile - The TypeScript SourceFile to search within.
 * @param textRange - The range of text to use for filtering nodes.
 * @returns An array of nodes that are either descendants or ancestors of the node
 *          at the given position and that fully contain the specified range.
 */
export function collectDescendantsAndAncestorsInRange(
  ts: TypeScriptApi,
  sourceFile: ts.SourceFile,
  textRange: ts.TextRange
) {
  const nodeAtPosition = findNodeAtPosition(ts, sourceFile, textRange.pos)
  if (Option.isNone(nodeAtPosition)) return ReadonlyArray.empty<ts.Node>()
  return collectSelfAndAncestorNodesInRange(nodeAtPosition.value, textRange)
}

/**
 * Extracts the `Effect` from an `Effect.gen` generator function with a single return statement.
 *
 * This function analyzes the provided node to determine if it represents an `Effect.gen` call.
 * If the generator function body contains exactly one `return` statement, and that statement
 * yields an `Effect`, the function extracts and returns the inner `Effect`.
 *
 * @param typeChecker - The TypeScript type checker, used to analyze the types of nodes.
 * @param node - The AST node to analyze.
 * @returns An `Option`:
 *          - `Option.some<ts.Node>` containing the inner `Effect` if the node is an `Effect.gen`
 *            with a single return statement yielding an `Effect`.
 *          - `Option.none` if the node does not match the criteria.
 */
export function getSingleReturnEffectFromEffectGen(
  ts: TypeScriptApi,
  typeChecker: ts.TypeChecker,
  node: ts.Node
): Option.Option<ts.Node> {
  // is the node an effect gen-like?
  const effectGenLike = TypeParser.effectGen(ts, typeChecker)(node)

  if (Option.isSome(effectGenLike)) {
    // if the node is an effect gen-like, we need to check if its body is just a single return statement
    const body = effectGenLike.value.body
    if (
      body.statements.length === 1 &&
      ts.isReturnStatement(body.statements[0]) &&
      body.statements[0].expression &&
      ts.isYieldExpression(body.statements[0].expression) &&
      body.statements[0].expression.expression
    ) {
      // get the type of the node
      const nodeToCheck = body.statements[0].expression.expression
      const type = typeChecker.getTypeAtLocation(nodeToCheck)
      const maybeEffect = TypeParser.effectType(ts, typeChecker)(type, nodeToCheck)
      if (Option.isSome(maybeEffect)) {
        return Option.some(nodeToCheck)
      }
    }
  }
  return Option.none()
}

/**
 * Ensures value is a text range
 */
export function toTextRange(positionOrRange: number | ts.TextRange): ts.TextRange {
  return typeof positionOrRange === "number"
    ? { end: positionOrRange, pos: positionOrRange }
    : positionOrRange
}

export function isNodeInRange(textRange: ts.TextRange) {
  return (node: ts.Node) => node.pos <= textRange.pos && node.end >= textRange.end
}

export function transformAsyncAwaitToEffectGen(
  ts: TypeScriptApi
) {
  return (
    node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
    effectModuleName: string,
    onAwait: (expression: ts.Expression) => ts.Expression
  ) => {
    function visitor(_: ts.Node): ts.Node {
      if (ts.isAwaitExpression(_)) {
        const expression = ts.visitEachChild(_.expression, visitor, ts.nullTransformationContext)

        return ts.factory.createYieldExpression(
          ts.factory.createToken(ts.SyntaxKind.AsteriskToken),
          onAwait(expression)
        )
      }
      return ts.visitEachChild(_, visitor, ts.nullTransformationContext)
    }
    const generatorBody = visitor(node.body!)

    const generator = ts.factory.createFunctionExpression(
      undefined,
      ts.factory.createToken(ts.SyntaxKind.AsteriskToken),
      undefined,
      [],
      [],
      undefined,
      generatorBody as any // NOTE(mattia): intended, to use same routine for both ConciseBody and Body
    )

    const effectGenCallExp = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier(effectModuleName),
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
  }
}

export function addReturnTypeAnnotation(
  ts: TypeScriptApi,
  changes: ts.textChanges.ChangeTracker
) {
  return (
    sourceFile: ts.SourceFile,
    declaration:
      | ts.FunctionDeclaration
      | ts.FunctionExpression
      | ts.ArrowFunction
      | ts.MethodDeclaration,
    typeNode: ts.TypeNode
  ) => {
    const closeParen = ts.findChildOfKind(declaration, ts.SyntaxKind.CloseParenToken, sourceFile)
    const needParens = ts.isArrowFunction(declaration) && closeParen === undefined
    const endNode = needParens ? declaration.parameters[0] : closeParen
    if (endNode) {
      if (needParens) {
        changes.insertNodeBefore(
          sourceFile,
          endNode,
          ts.factory.createToken(ts.SyntaxKind.OpenParenToken)
        )
        changes.insertNodeAfter(
          sourceFile,
          endNode,
          ts.factory.createToken(ts.SyntaxKind.CloseParenToken)
        )
      }
      changes.insertNodeAt(sourceFile, endNode.end, typeNode, { prefix: ": " })
    }
  }
}

export function removeReturnTypeAnnotation(
  ts: TypeScriptApi,
  changes: ts.textChanges.ChangeTracker
) {
  return (
    sourceFile: ts.SourceFile,
    declaration:
      | ts.FunctionDeclaration
      | ts.FunctionExpression
      | ts.ArrowFunction
      | ts.MethodDeclaration
  ) => {
    const closeParen = ts.findChildOfKind(declaration, ts.SyntaxKind.CloseParenToken, sourceFile)
    const needParens = ts.isArrowFunction(declaration) && closeParen === undefined
    const endNode = needParens ? declaration.parameters[0] : closeParen
    if (endNode && declaration.type) {
      changes.deleteRange(sourceFile, { pos: endNode.end, end: declaration.type.end })
    }
  }
}

export function findImportedModuleIdentifier(ts: TypeScriptApi) {
  return (test: (node: ts.Node) => boolean) =>
  (sourceFile: ts.SourceFile): Option.Option<ts.Identifier> => {
    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement)) continue
      const importClause = statement.importClause
      if (!importClause) continue
      const namedBindings = importClause.namedBindings
      if (!namedBindings) continue
      if (ts.isNamespaceImport(namedBindings)) {
        if (test(namedBindings.name)) return Option.some(namedBindings.name)
      } else if (ts.isNamedImports(namedBindings)) {
        for (const importSpecifier of namedBindings.elements) {
          if (test(importSpecifier.name)) return Option.some(importSpecifier.name)
        }
      }
    }
    return Option.none()
  }
}

export function simplifyTypeNode(
  ts: TypeScriptApi
) {
  function collectCallable(
    typeNode: ts.TypeNode
  ): Option.Option<Array<ts.CallSignatureDeclaration>> {
    // (() => 1) -> skip to inner node
    if (ts.isParenthesizedTypeNode(typeNode)) return collectCallable(typeNode.type)
    // () => 1 -> convert to call signature
    if (ts.isFunctionTypeNode(typeNode)) {
      return Option.some([
        ts.factory.createCallSignature(typeNode.typeParameters, typeNode.parameters, typeNode.type)
      ])
    }
    // { ... } -> if every member is callsignature, return a merge of all of those
    if (ts.isTypeLiteralNode(typeNode)) {
      const allCallSignatures = typeNode.members.every(ts.isCallSignatureDeclaration)
      if (allCallSignatures) {
        return Option.some(typeNode.members as any as Array<ts.CallSignatureDeclaration>)
      }
    }
    // ... & ... -> if both are callable, return merge of both
    if (ts.isIntersectionTypeNode(typeNode)) {
      const members = typeNode.types.map(collectCallable)
      if (members.every(Option.isSome)) {
        return Option.some(members.map((_) => Option.isSome(_) ? _.value : []).flat())
      }
    }

    return Option.none()
  }

  return (typeNode: ts.TypeNode) => {
    const callSignatures = collectCallable(typeNode)
    if (Option.isSome(callSignatures) && callSignatures.value.length > 1) {
      return ts.factory.createTypeLiteralNode(callSignatures.value)
    }
    return typeNode
  }
}

export function isPipeCall(ts: TypeScriptApi) {
  return (node: ts.Node): node is ts.CallExpression => {
    if (!ts.isCallExpression(node)) return false
    const expression = node.expression
    if (!ts.isIdentifier(expression)) return false
    if (expression.text !== "pipe") return false
    return true
  }
}

export function asDataFirstExpression(ts: TypeScriptApi, checker: ts.TypeChecker) {
  return (node: ts.Node, self: ts.Expression): Option.Option<ts.CallExpression> => {
    if (!ts.isCallExpression(node)) return Option.none()
    const signature = checker.getResolvedSignature(node)
    if (!signature) return Option.none()
    const callSignatures = checker.getTypeAtLocation(node.expression).getCallSignatures()
    for (let i = 0; i < callSignatures.length; i++) {
      const callSignature = callSignatures[i]
      if (callSignature.parameters.length === node.arguments.length + 1) {
        return Option.some(
          ts.factory.createCallExpression(
            node.expression,
            [],
            [self].concat(node.arguments)
          )
        )
      }
    }
    return Option.none()
  }
}

export function deterministicTypeOrder(ts: TypeScriptApi, typeChecker: ts.TypeChecker) {
  return Order.make((a: ts.Type, b: ts.Type) => {
    const aName = typeChecker.typeToString(a)
    const bName = typeChecker.typeToString(b)
    if (aName < bName) return -1
    if (aName > bName) return 1
    return 0
  })
}

export function tryPreserveDeclarationSemantics(ts: TypeScriptApi) {
  return (nodeToReplace: ts.Node, node: ts.Node) => {
    // new node should be an expression!
    if (!ts.isExpression(node)) return node
    // ok, we need to replace. is that a method or a function?
    if (ts.isFunctionDeclaration(nodeToReplace)) {
      // I need a name!!!
      if (!nodeToReplace.name) return node
      return ts.factory.createVariableStatement(
        nodeToReplace.modifiers,
        ts.factory.createVariableDeclarationList(
          [ts.factory.createVariableDeclaration(
            nodeToReplace.name,
            undefined,
            undefined,
            node
          )],
          ts.NodeFlags.Const
        )
      )
    } else if (ts.isMethodDeclaration(nodeToReplace)) {
      return ts.factory.createPropertyDeclaration(
        nodeToReplace.modifiers,
        nodeToReplace.name,
        undefined,
        undefined,
        node
      )
    }
    // I don't know what else to do!
    return node
  }
}
