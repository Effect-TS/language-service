import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

// Property access calls: "object.method" → message
const propCallApis: Record<string, string> = {
  "Date.now": "Prefer using Clock or DateTime from Effect instead of Date.now() inside Effect generators.",
  "console.log": "Prefer using Effect.log or Logger instead of console.log inside Effect generators.",
  "console.warn": "Prefer using Effect.logWarning or Logger instead of console.warn inside Effect generators.",
  "console.error": "Prefer using Effect.logError or Logger instead of console.error inside Effect generators.",
  "console.info": "Prefer using Effect.logInfo or Logger instead of console.info inside Effect generators.",
  "console.debug": "Prefer using Effect.logDebug or Logger instead of console.debug inside Effect generators.",
  "console.trace": "Prefer using Effect.logTrace or Logger instead of console.trace inside Effect generators.",
  "Math.random": "Prefer using the Random service from Effect instead of Math.random() inside Effect generators."
}

// New expressions: "ClassName" → message
const newExprApis: Record<string, string> = {
  "Date": "Prefer using DateTime from Effect instead of new Date() inside Effect generators."
}

// Global function calls: "funcName" → message
const globalCallApis: Record<string, string> = {
  "setTimeout": "Prefer using Effect.sleep or Schedule from Effect instead of setTimeout inside Effect generators.",
  "setInterval": "Prefer using Schedule or Effect.repeat from Effect instead of setInterval inside Effect generators."
}

// All root identifiers we need to resolve for shadowing checks
const rootIdentifiers = new Set([
  "Date",
  "console",
  "Math",
  "setTimeout",
  "setInterval"
])

interface CollectedNode {
  readonly node: ts.Node
  readonly rootIdentifier: ts.Identifier
  readonly rootName: string
  readonly messageText: string
}

export const globalInEffect = LSP.createDiagnostic({
  name: "globalInEffect",
  code: 55,
  description: "Warns when using global APIs inside Effect generators that have Effect-native replacements",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("globalInEffect.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    // Phase 1: plain AST walk to collect matching nodes
    const collected: Array<CollectedNode> = []

    const collectNodes = (node: ts.Node): void => {
      // Property access calls: console.log(...), Date.now(), Math.random()
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression)
      ) {
        const objName = ts.idText(node.expression.expression)
        const methodName = ts.idText(node.expression.name)
        const key = `${objName}.${methodName}`
        const messageText = propCallApis[key]
        if (messageText) {
          collected.push({
            node,
            rootIdentifier: node.expression.expression,
            rootName: objName,
            messageText
          })
        }
      } // New expressions: new Date(), new Date(...)
      else if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression)
      ) {
        const className = ts.idText(node.expression)
        const messageText = newExprApis[className]
        if (messageText) {
          collected.push({
            node,
            rootIdentifier: node.expression,
            rootName: className,
            messageText
          })
        }
      } // Global function calls: setTimeout(...), setInterval(...)
      else if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression)
      ) {
        const funcName = ts.idText(node.expression)
        const messageText = globalCallApis[funcName]
        if (messageText) {
          collected.push({
            node,
            rootIdentifier: node.expression,
            rootName: funcName,
            messageText
          })
        }
      }

      ts.forEachChild(node, collectNodes)
    }
    ts.forEachChild(sourceFile, collectNodes)

    if (collected.length === 0) return

    // Resolve global symbols once for shadowing checks
    const globalSymbols = new Map<string, ts.Symbol>()
    for (const name of rootIdentifiers) {
      const symbol = typeChecker.resolveName(name, undefined, ts.SymbolFlags.Value, false)
      if (symbol) {
        globalSymbols.set(name, symbol)
      }
    }

    // Phase 2: scope check + shadow check for each collected node
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    for (const { messageText, node, rootIdentifier, rootName } of collected) {
      // Shadow check: skip if the identifier doesn't resolve to the global
      const globalSymbol = globalSymbols.get(rootName)
      if (globalSymbol) {
        const localSymbol = typeChecker.getSymbolAtLocation(rootIdentifier)
        const resolvedSymbol = localSymbol && (localSymbol.flags & ts.SymbolFlags.Alias)
          ? typeChecker.getAliasedSymbol(localSymbol)
          : localSymbol
        if (resolvedSymbol !== globalSymbol) continue
      }

      // Scope check: only report inside Effect generators, not nested functions
      const { effectGen, scopeNode } = yield* typeParser.findEnclosingScopes(node)
      if (!effectGen || effectGen.body.statements.length === 0) continue
      if (scopeNode && scopeNode !== effectGen.generatorFunction) continue

      report({
        location: node,
        messageText,
        fixes: []
      })
    }
  })
})
