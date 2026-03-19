// @effect-diagnostics *:off
// @effect-diagnostics deterministicKeys:warning
// @test-config { "keyPatterns": [{ "target": "service", "pattern": "default" }] }
import { ServiceMap } from "effect"

export class RenamedService
  extends ServiceMap.Service<RenamedService, {}>()("CustomIdentifier") {}
