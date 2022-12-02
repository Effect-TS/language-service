import rule from "@effect/language-service/eslint-rules/no-curry-arrow"
import { ruleTester } from "@effect/language-service/test/utils"

ruleTester.run("no-curry-arrow", rule, {
  valid: [
    `
    import * as T from "@effect/io/Effect"
    import { pipe } from "@fp-ts/data/Function"
    
    const test = pipe(
      T.succeed("Hello"),
      T.tap(T.log)
    )   
    `
  ],
  invalid: [{
    code: `
    import * as T from "@effect/io/Effect"
    import { pipe } from "@fp-ts/data/Function"
    
    const test = pipe(
      T.succeed("Hello"),
      T.tap((_) => T.log(_))
    )    
    `,
    errors: [{ line: 7, messageId: "noCurryArrow" }]
  }]
})
