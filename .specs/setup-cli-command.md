# Setup CLI Command Specification

## Overview

The `setup` subcommand is an interactive CLI tool that guides users through the complete installation and configuration of the Effect Language Service. It performs a comprehensive analysis of the current repository state, presents configuration options, and applies all changes at the end in a batch operation.

## Command Interface

```bash
effect-language-service setup
```

**Mode**: Interactive only (no non-interactive flags)

**Working Directory**: Must be run in the root of a project (where package.json exists)

## Workflow Phases

The setup command follows a four-phase workflow:

1. **Assessment Phase**: Parse and analyze current repository state
2. **Configuration Phase**: Guide user through settings with interactive UI
3. **Review Phase**: Present all changes for user approval
4. **Application Phase**: Apply approved changes to the file system

---

## Phase 1: Assessment Phase

### 1.1 Repository Structure Analysis

**Check for package.json**:
- Verify `package.json` exists in the current working directory
- Parse using TypeScript's JSON parsing APIs to preserve formatting
- Error: Exit if not found with message: "No package.json found. Please run this command in the root of your project."

**Check for @effect/language-service dependency**:
- Check if `@effect/language-service` exists in `devDependencies`
- Store result: `{ installed: boolean, version?: string }`

**Check for prepare script**:
- Check if `scripts.prepare` exists in package.json
- Check if it contains `effect-language-service patch`
- Store result: `{ exists: boolean, hasPatchCommand: boolean, script?: string }`

### 1.2 TypeScript Configuration Detection

**Auto-detect tsconfig files**:
- Search current directory for files matching pattern: `tsconfig*.json` or `tsconfig*.jsonc`
- Parse each found file using TypeScript's JSON parsing APIs
- Store list of found configs with their paths

**Present tsconfig selection to user**:
- If 0 found: Skip to manual entry
- If 1 found: Show it as default option with "Use this" or "Choose manually"
- If 2+ found: Show list with option to "Choose manually"
- Manual option: Prompt for file path with validation

**Analyze selected tsconfig**:
- Parse the tsconfig.json file using TypeScript's JSON APIs
- Check if `compilerOptions.plugins` array exists
- Check if plugin with `name: "@effect/language-service"` exists
- If plugin exists, parse current configuration using `LanguageServicePluginOptions.parse()`
- Store result: `{ pluginConfigured: boolean, currentOptions?: LanguageServicePluginOptions }`

### 1.3 Assessment Summary

Store complete assessment state:
```typescript
interface AssessmentState {
  packageJson: {
    path: string
    hasLsp: boolean
    lspVersion?: string
    hasPrepareScript: boolean
    prepareScriptHasPatch: boolean
  }
  tsconfig: {
    path: string
    hasPlugins: boolean
    hasLspPlugin: boolean
    currentConfig?: LanguageServicePluginOptions
  }
}
```

---

## Phase 2: Configuration Phase

### 2.1 Package.json Configuration

#### 2.1.1 Language Service Installation

**If not installed** (`!assessmentState.packageJson.hasLsp`):
- Display: "❌ @effect/language-service is not installed in devDependencies"
- Use `Prompt.confirm()` with message: "Would you like to add @effect/language-service to devDependencies?"
- Default: `true`
- If Yes: Mark for installation (will be applied in Phase 4)
- If No: Continue (note: rest of setup may not work properly without it)

**If installed**:
- Display: "✅ @effect/language-service is installed (version: X.X.X)"

#### 2.1.2 Prepare Script Configuration

**If prepare script exists with patch command**:
- Display: "✅ prepare script already includes patch command"

**If prepare script exists without patch command**:
- Display: "⚠️  prepare script exists but doesn't include patch command"
- Show current script: `"prepare": "..."`
- Prompt: "Would you like to add 'effect-language-service patch' to the prepare script? (Y/n)"
- If Yes: Mark for modification (append ` && effect-language-service patch`)

**If prepare script doesn't exist**:
- Display: "ℹ️  No prepare script found"
- Prompt: "Would you like to add a prepare script to run patch on install? (Y/n)"
- Explain: "This ensures TypeScript is patched after package installations"
- If Yes: Mark to add `"prepare": "effect-language-service patch"`

### 2.2 TypeScript Plugin Configuration

#### 2.2.1 Plugin Section Setup

