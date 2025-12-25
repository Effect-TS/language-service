---
"@effect/language-service": minor
---

Add `effect-language-service setup` CLI command

This new command provides an interactive wizard to guide users through the complete installation and configuration of the Effect Language Service. The setup command:

- Analyzes your repository structure (package.json, tsconfig files)
- Guides you through adding the package to devDependencies
- Configures the TypeScript plugin in your tsconfig.json
- Allows customizing diagnostic severity levels
- Optionally adds prepare script for automatic patching
- Optionally configures VS Code settings for workspace TypeScript usage
- Shows a review of all changes before applying them

Example usage:
```bash
effect-language-service setup
```

The wizard will walk you through each step and show you exactly what changes will be made before applying them.
