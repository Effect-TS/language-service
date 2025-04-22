import * as ReadonlyArray from "effect/Array"
import * as Data from "effect/Data"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as Nano from "./Nano.js"
import * as TypeScriptApi from "./TypeScriptApi.js"

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
): Nano.Nano<Array<ts.Node>> {
  return Nano.sync(() => {
    let result = ReadonlyArray.empty<ts.Node>()
    let parent = node
    while (parent) {
      if (parent.end >= textRange.end) {
        result = pipe(result, ReadonlyArray.append(parent))
      }
      parent = parent.parent
    }
    return result
  })
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
  sourceFile: ts.SourceFile,
  textRange: ts.TextRange
): Nano.Nano<Array<ts.Node>, never, TypeScriptApi.TypeScriptApi> {
  return Nano.gen(function*() {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const precedingToken = ts.findPrecedingToken(textRange.pos, sourceFile)
    if (!precedingToken) return ReadonlyArray.empty<ts.Node>()
    return yield* collectSelfAndAncestorNodesInRange(precedingToken, textRange)
  })
}

export class NodeNotFoundError
  extends Data.TaggedError("@effect/language-service/NodeNotFoundError")<{}>
{}

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
  sourceFile: ts.SourceFile,
  position: number
): Nano.Nano<ts.Node, NodeNotFoundError, TypeScriptApi.TypeScriptApi> {
  return Nano.gen(function*() {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    function find(node: ts.Node): ts.Node | undefined {
      if (position >= node.getStart() && position < node.getEnd()) {
        // If the position is within this node, keep traversing its children
        return ts.forEachChild(node, find) || node
      }
      return undefined
    }
    const result = find(sourceFile)
    if (!result) return yield* Nano.fail(new NodeNotFoundError())
    return result
  })
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
  sourceFile: ts.SourceFile,
  textRange: ts.TextRange
) {
  return Nano.gen(function*() {
    const nodeAtPosition = yield* Nano.option(findNodeAtPosition(sourceFile, textRange.pos))
    if (Option.isNone(nodeAtPosition)) return ReadonlyArray.empty<ts.Node>()
    return yield* collectSelfAndAncestorNodesInRange(nodeAtPosition.value, textRange)
  })
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
  node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  effectModuleName: string,
  onAwait: (expression: ts.Expression) => ts.Expression
) {
  return Nano.gen(function*() {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

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
  })
}

export function addReturnTypeAnnotation(
  sourceFile: ts.SourceFile,
  declaration:
    | ts.FunctionDeclaration
    | ts.FunctionExpression
    | ts.ArrowFunction
    | ts.MethodDeclaration,
  typeNode: ts.TypeNode
) {
  return Nano.gen(function*() {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const changes = yield* Nano.service(TypeScriptApi.ChangeTracker)

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
  })
}

export function removeReturnTypeAnnotation(
  sourceFile: ts.SourceFile,
  declaration:
    | ts.FunctionDeclaration
    | ts.FunctionExpression
    | ts.ArrowFunction
    | ts.MethodDeclaration
) {
  return Nano.gen(function*() {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const changes = yield* Nano.service(TypeScriptApi.ChangeTracker)

    const closeParen = ts.findChildOfKind(declaration, ts.SyntaxKind.CloseParenToken, sourceFile)
    const needParens = ts.isArrowFunction(declaration) && closeParen === undefined
    const endNode = needParens ? declaration.parameters[0] : closeParen
    if (endNode && declaration.type) {
      changes.deleteRange(sourceFile, { pos: endNode.end, end: declaration.type.end })
    }
  })
}

export class ImportModuleIdentifierNotFoundError
  extends Data.TaggedError("@effect/language-service/ImportModuleIdentifierNotFoundError")<{}>
{}

export function findImportedModuleIdentifier<E = never, R = never>(
  sourceFile: ts.SourceFile,
  test: (node: ts.Node) => Nano.Nano<boolean, E, R>
) {
  return Nano.gen(function*() {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement)) continue
      const importClause = statement.importClause
      if (!importClause) continue
      const namedBindings = importClause.namedBindings
      if (!namedBindings) continue
      if (ts.isNamespaceImport(namedBindings)) {
        if (yield* test(namedBindings.name)) return (namedBindings.name)
      } else if (ts.isNamedImports(namedBindings)) {
        for (const importSpecifier of namedBindings.elements) {
          if (yield* test(importSpecifier.name)) return (importSpecifier.name)
        }
      }
    }
    return yield* Nano.fail(new ImportModuleIdentifierNotFoundError())
  })
}

export function simplifyTypeNode(typeNode: ts.TypeNode) {
  function collectCallable(
    ts: TypeScriptApi.TypeScriptApi,
    typeNode: ts.TypeNode
  ): Option.Option<Array<ts.CallSignatureDeclaration>> {
    // (() => 1) -> skip to inner node
    if (ts.isParenthesizedTypeNode(typeNode)) return collectCallable(ts, typeNode.type)
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
      const members = typeNode.types.map((node) => collectCallable(ts, node))
      if (members.every(Option.isSome)) {
        return Option.some(members.map((_) => Option.isSome(_) ? _.value : []).flat())
      }
    }

    return Option.none()
  }

  return Nano.gen(function*() {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const callSignatures = collectCallable(ts, typeNode)
    if (Option.isSome(callSignatures) && callSignatures.value.length > 1) {
      return ts.factory.createTypeLiteralNode(callSignatures.value)
    }
    return typeNode
  })
}

export function tryPreserveDeclarationSemantics(nodeToReplace: ts.Node, node: ts.Node) {
  return Nano.gen(function*() {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

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
  })
}
