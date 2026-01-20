// @effect-diagnostics deterministicKeys:error
// @test-config { "keyPatterns": [ { "target": "service", "pattern": "default-hashed" }, { "target": "error", "pattern": "default-hashed" } ] }
import * as Context from "effect/Context"
import * as Data from "effect/Data"

export class ExpectedServiceIdentifier
  extends Context.Tag("ExpectedServiceIdentifier")<ExpectedServiceIdentifier, {}>()
{}

export class ErrorA extends Data.TaggedError("ErrorA")<{}> {}