**If compilerOptions.plugins doesn't exist**:
- Display: "❌ No plugins section in tsconfig.json"
- Prompt: "Would you like to add the @effect/language-service plugin? (Y/n)"
- If Yes: Mark to create plugins array with LSP configuration

**If plugins exists but LSP not configured**:
- Display: "⚠️  Plugins section exists but @effect/language-service not configured"
- Prompt: "Would you like to add @effect/language-service plugin? (Y/n)"
- If Yes: Mark to append LSP configuration to plugins array

**If LSP plugin exists but misconfigured**:
- Display: "⚠️  @effect/language-service plugin found but may be misconfigured"
- Show current configuration snippet
- Inform: "Configuration will be updated in the next steps"

**If LSP plugin properly configured**:
- Display: "✅ @effect/language-service plugin is configured"

### 2.3 Diagnostic Severity Configuration

This is the core interactive section where users configure individual diagnostic severities.

#### 2.3.1 Diagnostic List

Load all available diagnostics from `src/diagnostics.ts`:
- Total: 36 diagnostics
- Each diagnostic has: `name`, `code`, `severity` (default), `description` (placeholder for now)

**Diagnostic Information Structure**:
```typescript
interface DiagnosticInfo {
  name: string
  code: number
  defaultSeverity: DiagnosticSeverity
  description: string  // For now, use placeholder: "TODO: Add description"
}
```

List of diagnostics (from the codebase):
1. anyUnknownInErrorContext (default: error) - TODO: Add description
2. catchUnfailableEffect (default: warning) - TODO: Add description
3. classSelfMismatch (default: error) - TODO: Add description
4. deterministicKeys (default: off) - TODO: Add description
5. duplicatePackage (default: error) - TODO: Add description
6. effectGenUsesAdapter (default: warning) - TODO: Add description
7. effectInVoidSuccess (default: warning) - TODO: Add description
8. floatingEffect (default: error) - TODO: Add description
9. genericEffectServices (default: error) - TODO: Add description
10. importFromBarrel (default: warning) - TODO: Add description
11. leakingRequirements (default: warning) - TODO: Add description
12. missedPipeableOpportunity (default: suggestion) - TODO: Add description
13. missingEffectContext (default: error) - TODO: Add description
14. missingEffectError (default: error) - TODO: Add description
15. missingEffectServiceDependency (default: error) - TODO: Add description
16. missingReturnYieldStar (default: error) - TODO: Add description
17. missingStarInYieldEffectGen (default: error) - TODO: Add description
18. multipleEffectProvide (default: warning) - TODO: Add description
19. nonObjectEffectServiceType (default: error) - TODO: Add description
20. outdatedEffectCodegen (default: error) - TODO: Add description
21. overriddenSchemaConstructor (default: warning) - TODO: Add description
22. returnEffectInGen (default: error) - TODO: Add description
23. runEffectInsideEffect (default: error) - TODO: Add description
24. schemaStructWithTag (default: suggestion) - TODO: Add description
25. schemaUnionOfLiterals (default: suggestion) - TODO: Add description
26. scopeInLayerEffect (default: warning) - TODO: Add description
27. strictBooleanExpressions (default: error) - TODO: Add description
28. strictEffectProvide (default: warning) - TODO: Add description
29. tryCatchInEffectGen (default: warning) - TODO: Add description
30. unknownInEffectCatch (default: warning) - TODO: Add description
31. unnecessaryEffectGen (default: suggestion) - TODO: Add description
32. unnecessaryFailYieldableError (default: suggestion) - TODO: Add description
33. unnecessaryPipe (default: suggestion) - TODO: Add description
34. unnecessaryPipeChain (default: warning) - TODO: Add description
35. unsupportedServiceAccessors (default: error) - TODO: Add description
36. middlewareAutoImportQuickfixes (not in list, might be excluded) - TODO: Add description

**Note**: Diagnostic descriptions will be implemented in a follow-up task. For the initial implementation, use a placeholder string "TODO: Add description" for all diagnostics.

#### 2.3.2 Interactive Diagnostic UI

**Custom Prompt Implementation**:
Use `@effect/cli` Prompt.custom() to create a custom interactive prompt for diagnostic configuration.

**State Structure**:
```typescript
interface DiagnosticConfigState {
  diagnostics: ReadonlyArray<DiagnosticInfo>
  currentIndex: number  // Currently selected diagnostic
  severities: Record<string, DiagnosticSeverity | "off">  // Current severity selections
  viewportStart: number  // For scrolling
  previousLineCount: number  // Track lines rendered in previous frame for clearing
}
```

