// @effect-diagnostics *:off
// @effect-diagnostics nodeBuiltinImport:warning
import fs from "node:fs"

export const preview = fs.readFileSync
