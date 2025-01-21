import * as Option from "effect/Option"
import { createRefactor } from "../definition.js"

export const wrapWithPipe = createRefactor({
  name: "effect/wrapWithPipe",
  description: "Wrap with pipe",
  apply: () => (sourceFile, textRange) => {
    if (textRange.end - textRange.pos === 0) return Option.none()

    return Option.some({
      kind: "refactor.rewrite.effect.wrapWithPipe",
      description: `Wrap with pipe(...)`,
      apply: (changeTracker) => {
        changeTracker.insertText(sourceFile, textRange.pos, "pipe(")
        changeTracker.insertText(sourceFile, textRange.end, ")")
      }
    })
  }
})
