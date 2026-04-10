// @effect-diagnostics deterministicKeys:error
// @test-config { "keyPatterns": [ { "target": "service", "pattern": "default-hashed" }, { "target": "error", "pattern": "default-hashed" } ] }
import { Context, Data } from "effect"

export class ExpectedServiceIdentifier
  extends Context.Service<ExpectedServiceIdentifier, {}>()("ExpectedServiceIdentifier")
{}

export class ErrorA extends Data.TaggedError("ErrorA")<{}> {}
