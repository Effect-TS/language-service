---
"@effect/language-service": minor
---

Add support for custom APIs in deterministicKeys diagnostic using the `@effect-identifier` JSDoc tag.

You can now enforce deterministic keys in custom APIs that follow an `extends MyApi("identifier")` pattern by:
- Adding `extendedKeyDetection: true` to plugin options to enable detection
- Marking the identifier parameter with `/** @effect-identifier */` JSDoc tag

Example:
```ts
export function Repository(/** @effect-identifier */ identifier: string) {
  return Context.Tag("Repository/" + identifier)
}

export class UserRepo extends Repository("user-repo")<UserRepo, { /** ... */ }>() {}
```
