# Workflow and Output Formatting Protocol

This protocol defines the strict operational rules for how agents execute step-by-step diagnostic workflows and generate report deliverables. All agents in this workspace must conform to this protocol.

---

## 1. Workflow Coordination & Handoffs

The diagnostic pipeline is run as a sequential chain of steps.

### Step Handoff Protocol
1. **Verification**: Before starting a step, the assigned agent must read `analysis_report.md` to confirm the immediate previous step has been successfully completed and contains no `[!WARNING]` diagnostic blocks.
2. **Execution**: The agent runs its computations, generates any required assets (e.g. trend charts), and structures its findings.
3. **Writeout**: The agent appends its section to the bottom of the `analysis_report.md` file. It must **never** modify or overwrite sections written by other agents unless fixing a correction requested by the user.
4. **Signaling**: Once the section is written, the agent outputs a clear statement to hand off execution to the next step (e.g., *"Step X complete. Ready for Step Y."*).

---

## 2. Error Recovery and Pipeline Interruptions

If an agent encounters a runtime exception (e.g., missing package, data loading failure, or database timeout):

1. **Write Warning Block**: Do not crash silently. Append a warning block to the report under the step's header:
   ```markdown
   # Step X: [Step Title]
   
   > [!WARNING]
   > **Diagnostic Warning**: Step X failed to complete successfully.
   > - **Error Type**: [e.g., KeyError / Missing Columns]
   > - **Context**: [Short description of what the script was doing when it failed]
   ```
2. **Log the Exception**: Log the exact traceback and the fix attempt in [.agents/experience_log.md](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/experience_log.md) following the learning protocol.
3. **Suspend Sequence**: Pause execution, stop the pipeline, and report the problem to the user with clear instructions/proposals on how to debug the issue.

---

## 3. Strict Document Aesthetics

To ensure that `analysis_report.md` remains highly professional, readable, and clean, enforce these aesthetic constraints:

### No Raw Code or Stack Trace Dumps
- **Rule**: Do not write python code, raw scripts, SQL queries, or stdout/stderr outputs directly into `analysis_report.md`.
- **Reason**: The report is a business-facing document.
- **Action**: Keep intermediate scripts or logs in the `<appDataDir>/brain/<conversation-id>/scratch/` directory. Only output clean tables and text.

### Mandatory Markdown Tables
- **Rule**: Any data comparisons, period averages, WoW/YoY percentage changes, or segment distributions must be presented as Markdown tables.
- **Example**:
  | Device | Previous Share | Analysed Share | Rate Effect | Total Contribution |
  | :--- | :---: | :---: | :---: | :---: |
  | Mobile | 60% | 61% | -12% | -10.5% |

### Callouts and Alerts
- **Rule**: Emphasize key diagnostic conclusions, verdicts, and hypotheses using GitHub markdown blockquote alerts (`> [!IMPORTANT]`, `> [!NOTE]`, `> [!WARNING]`).
- **Example**:
  > [!IMPORTANT]
  > **Metric Drop Verdict**: The drop is verified as real, showing a **-12.4% YoY** decrease that cannot be explained by seasonal baseline shifts.

### Image Embeddings
- **Rule**: Save generated charts and plots in the project root with unique names (e.g., `driver_trends.png`).
- **Rule**: Refer to images using standard relative markdown syntax: `![Caption](filename.png)`. Do not use absolute file paths in the image source to preserve report exportability.
