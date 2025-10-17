---
"@effect/language-service": minor
---

Add support to mark a service as "leakable" via JSDoc tag. Services marked with `@effect-leakable-service` will be excluded from the leaking requirements diagnostic, allowing requirements that are expected to be provided per method invocation (e.g. HttpServerRequest).

Example:
```ts
/**
 * @effect-leakable-service
 */
export class FileSystem extends Context.Tag("FileSystem")<FileSystem, {
  writeFile: (content: string) => Effect.Effect<void>
}>() {}
```