**Display format**:
```
Configure Diagnostic Severities
Use ↑/↓ to navigate, ←/→ to change severity, Enter to finish

 error       anyUnknownInErrorContext  (red background on "error")
             TODO: Add description

 off         catchUnfailableEffect*    (gray background on "off", * = changed)
             TODO: Add description

 error       classSelfMismatch         (red background on "error")
             TODO: Add description
        
 message     deterministicKeys*        (blue background on "message", * = changed)
             TODO: Add description
...
```

**Layout**:
- Severity is on the **left** with fixed width and colored background (no arrows)
- Diagnostic name is on the **right** (variable length)
- Description is indented below, aligned with the diagnostic name
- **No counter/index** displayed (simplified - removed "[X/36]" counter)
- **No arrows** around severity (simplified - just show colored severity text)

**Severity Display**:
- Show only the currently selected severity (no arrows): ` severity ` with colored background
- When user presses left/right arrow, the text changes to the new severity
- Severity cycle order:
  - Right arrow: `off` → `suggestion` → `message` → `warning` → `error` → `off` (cycles)
  - Left arrow: `error` → `warning` → `message` → `suggestion` → `off` → `error` (cycles)
- Fixed width ensures stability (padded to 10 chars - length of "suggestion")

**Visual Styling**:

**Severity Background Colors** (using ANSI background colors):
| Severity    | Background Color        | ANSI Code           | Text Color |
|-------------|-------------------------|---------------------|------------|
| `off`       | Gray                    | `Ansi.bgBlackBright`| White      |
| `suggestion`| Cyan/Light blue         | `Ansi.bgCyan`       | White      |
| `message`   | Blue                    | `Ansi.bgBlue`       | White      |
| `warning`   | Yellow                  | `Ansi.bgYellow`     | White      |
| `error`     | Red                     | `Ansi.bgRed`        | White      |

**Implementation**:
```typescript
const severityStyle = {
  off: Ansi.combine(Ansi.white, Ansi.bgBlackBright),
  suggestion: Ansi.combine(Ansi.white, Ansi.bgCyan),
  message: Ansi.combine(Ansi.white, Ansi.bgBlue),
  warning: Ansi.combine(Ansi.white, Ansi.bgYellow),
  error: Ansi.combine(Ansi.white, Ansi.bgRed)
}

// Fixed width ensures display doesn't shift when cycling
const MAX_SEVERITY_LENGTH = 10 // "suggestion" is longest
const paddedSeverity = currentSeverity.padEnd(MAX_SEVERITY_LENGTH, ' ')

const severityDoc = Doc.annotate(
  Doc.text(` ${paddedSeverity} `),
  severityStyle[currentSeverity]
)
```

**Changed from default indicator**:
- Add `*` immediately after diagnostic name when severity differs from default
- Example: `catchUnfailableEffect*` (user changed from default)
- The `*` should be in the same style/color as the diagnostic name
- Applied before any other styling (underline, cyan, etc.)

**Line Clearing Strategy**:
- Track `previousLineCount` in state to remember how many lines were rendered
- Use this count when clearing, ensuring correct cleanup even if terminal size changes between frames
- Update `previousLineCount` on each state change before rendering next frame

**Navigation (via UserInput from Terminal)**:
- `↑` (Up Arrow / `key.upArrow`): Move to previous diagnostic
- `↓` (Down Arrow / `key.downArrow`): Move to next diagnostic
- `←` (Left Arrow / `key.leftArrow`): Cycle severity left: error → warning → message → suggestion → off → error
- `→` (Right Arrow / `key.rightArrow`): Cycle severity right: off → suggestion → message → warning → error → off
- `Enter` (`key.return`): Finish configuration and proceed to next phase
- `Ctrl+C` (`key.ctrlC`): Abort entire setup process (handled by Terminal as QuitException)
  - **Note**: Progress is NOT persisted - user must complete the entire setup flow or start over

**Visual indicators**:
- **Current position**: 
  - The currently selected diagnostic name is cyan + underlined (`Ansi.combine(Ansi.cyanBright, Ansi.underlined)`)
  - Other diagnostics have normal text styling
