import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

interface ParsedEffectFn {
  readonly kind: "fn" | "fnUntraced"
  readonly generatorFunction: ts.FunctionExpression | undefined
  readonly effectModule: ts.Node
  readonly pipeArguments: ReadonlyArray<ts.Expression>
  readonly traceExpression: ts.Expression | undefined
}

export const effectFnIife = LSP.createDiagnostic({
  name: "effectFnIife",
  code: 46,
  description:
    "Effect.fn or Effect.fnUntraced is called as an IIFE (Immediately Invoked Function Expression). Use Effect.gen instead.",
  severity: "warning",
  apply: Nano.fn("effectFnIife.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    const sourceEffectModuleName = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "effect",
      "Effect"
    ) || "Effect"

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      // We're looking for CallExpression()
      // where the callee is also a CallExpression that matches Effect.fn patterns
      if (!ts.isCallExpression(node)) continue

      // The expression being called must also be a CallExpression
      // This means we have something()() - an IIFE pattern
      const innerCall = node.expression
      if (!ts.isCallExpression(innerCall)) continue

      // Check if the inner call is an Effect.fn, Effect.fnGen, or Effect.fnUntracedGen

      const parsed = yield* pipe(
        typeParser.effectFnGen(innerCall),
        Nano.map((result): ParsedEffectFn => ({
          kind: "fn",
          effectModule: result.effectModule,
          generatorFunction: result.generatorFunction,
          pipeArguments: result.pipeArguments,
          traceExpression: result.traceExpression
        })),
        Nano.orElse(() =>
          pipe(
            typeParser.effectFnUntracedGen(innerCall),
            Nano.map((result): ParsedEffectFn => ({
              kind: "fnUntraced",
              effectModule: result.effectModule,
              generatorFunction: result.generatorFunction,
              pipeArguments: result.pipeArguments,
              traceExpression: undefined
            }))
          )
        ),
        Nano.orElse(() =>
          pipe(
            typeParser.effectFn(innerCall),
            Nano.map((result): ParsedEffectFn => ({
              kind: "fn",
              effectModule: result.effectModule,
              generatorFunction: undefined,
              pipeArguments: result.pipeArguments,
              traceExpression: result.traceExpression
            }))
          )
        ),
        Nano.option
      )

      if (Option.isNone(parsed)) continue

      const { effectModule, generatorFunction, kind, pipeArguments, traceExpression } = parsed.value
      const effectModuleName = ts.isIdentifier(effectModule as ts.Expression)
        ? ts.idText(effectModule as ts.Identifier)
        : sourceEffectModuleName

      const fixes: Array<LSP.ApplicableDiagnosticDefinitionFix> = []

      // Quick fix: Convert to Effect.gen (only for generator functions with no parameters)
      if (generatorFunction && generatorFunction.parameters.length === 0) {
        fixes.push({
          fixName: "effectFnIife_toEffectGen",
          description: "Convert to Effect.gen",
          apply: Nano.gen(function*() {
            const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

            // Create Effect.gen(function*() { ... })
            const effectGenCall = ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier(effectModuleName),
                "gen"
              ),
              undefined,
              [generatorFunction]
            )

            // If there are pipe arguments, use .pipe() method
            let replacementNode: ts.Expression = effectGenCall
            if (pipeArguments.length > 0) {
              replacementNode = ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(effectGenCall, "pipe"),
                undefined,
                [...pipeArguments]
              )
            }

            changeTracker.replaceNode(sourceFile, node, replacementNode)
          })
        })
      }

      const traceExpressionText = traceExpression
        ? sourceFile.text.slice(traceExpression.pos, traceExpression.end)
        : undefined

      report({
        location: node,
        messageText:
          `${effectModuleName}.${kind} returns a reusable function that can take arguments, but here it's called immediately. Use Effect.gen instead${
            traceExpressionText
              ? ` with Effect.withSpan(${traceExpressionText}) piped in the end to mantain tracing spans`
              : ``
          }.`,
        fixes
      })
    }
  })
})
