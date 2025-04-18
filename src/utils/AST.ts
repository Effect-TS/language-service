import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as Order from "effect/Order"
import type ts from "typescript"
import type { TypeScriptApi } from "./TSAPI.js"

/**
 * Gets the closest node that contains given TextRange
 */
export function getNodesContainingRange(
  ts: TypeScriptApi
) {
  return ((sourceFile: ts.SourceFile, textRange: ts.TextRange) => {
    const precedingToken = ts.findPrecedingToken(textRange.pos, sourceFile)
    if (!precedingToken) return ReadonlyArray.empty<ts.Node>()

    let result = ReadonlyArray.empty<ts.Node>()
    let parent = precedingToken
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
