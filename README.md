# language-service

This package implements a TypeScript language service plugin that allows additional refactors and diagnostics with your VSCode editor (or any editor that supports TypeScript's LSP).

## Installation

After `npm install @effect/language-service` in your project, ensure you set your VSCode to use your workspace TypeScript version.

Inside your tsconfig.json, you should add the plugin configuration as follows:

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

And you're done! You'll now be able to use a set of refactor and diagnostics that targets Effect!

## Provided functionalities

### Diagnostics

- Better error readability when you're missing errors or service types in your Effect definitions
- Detect floating Effects that are not yielded or run
- Detect wrong usage of yield inside Effect gen

### Refactors

- Transform an async function definition, into an Effect by using Effect.gen.
- Transform an async function definition, into an Effect by using Effect.gen, and generating a tagged error for each promise call.
- Function calls to pipe: Transform a set of function calls to a pipe() call.
- Pipe to datafirst: Transform a pipe() call into a series of datafirst function calls (where available).
- Toggle return type signature: With a single refactor, adds or removes type annotations from the definition.
