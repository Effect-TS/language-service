import ensureGetCallTrace from "@effect/language-service/diagnostics/ensureGetCallTrace"
import noSyncWithConstant from "@effect/language-service/diagnostics/noSyncWithConstant"
import removeCurryArrow from "@effect/language-service/diagnostics/removeCurryArrow"

export default { removeCurryArrow, noSyncWithConstant, ensureGetCallTrace }
