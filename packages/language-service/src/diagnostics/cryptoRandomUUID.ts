import * as LSP from "../core/LSP.js"
import { makeCryptoRandomUUIDApply } from "./cryptoRandomUUIDInEffect.js"

export const cryptoRandomUUID = LSP.createDiagnostic({
  name: "cryptoRandomUUID",
  code: 66,
  description:
    "Warns when using crypto.randomUUID() outside Effect generators instead of the Effect Random module, which uses Effect-injected randomness rather than the crypto module behind the scenes",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v4"],
  apply: makeCryptoRandomUUIDApply(false)
})
