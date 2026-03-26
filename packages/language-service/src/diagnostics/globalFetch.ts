import * as LSP from "../core/LSP.js"
import { makeGlobalFetchApply } from "./globalFetchInEffect.js"

export const globalFetch = LSP.createDiagnostic({
  name: "globalFetch",
  code: 53,
  description: "Warns when using the global fetch function outside Effect generators instead of the Effect HTTP client",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: makeGlobalFetchApply(false)
})
