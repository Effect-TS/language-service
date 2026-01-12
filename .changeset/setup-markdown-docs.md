---
"@effect/language-service": minor
---

Add markdown documentation support to setup command

The setup command now automatically manages Effect Language Service documentation in AGENTS.md and CLAUDE.md files:

- When installing: Adds or updates the Effect Language Service section with markers
- When uninstalling: Removes the section if present
- Case-insensitive file detection (supports both lowercase and uppercase filenames)
- Skips symlinked files to avoid modifying linked content
- Shows proper diff view for markdown file changes

Example section added to markdown files:
```markdown
<!-- effect-language-service:start -->
## Effect Language Service

The Effect Language Service comes in with a useful CLI that can help you with commands to get a better understanding your Effect Layers and Services, and to help you compose them correctly.
<!-- effect-language-service:end -->
```
