// @effect-diagnostics serviceNotAsClass:warning
import { Context } from "effect"

interface ConfigService {}

// Flagged: const variable with Context.Service
const Config = Context.Service<ConfigService>("Config")

// Flagged: exported const variable with Context.Service
interface ArtifactStoreService {}
export const ArtifactStore = Context.Service<ArtifactStoreService>("@my-app/ArtifactStore")

// Not flagged: correct class extends form
class MyService extends Context.Service<MyService, { port: number }>()("MyService") {}

// Not flagged: non-Context.Service const
const x = 42