- **Severity display**: ` severity ` (with colored background) where:
  - Severity text changes when user presses left/right arrow keys
  - Only the current severity is shown (not all options)
  - **Fixed width**: Use the longest severity text length for stability
    - Longest text is "suggestion" (10 chars)
    - Pad shorter texts with spaces: ` error       ` (error padded to 10 chars + 2 for padding)
    - This prevents UI shifting when cycling through severities
  - **Background color** changes based on severity level (see table above):
    - `off`: Gray background with white text
    - `suggestion`: Cyan background with white text
    - `message`: Blue background with white text
    - `warning`: Yellow background with white text
    - `error`: Red background with white text
  - Background color appears for ALL diagnostics (not just the selected one)
  - Makes it easy to scan and see severity levels at a glance
- **Changed from default**: 
  - Mark diagnostic name with `*` suffix immediately after the name
  - Example: `anyUnknownInErrorContext*` (if changed from default)
  - The `*` inherits the styling of the diagnostic name (cyan+underlined if current, normal otherwise)
- **Counter**: `[X/36]` at the start of each line
- **Scrollable viewport**: Show 5-7 diagnostics at a time
- **Scroll indicators**: Arrow up (↑) / down (↓) symbols when there are more items above/below viewport

**Prompt Handlers**:
```typescript
const diagnosticConfigPrompt = Prompt.custom<DiagnosticConfigState, Record<string, DiagnosticSeverity | "off">>(
  // Initial state
  {
    diagnostics: allDiagnostics,
    currentIndex: 0,
    severities: getCurrentSeverities() // from current config or defaults
  },
  {
    // Render handler: Returns ANSI escape code string
    render: (state, action) => Effect.gen(function*() {
      const terminal = yield* Terminal.Terminal
      const columns = yield* terminal.columns
      
      // Build the display using @effect/printer-ansi Doc
      // - Header with title: "Configure Diagnostic Severities"
      // - Help text: "Use ↑/↓ to navigate, ←/→ to change severity, Enter to finish"
      // - List of visible diagnostics (5-7 at a time with scroll indicators)
      // - Each diagnostic shows:
      //   * Counter: [X/36]
      //   * Name: diagnostic.name (cyan + underlined if current)
      //     - Add * suffix if changed from default: diagnostic.name*
      //   * Severity: ◄ currentSeverity ► with background color:
      //     - off: gray background (Ansi.bgBlackBright)
      //     - suggestion: cyan background (Ansi.bgCyan)
      //     - message: blue background (Ansi.bgBlue)
      //     - warning: yellow background (Ansi.bgYellow)
      //     - error: red background (Ansi.bgRed)
      //     - Text: white (Ansi.white) for contrast
      //   * Description: diagnostic.description (on next line, indented, gray color)
      
      // Example rendering code:
      // const severityBgColor = {
      //   off: Ansi.bgBlackBright,
      //   suggestion: Ansi.bgCyan,
      //   message: Ansi.bgBlue,
      //   warning: Ansi.bgYellow,
      //   error: Ansi.bgRed
      // }
      // const severityDoc = Doc.annotate(
      //   Doc.text(`◄ ${currentSeverity} ►`),
      //   Ansi.combine(Ansi.white, severityBgColor[currentSeverity])
      // )
      
      return Doc.render(doc, { style: "pretty", options: { lineWidth: columns } })
    }),
    
    // Process handler: Handle user input
    process: (input, state) => Effect.gen(function*() {
      if (input.key.upArrow) {
        const newIndex = state.currentIndex > 0 ? state.currentIndex - 1 : state.diagnostics.length - 1
        return Action.NextFrame({ state: { ...state, currentIndex: newIndex } })
      }
      
      if (input.key.downArrow) {
        const newIndex = state.currentIndex < state.diagnostics.length - 1 ? state.currentIndex + 1 : 0
        return Action.NextFrame({ state: { ...state, currentIndex: newIndex } })
      }
      
      if (input.key.leftArrow || input.key.rightArrow) {
        // Cycle severity for current diagnostic
        const diagnostic = state.diagnostics[state.currentIndex]
        const currentSeverity = state.severities[diagnostic.name] ?? diagnostic.defaultSeverity
        const newSeverity = cycleSeverity(currentSeverity, input.key.leftArrow ? "left" : "right")
        
        // cycleSeverity function:
        // Right: off → suggestion → message → warning → error → off
        // Left:  error → warning → message → suggestion → off → error
        
        return Action.NextFrame({
          state: {
            ...state,
            severities: { ...state.severities, [diagnostic.name]: newSeverity }
          }
        })
      }
      
      if (input.key.return) {
        return Action.Submit({ value: state.severities })
      }
      
      // Any other input: beep
      return Action.Beep({})
    }),
    
    // Clear handler: Clear the screen before next frame
    clear: (state, action) => Effect.gen(function*() {
      // Calculate how many lines were rendered
      const linesToClear = calculateRenderedLines(state)
      return Doc.render(clearLines(linesToClear), { style: "pretty" })
    })
  }
)
```

