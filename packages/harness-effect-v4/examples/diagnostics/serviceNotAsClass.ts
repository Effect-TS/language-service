// @effect-diagnostics serviceNotAsClass:warning
import { ServiceMap } from "effect"

interface ConfigService {}

// Flagged: const variable with ServiceMap.Service
const Config = ServiceMap.Service<ConfigService>("Config")

// Flagged: exported const variable with ServiceMap.Service
interface ArtifactStoreService {}
export const ArtifactStore = ServiceMap.Service<ArtifactStoreService>("@my-app/ArtifactStore")

// Not flagged: correct class extends form
class MyService extends ServiceMap.Service<MyService, { port: number }>()("MyService") {}

// Not flagged: non-ServiceMap.Service const
const x = 42
