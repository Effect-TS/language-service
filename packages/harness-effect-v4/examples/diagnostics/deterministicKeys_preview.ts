// @effect-diagnostics *:off
// @effect-diagnostics deterministicKeys:warning
// @test-config { "keyPatterns": [{ "target": "service", "pattern": "default" }] }
import { Context } from "effect"

export class RenamedService
  extends Context.Service<RenamedService, {}>()("CustomIdentifier") {}