**Implementation using Effect CLI**:
- Reference: `/Users/mattiamanzati/Desktop/effect/packages/cli/src/Prompt.ts`
- Use `Prompt.custom()` for full control over rendering and input processing
- Use `@effect/printer-ansi` for colored output (Doc and Ansi modules)
- Use `Terminal.UserInput` for keyboard input handling
- Return `Action.NextFrame`, `Action.Submit`, or `Action.Beep` from process handler
- Implement scrollable list (show 5-7 items at a time with scroll indicators)

#### 2.3.3 Other Plugin Options Configuration

For the initial version, we'll focus only on diagnostic severities. Future versions could include:
- Feature toggles (refactors, completions, quickinfo, etc.)
- Advanced options (keyPatterns, importAliases, namespaceImportPackages, etc.)
- Quick preset selection (strict, recommended, minimal)

Mark these as "Future enhancements" in implementation.

---

## Phase 3: Review Phase

### 3.1 Changes Summary

Collect all pending changes from Phase 2:

```typescript
interface PendingChanges {
  packageJson: {
    addLsp?: boolean
    modifyPrepareScript?: { old?: string, new: string }
    addPrepareScript?: string
  }
  tsconfig: {
    addPluginsSection?: boolean
    addLspPlugin?: boolean
    updateLspConfig?: boolean
    diagnosticSeverity: Record<string, DiagnosticSeverity | "off">
  }
}
```

### 3.2 Changes Presentation

Display all changes grouped by file:

```
Review Changes
==============

The following changes will be applied:

📦 package.json
  ✓ Add @effect/language-service to devDependencies
  ✓ Add prepare script: "effect-language-service patch"

📝 tsconfig.json (./tsconfig.json)
  ✓ Add plugins section to compilerOptions
  ✓ Configure @effect/language-service plugin
  ✓ Set diagnostic severities:
    - floatingEffect: error (default)
    - unnecessaryPipe: off (changed from suggestion)
    - importFromBarrel: error (changed from warning)
    ... (show only changed severities, not all 36)

Total: X changes across Y files
```

### 3.3 Approval Options

Present three options:

```
How would you like to proceed?

[A] Apply all changes
[R] Reject all changes (abort)
[M] Manual approval (review each change)
[Q] Quit

Choice:
```

**Option A - Apply All**:
- Proceed directly to Phase 4
- Apply all changes

**Option R - Reject All**:
- Exit setup without making any changes
- Display: "Setup cancelled. No changes were made."

**Option M - Manual Approval**:
- Iterate through each change
- For each change, prompt: "[Y]es / [N]o / [Q]uit"
- Track approved changes
- Skip disapproved changes
- If Quit selected: Exit with partial changes discarded

**Option Q - Quit**:
- Same as Reject All

---

## Phase 4: Application Phase

### 4.1 File Modification Strategy

**Use TypeScript's JSON APIs for all JSON modifications**:
- Parse JSON with `ts.parseJsonText()` or similar
- Preserve formatting, comments, and structure
- Make surgical modifications using AST transformations
- Write back preserving original style

**For package.json**:
- Add devDependency if needed
- Add or modify scripts.prepare if needed
- Preserve existing formatting (spaces/tabs, line endings)

**For tsconfig.json**:
- Add compilerOptions.plugins array if needed
- Add or update @effect/language-service plugin configuration
- Merge diagnosticSeverity settings (only include non-default values)
- Preserve existing formatting and comments

### 4.2 Change Application Order

1. **package.json changes** (if any)
   - Add dependency
   - Add/modify script
   - Write file

2. **tsconfig.json changes** (if any)
   - Add/update plugin configuration
   - Write file

3. **Post-installation** (if package added)
   - Display: "Please run 'npm install' (or your package manager) to install @effect/language-service"
   - Do NOT run package manager automatically

### 4.3 Success Messages

After successful application:

