# language-service

This package implements a TypeScript language service plugin that allows additional refactors and diagnostics with your VSCode editor (or any editor that supports TypeScript's LSP).

## Installation

1. `npm install @effect/language-service` in your project
2. inside your tsconfig.json, you should add the plugin configuration as follows:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@effect/language-service"
      }
    ]
  }
}
```

3. Ensure that you set your editor to use your workspace TypeScript version.

   - In VSCode you can do this by pressing "F1" and typing "TypeScript: Select TypeScript version". Then select "Use workspace version".
   - In JetBrains you may have to disable the Vue language service, and chose the workspace version of TypeScript in the settings from the dropdown.

And you're done! You'll now be able to use a set of refactor and diagnostics that targets Effect!

## Options

Few options can be provided alongside the initialization of the Language Service Plugin.

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@effect/language-service",
        "diagnostics": true, // controls Effect diagnostics (on by default)
        "quickinfo": true // controls quickinfo over Effect (on by default)
      }
    ]
  }
}
```

## Provided functionalities

### Quickinfo

- Show the extended type of the current Effect

### Diagnostics

- Better error readability when you're missing errors or service types in your Effect definitions
- Detect floating Effects that are not yielded or run
- Detect wrong usage of yield inside Effect.gen
- Detect unnecessary usages of Effect.gen

### Refactors

- Transform an async function definition, into an Effect by using Effect.gen.
- Transform an async function definition, into an Effect by using Effect.gen, and generating a tagged error for each promise call.
- Transform a function returning an Effect.gen into a Effect.fn
- Function calls to pipe: Transform a set of function calls to a pipe() call.
- Pipe to datafirst: Transform a pipe() call into a series of datafirst function calls (where available).
- Toggle return type signature: With a single refactor, adds or removes type annotations from the definition.
- Remove unnecessary `Effect.gen` calls by simplifying generator functions that only wrap a single `yield*` statement returning an `Effect`. This refactor replaces the `Effect.gen` wrapper with the inner `Effect` directly, making the code more concise and readable.
