import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import { hasProperty, isFunction, isObject, isString } from "effect/Predicate"
import type ts from "typescript"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export interface ModuleWithPackageInfo {
  name: string
  version: string
  hasEffectInPeerDependencies: boolean
  contents: any
  packageDirectory: string
  referencedPackages: Array<string>
  exportsKeys: Array<string>
}

export interface TypeScriptUtils {
  parsePackageContentNameAndVersionFromScope: (v: unknown) => ModuleWithPackageInfo | undefined
  findNodeWithLeadingCommentAtPosition: (
    sourceFile: ts.SourceFile,
    position: number
  ) => { node: ts.Node; commentRange: ts.CommentRange } | undefined
  getCommentAtPosition: (sourceFile: ts.SourceFile, pos: number) => ts.CommentRange | undefined
  makeGetModuleSpecifier: () =>
    | ((
      compilerOptions: ts.CompilerOptions,
      importingSourceFile: ts.SourceFile,
      importingSourceFileName: string,
      toFileName: string,
      host: any,
      options?: any
    ) => string)
    | undefined
  resolveModulePattern: (sourceFile: ts.SourceFile, pattern: string) => Array<string>
  getAncestorNodesInRange: (sourceFile: ts.SourceFile, textRange: ts.TextRange) => Array<ts.Node>
  findImportedModuleIdentifierByPackageAndNameOrBarrel: (
    sourceFile: ts.SourceFile,
    packageName: string,
    moduleName: string
  ) => string | undefined
  simplifyTypeNode: (typeNode: ts.TypeNode) => ts.TypeNode
  createEffectGenCallExpressionWithBlock: (
    effectModuleIdentifierName: string,
    statement: ts.Statement | Array<ts.Statement>
  ) => ts.CallExpression
  createReturnYieldStarStatement: (
    expr: ts.Expression
  ) => ts.ReturnStatement
  transformAsyncAwaitToEffectGen: (
    node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
    effectModuleName: string,
    onAwait: (expression: ts.Expression) => ts.Expression
  ) => ts.Node
  tryPreserveDeclarationSemantics: (
    nodeToReplace: ts.Node,
    node: ts.Node
  ) => ts.Node
  isNodeInRange: (textRange: ts.TextRange) => (node: ts.Node) => boolean
  toTextRange: (position: number) => ts.TextRange
  parseDataForExtendsClassCompletion: (sourceFile: ts.SourceFile, position: number) => {
    accessedObject: ts.Identifier
    classDeclaration: ts.ClassDeclaration
    className: ts.Identifier
    replacementSpan: ts.TextSpan
  } | undefined
  parseAccessedExpressionForCompletion: (sourceFile: ts.SourceFile, position: number) => {
    accessedObject: ts.Node
    outerNode: ts.Node
    replacementSpan: ts.TextSpan
  } | undefined
}
export const TypeScriptUtils = Nano.Tag<TypeScriptUtils>("TypeScriptUtils")

export const nanoLayer = <A, E, R>(
  fa: Nano.Nano<A, E, R>
) =>
  pipe(
    Nano.service(TypeScriptApi.TypeScriptApi),
    Nano.flatMap((ts) => pipe(fa, Nano.provideService(TypeScriptUtils, makeTypeScriptUtils(ts))))
  )

