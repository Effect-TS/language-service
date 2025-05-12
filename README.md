# language-service

This package implements a TypeScript language service plugin that allows additional refactors and diagnostics with your VSCode editor (or any editor that supports TypeScript's LSP).

## Installation

1. `npm install @effect/language-service --save-dev` in your project
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
        "diagnostics": true, // controls Effect diagnostics
        "quickinfo": true, // controls quickinfo over Effect
        "completions": true, // controls Effect completions
        "multipleEffectCheck": true // controls if multiple versions of Effect are referenced
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
- Floating Effects that are not yielded or run
- Wrong usage of yield inside Effect.gen
- Unnecessary usages of Effect.gen
- Multiple versions of Effect in your project

### Completions

- Autocomplete 'Self' in Effect.Service, Context.Tag, Schema.TaggedClass, Schema.TaggedRequest and family

### Refactors

- Transform an async function definition, into an Effect by using Effect.gen.
- Transform an async function definition, into an Effect by using Effect.gen, and generating a tagged error for each promise call.
- Transform a function returning an Effect.gen into a Effect.fn
- Function calls to pipe: Transform a set of function calls to a pipe() call.
- Pipe to datafirst: Transform a pipe() call into a series of datafirst function calls (where available).
- Toggle return type signature: With a single refactor, adds or removes type annotations from the definition.
- Remove unnecessary `Effect.gen` definitions that contains a single `yield` statement.
- Wrap an `Effect` expression with `Effect.gen`

## Configuring diagnostics

You can either disable or change the severity of specific diagnostics by using comments in your code.

```ts
// @effect-diagnostics effect/floatingEffect:off
Effect.succeed(1); // This will not be reported as a floating effect

// @effect-diagnostics effect/floatingEffect:error
Effect.succeed(1); // This will be reported as a floating effect
```
