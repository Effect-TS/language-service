---
"@effect/language-service": minor
---

Add the `extendsNativeError` diagnostic to warn when classes directly extend the native `Error` constructor, including common local aliases such as `const E = Error`.

This helps steer users toward tagged errors that preserve stronger typing in the Effect failure channel.
