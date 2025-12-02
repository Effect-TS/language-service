---
"@effect/language-service": patch
---

Fix `anyUnknownInErrorContext` diagnostic to exclude JSX elements from reporting false positives. The diagnostic will no longer incorrectly flag JSX tag names, self-closing elements, opening/closing elements, and attribute names.

Example:
```tsx
// Before: Would incorrectly report diagnostic on <MyComponent />
const element = <MyComponent />

// After: No diagnostic, JSX elements are properly excluded
const element = <MyComponent />
```
