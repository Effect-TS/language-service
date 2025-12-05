---
"@effect/language-service": minor
---

Add configurable mermaid provider option

Adds a new `mermaidProvider` configuration option that allows users to choose between different Mermaid diagram providers:
- `"mermaid.com"` - Uses mermaidchart.com
- `"mermaid.live"` - Uses mermaid.live (default)
- Custom URL - Allows specifying a custom provider URL (e.g., `"http://localhost:8080"` for local mermaid-live-editor)

This enhances flexibility for users who prefer different Mermaid visualization services or need to use self-hosted instances.
