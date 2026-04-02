import * as LSP from "../core/LSP.js"
import { makeProcessEnvApply } from "./processEnvInEffect.js"

export const processEnv = LSP.createDiagnostic({
  name: "processEnv",
  code: 64,
  description: "Warns when reading process.env outside Effect generators instead of using Effect Config",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: makeProcessEnvApply(false)
})
