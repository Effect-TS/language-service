import * as Array from "effect/Array"
import { hasProperty } from "effect/Predicate"
import type * as ts from "typescript"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeCheckerApi from "../core/TypeCheckerApi"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils"
import * as TypeScriptApi from "../core/TypeScriptApi"

export const durationInput = LSP.createCompletion({
  name: "durationInput",
  apply: Nano.fn("durationInput")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    let isInString: boolean = false
    const previousToken = ts.findPrecedingToken(position, sourceFile)
    if (previousToken && ts.isStringTextContainingNode(previousToken)) {
      const start = ts.getTokenPosOfNode(previousToken, sourceFile)
      const end = previousToken.end

      // To be "in" one of these literals, the position has to be:
      //   1. entirely within the token text.
      //   2. at the end position of an unterminated token.
      //   3. at the end of a regular expression (due to trailing flags like '/foo/g').
      if (start < position && position < end) {
        isInString = true
      }

      if (position === end) {
        isInString = !!(previousToken as ts.LiteralExpression).isUnterminated
      }

      if (isInString && ts.isExpression(previousToken)) {
        const type = typeChecker.getContextualType(previousToken)

        if (type) {
          // the type is an union
          if (!typeCheckerUtils.isUnion(type)) return []
          // and has members with nanos, millis, etc...
          for (const member of type.types) {
            if (member.flags & ts.TypeFlags.TemplateLiteral) {
              if (
                hasProperty(member, "texts") && Array.isArray(member.texts) && member.texts.length === 2 &&
                String(member.texts[1]).trim() === "nanos"
              ) {
                // nanos?|micros?|millis?|seconds?|minutes?|hours?|days?|weeks
                return ["nanos", "micros", "millis", "seconds", "minutes", "hours", "days", "weeks"].map(
                  (name) => ({
                    name,
                    kind: ts.ScriptElementKind.string,
                    insertText: `${"${0}"} ${name}`,
                    isSnippet: true
                  })
                ) satisfies Array<LSP.CompletionEntryDefinition>
              }
            }
          }
        }
      }
    }

    return []
  })
})
