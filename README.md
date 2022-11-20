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

## Configuration

The severity of diagnostics can be customized by providing additional configuration in your tsconfig.json.
Accepted values are: `"none" | "suggestion" | "warning" | "error"`

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@effect/language-service",
        "diagnostic": {
          "1003": "warning",
          "1002": "none"
        }
      }
    ]
  }
}
```

## Provided refactors

Here's a list of the refactors provided by this language service plugin.

### Add pipe

![](images/add-pipe.gif)

Transform a set of function calls to a pipe() call.

### Remove pipe

![](images/remove-pipe.gif)

Transform a pipe() call into a series of regular function calls.

### Remove curry arrow

![](images/remove-curry-arrow.gif)

Removes useless arrow functions.

### Toggle type annotation

![](images/toggle-type-annotation.gif)

With a single refactor, adds or removes type annotations from the definition.

### async-await to Effect.gen

![](images/async-await-to-gen.gif)

Transform an async function definition, into an Effect by using Effect.gen.

### async-await to Effect.gen with tryPromise

![](images/async-await-to-gen-try-promise.gif)

Transform an async function definition, into an Effect by using Effect.gen, and generating a tagged error for each promise call.
