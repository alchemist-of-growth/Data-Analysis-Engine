# Data Analysis Engine - Experience Log & Learned Rules

This file is a persistent memory ledger. Agents operating in this workspace read this file at the start of their session to apply past learnings and append new learnings at the end of their execution.

Refer to the [.agents/LEARNING_PROTOCOL.md](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/LEARNING_PROTOCOL.md) for instructions on how to parse, structure, and maintain these log entries.

---
<!-- Learnings will be appended below this line -->

### 2026-07-04 Learning Event - macOS Environment Browser Subagent Restrictions
- **Context/Task**: Visual verification of local React app running on Vite
- **Triggering Event**: Running `browser_subagent` on macOS environment
- **Problem/Pitfall**: `open_browser_url` failed with error `local chrome mode is only supported on Linux`
- **Resolution/Correct Action**: Standard terminal verification (`npm run build`, `npm run lint`) is used instead of browser subagent tools to verify frontend correctness.
- **Persistent Rule for Future Agents**:
  > [!IMPORTANT]
  > When operating on macOS in this multi-agent system, do not call browser automation tools (like `browser_subagent` or `open_browser_url`). Rely on building/compiling files locally to verify code correctness.

### 2026-07-04 Learning Event - React hook exhaustive-deps Lint Rule
- **Context/Task**: Compiling and linting frontend React files using Vite and oxlint
- **Triggering Event**: Linter check during validation phase
- **Problem/Pitfall**: `oxlint` warns about missing dependencies (like `fileName`) in `useEffect` hook dependency lists.
- **Resolution/Correct Action**: Ensure all variables read inside a `useEffect` hook are included in its dependency array.
- **Persistent Rule for Future Agents**:
  > [!IMPORTANT]
  > When making changes to React components, always run `npm run lint` and resolve any React hooks dependency warnings by correctly specifying hooks dependencies.
