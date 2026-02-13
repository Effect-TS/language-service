// @effect-diagnostics deterministicKeys:error
// @test-config { "keyPatterns": [ { "target": "service", "pattern": "package-identifier" }, { "target": "error", "pattern": "package-identifier" } ] }
import { ServiceMap, Data } from "effect"

export class ExpectedServiceIdentifier
  extends ServiceMap.Service<ExpectedServiceIdentifier, {}>()("ExpectedServiceIdentifier")
{}

export class ErrorA extends Data.TaggedError("ErrorA")<{}> {}