```
✅ Setup Complete!

Changes applied:
  ✓ Updated package.json
  ✓ Updated tsconfig.json

Next steps:
  1. Run 'npm install' to install @effect/language-service
  2. Restart your TypeScript server in your editor:
     - VSCode: Press F1 → "TypeScript: Restart TS Server"
     - Other editors: Restart your editor or TS language server
  3. (Optional) Run 'effect-language-service patch' to enable diagnostics at build time

Your Effect Language Service is now configured!
```

### 4.4 Error Handling

**File write errors**:
- Catch and display specific error
- Offer to retry
- Allow continuing with remaining changes

**Partial success**:
- If some changes succeed and others fail
- Display what succeeded and what failed
- Suggest manual intervention for failed changes

---

## Implementation Notes

### Dependencies

Required libraries (already in project):
- `@effect/cli` - Command, Options, and **Prompt** for interactive UI
- `@effect/platform` - FileSystem, Path, **Terminal** for user input
- `@effect/printer-ansi` - Doc and Ansi for colored ANSI output
- `effect` - Effect, Console, Data
- `typescript` - For JSON parsing APIs

**Prompt API Reference**:
- Location: `/Users/mattiamanzati/Desktop/effect/packages/cli/src/Prompt.ts`
- Key APIs:
  - `Prompt.custom<State, Output>(initialState, handlers)` - Create custom prompts
  - `Prompt.confirm(options)` - Yes/No prompts
  - `Prompt.text(options)` - Text input prompts
  - `Prompt.select(options)` - Select from list
  - `Terminal.UserInput` - Keyboard input with key detection
  - `Action.NextFrame`, `Action.Submit`, `Action.Beep` - Control prompt flow
  
**ANSI Rendering**:
- Use `@effect/printer-ansi/Doc` for building ANSI documents
- Use `@effect/printer-ansi/Ansi` for color/style annotations (cyan, bold, underline, etc.)
- Reference existing prompts: `/Users/mattiamanzati/Desktop/effect/packages/cli/src/internal/prompt/select.ts`

### File Structure

New files to create:
- `src/cli/setup.ts` - Main setup command implementation
- `src/cli/setup/` - Directory for setup-related utilities:
  - `assessment.ts` - Phase 1 logic
  - `configuration.ts` - Phase 2 logic
  - `review.ts` - Phase 3 logic
  - `application.ts` - Phase 4 logic
  - `ui.ts` - Interactive UI components
  - `json-modifier.ts` - JSON file modification using TS APIs

Update:
- `src/cli.ts` - Add setup to subcommands list

### TypeScript JSON Parsing APIs

Use TypeScript's compiler APIs to parse and modify JSON:
- `ts.parseJsonText()` - Parse JSON preserving structure
- `ts.parseJsonConfigFileContent()` - For tsconfig.json specifically
- Create text changes and apply them preserving formatting

Reference implementation:
- Similar approach as `src/cli/patch.ts` which uses TS APIs
- Use `applyTextChanges` utility from `src/cli/utils.ts`

### Diagnostic Information Extraction

Create utility to extract diagnostic information:
```typescript
interface DiagnosticInfo {
  name: string
  code: number
  defaultSeverity: DiagnosticSeverity
  description?: string // Future: extract from README or diagnostic file
}

function getAllDiagnostics(): DiagnosticInfo[] {
  // Import from src/diagnostics.ts
  // Map each diagnostic to extract name, code, severity
  // Return sorted list
}
```

### State Management

Use Effect for state management throughout phases:
```typescript
interface SetupState {
  assessment: AssessmentState
  configuration: ConfigurationState
  pendingChanges: PendingChanges
  approvedChanges: PendingChanges
}
```

### User Experience Considerations

**Progress indication**:
- Show which phase user is in
- Display progress through configuration options
- Clear visual separation between phases

**Validation**:
- Validate file paths before proceeding
- Validate JSON syntax after modifications
- Offer to create backups before modifying files (Future enhancement)

**Help text**:
- Provide contextual help at each step
- Explain what each option does
- Link to documentation where appropriate

**Monorepo guidance**:
- If multiple tsconfig files detected, suggest configuring at root
- Explain inheritance model for tsconfig in monorepos

---

## Future Enhancements

### Phase 2 Additions

1. **Feature toggles configuration**:
   - refactors, diagnostics, completions, quickinfo, goto, inlays, renames
   - Binary on/off switches

2. **Advanced options configuration**:
   - keyPatterns configuration with interactive builder
   - importAliases setup
   - namespaceImportPackages selection
   - barrelImportPackages selection

