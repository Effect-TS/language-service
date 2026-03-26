import * as LSP from "../core/LSP.js"
import { makeGlobalRandomApply } from "./globalRandomInEffect.js"

export const globalRandom = LSP.createDiagnostic({
  name: "globalRandom",
  code: 61,
  description: "Warns when using Math.random() outside Effect generators instead of the Random service",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: makeGlobalRandomApply(false)
})
