// @effect-diagnostics deterministicKeys:error
// @test-config { "keyPatterns": [ { "target": "service", "pattern": "package-identifier" }, { "target": "error", "pattern": "package-identifier" } ] }
import * as Context from "effect/Context"
import * as Data from "effect/Data"

export class ExpectedServiceIdentifier
  extends Context.Tag("ExpectedServiceIdentifier")<ExpectedServiceIdentifier, {}>()
{}

export class ErrorA extends Data.TaggedError("ErrorA")<{}> {}
