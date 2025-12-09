---
"@effect/language-service": minor
---

Add Structural Type to Schema refactor

Adds a new "Structural Type to Schema" refactor that converts TypeScript interfaces and type aliases to Effect Schema classes. This refactor analyzes the structure of types and generates appropriate Schema definitions, with intelligent detection and reuse of existing schemas.

Example:
```typescript
// Before
export interface User {
  id: number
  name: string
}

// After (using the refactor)
export class User extends Schema.Class<User>("User")({
  id: Schema.Number,
  name: Schema.String
}) { }
```

The refactor supports:
- All primitive types and common TypeScript constructs
- Automatic reuse of existing Schema definitions for referenced types
- Optional properties, unions, intersections, and nested structures
- Both interface and type alias declarations
