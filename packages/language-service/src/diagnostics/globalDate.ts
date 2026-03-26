import * as LSP from "../core/LSP.js"
import { makeGlobalDateApply } from "./globalDateInEffect.js"

export const globalDate = LSP.createDiagnostic({
  name: "globalDate",
  code: 59,
  description: "Warns when using Date.now() or new Date() outside Effect generators instead of Clock/DateTime",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: makeGlobalDateApply(false)
})
