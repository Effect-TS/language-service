import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

type EffectFnResult = {
  readonly call: ts.CallExpression
  readonly fn:
    | ts.ArrowFunction
    | ts.FunctionExpression
}

const getParameterName = (typescript: TypeScriptApi.TypeScriptApi, name: ts.BindingName): string => {
  if (typescript.isIdentifier(name)) {
    return typescript.idText(name)
  }
  return "parameter"
}

const hasOuterContextualFunctionType = (
  typescript: TypeScriptApi.TypeScriptApi,
  typeChecker: ts.TypeChecker,
  typeCheckerUtils: TypeCheckerUtils.TypeCheckerUtils,
  node: ts.CallExpression
): boolean => {
  const contextualType = typeChecker.getContextualType(node)
  if (!contextualType) {
    return false
  }
  return typeCheckerUtils.unrollUnionMembers(contextualType).some((type) =>
    typeChecker.getSignaturesOfType(type, typescript.SignatureKind.Call).length > 0
  )
}

export const effectFnImplicitAny = LSP.createDiagnostic({
  name: "effectFnImplicitAny",
  code: 54,
  description:
    "Mirrors noImplicitAny for unannotated Effect.fn and Effect.fnUntraced callback parameters when no outer contextual function type exists",
  group: "correctness",
  severity: "error",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("effectFnImplicitAny.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const noImplicitAny = program.getCompilerOptions().noImplicitAny ?? program.getCompilerOptions().strict ?? false
    if (!noImplicitAny) {
      return
    }

    const nodeToVisit: Array<ts.Node> = [sourceFile]
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.pop()!
      ts.forEachChild(node, appendNodeToVisit)

      const parsed = yield* pipe(
        typeParser.effectFn(node),
        Nano.map((result): EffectFnResult => ({
          call: result.node as ts.CallExpression,
          fn: result.regularFunction
        })),
        Nano.orElse(() =>
          pipe(
            typeParser.effectFnGen(node),
            Nano.map((result): EffectFnResult => ({
              call: result.node as ts.CallExpression,
              fn: result.generatorFunction
            }))
          )
        ),
        Nano.orElse(() =>
          pipe(
            typeParser.effectFnUntracedGen(node),
            Nano.map((result): EffectFnResult => ({
              call: result.node as ts.CallExpression,
              fn: result.generatorFunction
            }))
          )
        ),
        Nano.orUndefined
      )

      if (!parsed || hasOuterContextualFunctionType(ts, typeChecker, typeCheckerUtils, parsed.call)) {
        continue
      }

      for (const parameter of parsed.fn.parameters) {
        if (parameter.type || parameter.initializer) {
          continue
        }

        const parameterName = getParameterName(ts, parameter.name)

        report({
          location: parameter.name,
          messageText:
            `Parameter '${parameterName}' implicitly has an 'any' type in Effect.fn/Effect.fnUntraced. Add an explicit type annotation or provide a contextual function type.`,
          fixes: []
        })
      }
    }
  })
})