export function makeTypeScriptUtils(ts: TypeScriptApi.TypeScriptApi): TypeScriptUtils {
  /**
   * Parse internal package info from a scope
   */
  function parsePackageContentNameAndVersionFromScope(v: unknown): ModuleWithPackageInfo | undefined {
    if (!isObject(v)) return
    if (!hasProperty(v, "packageJsonScope")) return
    if (!v.packageJsonScope) return
    const packageJsonScope = v.packageJsonScope
    if (!hasProperty(packageJsonScope, "contents")) return
    if (!hasProperty(packageJsonScope.contents, "packageJsonContent")) return
    const packageJsonContent = packageJsonScope.contents.packageJsonContent
    if (!hasProperty(packageJsonContent, "name")) return
    if (!hasProperty(packageJsonContent, "version")) return
    if (!hasProperty(packageJsonScope, "packageDirectory")) return
    if (!isString(packageJsonScope.packageDirectory)) return
    const { name, version } = packageJsonContent
    if (!isString(name)) return
    if (!isString(version)) return
    const hasEffectInPeerDependencies = hasProperty(packageJsonContent, "peerDependencies") &&
      isObject(packageJsonContent.peerDependencies) &&
      hasProperty(packageJsonContent.peerDependencies, "effect")

    const referencedPackages = Object.keys({
      ...(hasProperty(packageJsonContent, "dependencies") && isObject(packageJsonContent.dependencies)
        ? packageJsonContent.dependencies
        : {}),
      ...(hasProperty(packageJsonContent, "peerDependencies") && isObject(packageJsonContent.peerDependencies)
        ? packageJsonContent.peerDependencies
        : {}),
      ...(hasProperty(packageJsonContent, "devDependencies") && isObject(packageJsonContent.devDependencies)
        ? packageJsonContent.devDependencies
        : {})
    })

    const exportsKeys = Object.keys(
      hasProperty(packageJsonContent, "exports") && isObject(packageJsonContent.exports)
        ? packageJsonContent.exports
        : {}
    )

    return {
      name: name.toLowerCase(),
      version: version.toLowerCase(),
      hasEffectInPeerDependencies,
      contents: packageJsonContent,
      packageDirectory: packageJsonScope.packageDirectory,
      referencedPackages,
      exportsKeys
    }
  }

  function resolveModulePattern(sourceFile: ts.SourceFile, pattern: string) {
    if (pattern.indexOf("*") === -1) return [pattern.toLowerCase()]
    const packageJsonScope = parsePackageContentNameAndVersionFromScope(sourceFile)
    const referencedPackages: Array<string> = []
    for (const statement of sourceFile.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
        const moduleSpecifier = statement.moduleSpecifier.text.toLowerCase()
        const packageName = moduleSpecifier.startsWith("@")
          ? moduleSpecifier.split("/", 2).join("/")
          : moduleSpecifier.split("/", 1).join("/")
        referencedPackages.push(packageName)
      }
    }
    return pipe(
      referencedPackages.concat(packageJsonScope?.referencedPackages || []),
      Array.dedupe,
      Array.map((packageName) => packageName.toLowerCase()),
      Array.filter((packageName) =>
        pattern.endsWith("*") &&
        packageName.startsWith(pattern.toLowerCase().substring(0, pattern.length - 1))
      )
    )
  }

  function makeGetModuleSpecifier() {
    if (
      !(hasProperty(ts, "moduleSpecifiers") && hasProperty(ts.moduleSpecifiers, "getModuleSpecifier") &&
        isFunction(ts.moduleSpecifiers.getModuleSpecifier))
    ) return
    const _internal = ts.moduleSpecifiers.getModuleSpecifier
    return (
      compilerOptions: ts.CompilerOptions,
      importingSourceFile: ts.SourceFile,
      importingSourceFileName: string,
      toFileName: string,
      host: any,
      options?: any
    ): string => {
      return _internal(
        compilerOptions,
        importingSourceFile,
        importingSourceFileName,
        toFileName,
        host,
        options
      )
    }
  }

  function findNodeWithLeadingCommentAtPosition(sourceFile: ts.SourceFile, position: number) {
    const sourceText = sourceFile.text
    let result: { node: ts.Node; commentRange: ts.CommentRange } | undefined

    function find(node: ts.Node) {
      // Check leading comments
      const leading = ts.getLeadingCommentRanges(sourceText, node.getFullStart())
      if (leading) {
        for (const commentRange of leading) {
          if (commentRange.pos <= position && position < commentRange.end) {
            // we found the comment
            result = { node, commentRange }
            return
          }
        }
      }
      // Continue traversing only if the position is within this node
      if (node.getFullStart() <= position && position < node.getEnd()) {
        node.forEachChild(find)
      }
    }
    find(sourceFile)
    return result
  }

  /**
   * Collects the given node and all its ancestor nodes that fully contain the specified TextRange.
   *
   * This function starts from the provided node and traverses up the AST, collecting
   * the node itself and its ancestors that encompass the given range.
   */
  function collectSelfAndAncestorNodesInRange(
    node: ts.Node,
    textRange: ts.TextRange
  ): Array<ts.Node> {
    let result = Array.empty<ts.Node>()
    let parent = node
    while (parent) {
      if (parent.end >= textRange.end) {
        result = pipe(result, Array.append(parent))
      }
      parent = parent.parent
    }
    return result
  }

  /**
   * Finds the deepest AST node at the specified position within the given SourceFile.
   *
   * This function traverses the AST to locate the node that contains the given position.
   * If multiple nodes overlap the position, it returns the most specific (deepest) node.
   */
  function findNodeAtPosition(
    sourceFile: ts.SourceFile,
    position: number
  ) {
    function find(node: ts.Node): ts.Node | undefined {
      if (position >= node.getStart() && position < node.getEnd()) {
        // If the position is within this node, keep traversing its children
        return ts.forEachChild(node, find) || node
      }
      return undefined
    }

    return find(sourceFile)
  }

  /**
   * Collects the node at the given position and all its ancestor nodes
   * that fully contain the specified TextRange.
   *
   * This function starts from the closest token at the given position
   * and traverses up the AST, collecting nodes that encompass the range.
   *
   * @param sourceFile - The TypeScript SourceFile to search within.
   * @param textRange - The range of text to use for filtering nodes.
   * @returns An array of `ts.Node` containing the range.
   */
  function getAncestorNodesInRange(
    sourceFile: ts.SourceFile,
    textRange: ts.TextRange
  ) {
    const nodeAtPosition = findNodeAtPosition(sourceFile, textRange.pos)
    if (!nodeAtPosition) return Array.empty<ts.Node>()
    return collectSelfAndAncestorNodesInRange(nodeAtPosition, textRange)
  }

  function getCommentAtPosition(
    sourceFile: ts.SourceFile,
    pos: number
  ) {
    const token = findNodeAtPosition(sourceFile, pos)

    if (
      token === undefined || token.kind === ts.SyntaxKind.JsxText ||
      pos >= token.end - (ts.tokenToString(token.kind) || "").length
    ) {
      return
    }
    const startPos = token.pos === 0 ? (ts.getShebang(sourceFile.text) || "").length : token.pos

    if (startPos === 0) return

    const result = ts.forEachTrailingCommentRange(sourceFile.text, startPos, isCommentInRange, pos) ||
      ts.forEachLeadingCommentRange(sourceFile.text, startPos, isCommentInRange, pos)

    return result
  }

  function isCommentInRange(
    pos: number,
    end: number,
    kind: ts.CommentKind,
    _nl: boolean,
    at: number
  ): ts.CommentRange | undefined {
    return at >= pos && at < end ? { pos, end, kind } : undefined
  }

  /**
   * Ensures value is a text range
   */
  function toTextRange(positionOrRange: number | ts.TextRange): ts.TextRange {
    return typeof positionOrRange === "number"
      ? { end: positionOrRange, pos: positionOrRange }
      : positionOrRange
  }

  function isNodeInRange(textRange: ts.TextRange) {
    return (node: ts.Node) => node.pos <= textRange.pos && node.end >= textRange.end
  }

  function transformAsyncAwaitToEffectGen(
    node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
    effectModuleName: string,
    onAwait: (expression: ts.Expression) => ts.Expression
  ) {
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

    const effectGenCallExp = createEffectGenCallExpression(effectModuleName, generatorBody)

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

  function findImportedModuleIdentifier(
    sourceFile: ts.SourceFile,
    test: (
      node: ts.Node,
      fromModule: ts.Expression,
      importProperty: Option.Option<ts.ModuleExportName>
    ) => boolean
  ) {
    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement)) continue
      const importClause = statement.importClause
      if (!importClause) continue
      const namedBindings = importClause.namedBindings
      if (!namedBindings) continue
      if (ts.isNamespaceImport(namedBindings)) {
        if (test(namedBindings.name, statement.moduleSpecifier, Option.none())) {
          return (namedBindings.name.text)
        }
      } else if (ts.isNamedImports(namedBindings)) {
        for (const importSpecifier of namedBindings.elements) {
          const importProperty = Option.fromNullable(importSpecifier.propertyName).pipe(
            Option.orElse(() => Option.some(importSpecifier.name))
          )
          if (test(importSpecifier.name, statement.moduleSpecifier, importProperty)) {
            return (importSpecifier.name.text)
          }
        }
      }
    }
  }

  function findImportedModuleIdentifierByPackageAndNameOrBarrel(
    sourceFile: ts.SourceFile,
    packageName: string,
    moduleName: string
  ) {
    return findImportedModuleIdentifier(
      sourceFile,
      (_, fromModule, importProperty) => {
        // import * as Module from "package/module"
        if (
          Option.isNone(importProperty) && ts.isStringLiteral(fromModule) &&
          fromModule.text === packageName + "/" + moduleName
        ) {
          return true
        }
        // import { Module } from "package"
        // or
        // import { Module as M } from "package"
        if (
          Option.isSome(importProperty) && ts.isIdentifier(importProperty.value) &&
          importProperty.value.text === moduleName && ts.isStringLiteral(fromModule) &&
          fromModule.text === packageName
        ) {
          return true
        }
        return false
      }
    )
  }

  function simplifyTypeNode(typeNode: ts.TypeNode) {
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
        const members = typeNode.types.map((node) => collectCallable(node))
        if (members.every(Option.isSome)) {
          return Option.some(members.map((_) => Option.isSome(_) ? _.value : []).flat())
        }
      }

      return Option.none()
    }

    const callSignatures = collectCallable(typeNode)
    if (Option.isSome(callSignatures) && callSignatures.value.length > 1) {
      return ts.factory.createTypeLiteralNode(callSignatures.value)
    }
    return typeNode
  }

  function tryPreserveDeclarationSemantics(nodeToReplace: ts.Node, node: ts.Node) {
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

  function parseAccessedExpressionForCompletion(
    sourceFile: ts.SourceFile,
    position: number
  ) {
    // first, we find the preceding token
    const precedingToken = ts.findPrecedingToken(position, sourceFile, undefined, true)
    if (!precedingToken) return

    let accessedObject = precedingToken
    let replacementSpan = ts.createTextSpan(position, 0)
    let outerNode: ts.Node = precedingToken
    if (
      ts.isIdentifier(precedingToken) && precedingToken.parent &&
      ts.isPropertyAccessExpression(precedingToken.parent)
    ) {
      // we are in a "extends Schema.Tag|"
      replacementSpan = ts.createTextSpan(
        precedingToken.parent.getStart(sourceFile),
        precedingToken.end - precedingToken.parent.getStart(sourceFile)
      )
      accessedObject = precedingToken.parent.expression
      outerNode = precedingToken.parent
    } else if (
      ts.isToken(precedingToken) && precedingToken.kind === ts.SyntaxKind.DotToken &&
      ts.isPropertyAccessExpression(precedingToken.parent)
    ) {
      // we are in a "extends Schema.|"
      replacementSpan = ts.createTextSpan(
        precedingToken.parent.getStart(sourceFile),
        precedingToken.end - precedingToken.parent.getStart(sourceFile)
      )
      accessedObject = precedingToken.parent.expression
      outerNode = precedingToken.parent
    } else if (ts.isIdentifier(precedingToken) && precedingToken.parent) {
      // we are in a "extends Schema|"
      replacementSpan = ts.createTextSpan(
        precedingToken.getStart(sourceFile),
        precedingToken.end - precedingToken.getStart(sourceFile)
      )
      accessedObject = precedingToken
      outerNode = precedingToken
    } else {
      return
    }
    return { accessedObject, outerNode, replacementSpan }
  }

  function parseDataForExtendsClassCompletion(
    sourceFile: ts.SourceFile,
    position: number
  ) {
    const maybeInfos = parseAccessedExpressionForCompletion(sourceFile, position)
    if (!maybeInfos) return
    const { accessedObject, outerNode, replacementSpan } = maybeInfos

    if (!ts.isIdentifier(accessedObject)) return

    // go up allowed nodes until we find the class declaration
    let classDeclaration: ts.Node = outerNode.parent
    while (
      ts.isExpressionWithTypeArguments(classDeclaration) || ts.isHeritageClause(classDeclaration)
    ) {
      if (!classDeclaration.parent) break
      classDeclaration = classDeclaration.parent
    }
    if (!ts.isClassDeclaration(classDeclaration)) return

    if (!classDeclaration.name) return

    return {
      accessedObject,
      classDeclaration,
      className: classDeclaration.name,
      replacementSpan
    } as const
  }

  function createEffectGenCallExpression(
    effectModuleIdentifierName: string,
    node: ts.Node
  ) {
    const generator = ts.factory.createFunctionExpression(
      undefined,
      ts.factory.createToken(ts.SyntaxKind.AsteriskToken),
      undefined,
      [],
      [],
      undefined,
      node as any // NOTE(mattia): intended, to use same routine for both ConciseBody and Body
    )

    return ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier(effectModuleIdentifierName),
        "gen"
      ),
      undefined,
      [generator]
    )
  }

  function createEffectGenCallExpressionWithBlock(
    effectModuleIdentifierName: string,
    statement: ts.Statement | Array<ts.Statement>
  ) {
    return createEffectGenCallExpression(
      effectModuleIdentifierName,
      ts.factory.createBlock(Array.isArray(statement) ? statement : [statement], false)
    )
  }

  function createReturnYieldStarStatement(
    expr: ts.Expression
  ) {
    return ts.factory.createReturnStatement(
      ts.factory.createYieldExpression(
        ts.factory.createToken(ts.SyntaxKind.AsteriskToken),
        expr
      )
    )
  }

  return {
    parsePackageContentNameAndVersionFromScope,
    resolveModulePattern,
    findNodeWithLeadingCommentAtPosition,
    getCommentAtPosition,
    getAncestorNodesInRange,
    toTextRange,
    isNodeInRange,
    transformAsyncAwaitToEffectGen,
    findImportedModuleIdentifierByPackageAndNameOrBarrel,
    simplifyTypeNode,
    tryPreserveDeclarationSemantics,
    parseDataForExtendsClassCompletion,
    createEffectGenCallExpressionWithBlock,
    createReturnYieldStarStatement,
    makeGetModuleSpecifier,
    parseAccessedExpressionForCompletion
  }
}