3. **Preset selection**:
   - "Recommended" - Balanced defaults
   - "Strict" - All diagnostics as errors
   - "Minimal" - Only critical errors
   - "Custom" - Current interactive flow

### Additional Features

1. **Backup creation**:
   - Automatically backup files before modification
   - Option to restore from backup

2. **Non-interactive mode**:
   - `--preset=recommended|strict|minimal`
   - `--tsconfig=path`
   - `--install-dependency`
   - Apply without prompts for CI/automation

3. **Configuration export/import**:
   - Export current setup as a config file
   - Import config from another project
   - Share team configurations

4. **Validation command**:
   - `effect-language-service setup --validate`
   - Check if current setup is correct
   - Suggest fixes without modifying files

5. **Diagnostic descriptions**:
   - Show description for each diagnostic
   - Link to examples or documentation
   - Search/filter diagnostics by keyword

---

## Testing Strategy

### Unit Tests

Test each phase independently:
- Assessment phase with various repo states
- Configuration logic with different user inputs
- JSON modification with complex scenarios
- Change application with various file states

### Integration Tests

Test complete workflows:
- Fresh installation (no config)
- Upgrade existing configuration
- Monorepo setup
- Error recovery scenarios

### Manual Testing Checklist

- [ ] Run in empty directory (should error appropriately)
- [ ] Run with package.json but no tsconfig
- [ ] Run with tsconfig but no package.json
- [ ] Run in monorepo root
- [ ] Test all navigation keys in diagnostic UI
- [ ] Test approval options (A/R/M/Q)
- [ ] Test partial change approval
- [ ] Test with already configured project
- [ ] Test with misconfigured plugin
- [ ] Test file permission errors
- [ ] Test with invalid JSON files
- [ ] Test keyboard interrupts (Ctrl+C)

---

## Open Questions / Design Decisions

### 1. Package Manager Detection

**Question**: Should we detect which package manager is being used (npm, pnpm, yarn, bun)?

**Options**:
- A) Detect from lock files and suggest appropriate install command
- B) Always suggest `npm install` (simplest)
- C) Ask user which package manager they use

**Recommendation**: Option A - Detect from lock files for better UX

### 2. TypeScript Version Compatibility

**Question**: Should we check TypeScript version compatibility?

**Recommendation**: Yes, check if TypeScript is installed and version is compatible (>= 5.0)

### 3. Editor-specific Instructions

**Question**: Should we detect which editor is being used and provide specific instructions?

**Recommendation**: Show generic instructions for "Restart TypeScript Server" with examples for popular editors

### 4. Diagnostic Grouping

**Question**: Should diagnostics be grouped by category (errors, code quality, style)?

**Recommendation**: For v1, keep simple flat list. Future enhancement: Add grouping and filtering

### 5. Configuration File Location

**Question**: Should we support configuring multiple tsconfig files in one session?

**Decision**: No, recommend users configure at monorepo root and extend. This was answered in the requirements.

---

## Success Criteria

The setup command is successful if:

1. ✅ Users can complete setup without external documentation
2. ✅ All file modifications preserve formatting and comments
3. ✅ Users can preview and approve changes before application
4. ✅ Setup handles common error scenarios gracefully
5. ✅ Interactive UI is intuitive and responsive
6. ✅ Setup works for both fresh installs and updates
7. ✅ No manual file editing required after running setup
8. ✅ Users receive clear next steps after completion

---

## Example Session Flow

