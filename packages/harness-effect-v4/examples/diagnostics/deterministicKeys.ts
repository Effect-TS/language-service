// @effect-diagnostics deterministicKeys:error
// @test-config { "keyPatterns": [ { "target": "service", "pattern": "default" }, { "target": "error", "pattern": "default" } ] }
import { Context, Data } from "effect"

export class ExpectedServiceIdentifier
  extends Context.Service<ExpectedServiceIdentifier, {}>()("ExpectedServiceIdentifier")
{}

export class ErrorA extends Data.TaggedError("ErrorA")<{}> {}
