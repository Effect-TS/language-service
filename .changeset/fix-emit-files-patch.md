---
"@effect/language-service": patch
---

Fix CLI patching to target `emitFilesAndReportErrors` function instead of `emitFilesAndReportErrorsAndGetExitStatus`, updating the injection approach to replace the diagnostics property in the return statement's object literal.