```bash
$ effect-language-service setup

🔍 Analyzing your project...

✓ Found package.json
✓ Found 2 tsconfig files

📦 Package Configuration
========================
❌ @effect/language-service is not installed in devDependencies
   Would you like to add it? (Y/n): y

ℹ️  No prepare script found
   Add prepare script to run patch on install? (Y/n): y

📝 TypeScript Configuration
============================
Found tsconfig files:
  1. ./tsconfig.json
  2. ./tsconfig.build.json
  3. Enter path manually

Select tsconfig to configure: 1

⚠️ Plugins section exists but @effect/language-service not configured
   Add @effect/language-service plugin? (Y/n): y

🔧 Configure Diagnostic Severities
===================================
Use ↑/↓ to navigate, ←/→ to change severity, Enter to finish

 error       anyUnknownInErrorContext      (red background, white text)
             TODO: Add description
        
 off         catchUnfailableEffect*        (gray background, white text, * indicates changed)
             TODO: Add description
        
 error       classSelfMismatch             (red background, white text)
             TODO: Add description
        
 error       importFromBarrel*             (red background, white text, * indicates changed)
             TODO: Add description
...

[User navigates with ↑/↓ arrows and changes severities with ←/→ arrows]
[Severity background color changes as user cycles through options]
[* appears next to diagnostic name when changed from default]
[No arrows around severity - just colored background for clean look]

Press Enter to continue...

📋 Review Changes
=================

📦 package.json
  ✓ Add @effect/language-service to devDependencies
  ✓ Add prepare script: "effect-language-service patch"

📝 tsconfig.json
  ✓ Add @effect/language-service to plugins
  ✓ Set diagnostic severities (3 changed from defaults)

Total: 5 changes across 2 files

[A] Apply all | [R] Reject all | [M] Manual | [Q] Quit: a

Applying changes...
✓ Updated package.json
✓ Updated tsconfig.json

✅ Setup Complete!

Next steps:
  1. Run 'npm install' to install @effect/language-service
  2. Restart your TypeScript server (VSCode: F1 → "TypeScript: Restart TS Server")
  3. (Optional) Run 'effect-language-service patch' for build-time diagnostics

Your Effect Language Service is now configured! 🎉
```

---

## Risk Assessment

### High Risk Areas

1. **JSON Modification Correctness**
   - Risk: Breaking user's JSON files with invalid syntax
   - Mitigation: Use TypeScript APIs, extensive testing, create backups

2. **Terminal UI Compatibility**
   - Risk: Interactive UI not working on all terminals
   - Mitigation: Use well-tested libraries, fallback to simple prompts

3. **State Management Complexity**
   - Risk: Losing user's configuration choices between phases
   - Mitigation: Clear state types, Effect for safe state handling

### Medium Risk Areas

1. **File System Permissions**
   - Risk: Cannot write to files
   - Mitigation: Clear error messages, graceful degradation

2. **User Experience**
   - Risk: Confusing flow or too many options
   - Mitigation: Progressive disclosure, clear help text

### Low Risk Areas

1. **Performance**
   - Assessment phase should be fast even for large projects
   - JSON parsing is fast for typical config files

---

## Timeline Estimation

### Phase 1: Core Infrastructure (2-3 days)
- Setup command skeleton
- Assessment phase implementation
- JSON parsing utilities using TS APIs

### Phase 2: Interactive Configuration (3-4 days)
- Terminal UI for diagnostic configuration
- Package.json and tsconfig prompts
- State management

### Phase 3: Review and Application (2-3 days)
- Changes review UI
- Approval flow (A/R/M/Q options)
- File modification and writing

### Phase 4: Testing and Polish (2-3 days)
- Unit tests for each phase
- Integration tests
- Error handling refinement
- Documentation

**Total Estimated Time**: 9-13 days

### Incremental Delivery

**MVP (Minimum Viable Product)**:
1. Basic assessment (detect files)
2. Simple prompts for package.json
3. Diagnostic configuration with simple UI
4. Apply changes without review phase

**V1 (First Full Release)**:
- All phases implemented
- Interactive diagnostic UI
- Review and approval flow
- Comprehensive error handling

**V2 (Enhanced)**:**
- Feature toggles configuration
- Advanced options
- Presets
- Configuration export/import

---

## Documentation Requirements

### User Documentation

1. **Setup Guide**:
   - When to run setup
   - What setup does
   - How to navigate the UI
   - Troubleshooting common issues

2. **README Updates**:
   - Add setup command to installation instructions
   - Update "Installation" section to mention setup command
   - Add examples of setup usage

### Developer Documentation

1. **Implementation Guide**:
   - Code organization
   - How to add new configuration options
   - How to test setup command

2. **Architecture Documentation**:
   - Phase flow diagrams
   - State management
   - JSON modification strategy

---

## Conclusion

This specification defines a comprehensive, user-friendly setup command for the Effect Language Service. The phased approach (Assess → Configure → Review → Apply) ensures users maintain full control while providing guidance throughout the process. The interactive diagnostic configuration UI makes it easy to customize severity levels, and the review phase prevents unintended changes.

The implementation leverages TypeScript's JSON parsing APIs to preserve file formatting and uses Effect for robust state management and error handling. This aligns with the project's existing patterns and ensures maintainability.
