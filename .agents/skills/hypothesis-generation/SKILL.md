---
name: hypothesis-generation
description: Synthesizes analysis reports and generates testable hypotheses with validation plans.
---

# Skill: Hypothesis Generation

## Overview
This skill synthesizes the analytical trail from the previous 5 steps to formulate 1-3 concrete, testable hypotheses and construct validation action plans to find the root cause of the metric drop.

## Dependencies
This skill depends on all preceding steps:
- [drop-validation](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/skills/drop-validation/SKILL.md)
- [driver-decomposition](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/skills/driver-decomposition/SKILL.md)
- [trend-analysis](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/skills/trend-analysis/SKILL.md)
- [segment-breakdown](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/skills/segment-breakdown/SKILL.md)
- [segment-comparison](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/skills/segment-comparison/SKILL.md)

## Quick Start
Synthesize details and outline hypotheses:
- **Observation**: [What dropped and where]
- **Proposed Cause**: [Why it dropped]
- **Validation Plan**: [Concrete test/query to prove/disprove]

## Workflow

### 1. Intermediate Findings Synthesis
Review the cumulative `analysis_report.md` document and gather:
- Verified WoW and YoY drop percentages.
- Primary sub-metric driver of the drop.
- Breakpoint date and pattern (shock vs decay).
- Localized dimension and segment carrying the drop.
- Contrasted feature characteristics (e.g. app version skew).

### 2. Hypothesis Formulation
Draft 1-3 hypotheses. Each hypothesis must consist of:
- **Data Observation**: The core data patterns found in the analysis.
- **Proposed Cause**: The logical explanation connecting the pattern to a root cause.
- **Validation Plan**: Exact, actionable queries, code changes, or design reviews required to confirm the cause.

### 3. Executive Summary
Format the final verdict using this standardized template:
```markdown
> [!IMPORTANT]
> **Metric Drop Diagnosis**:
> **[Primary Metric]** dropped by **[Wow Change]%** WoW. This was driven by a drop in **[Driver Name]** (contributing **[Driver Contribution]%** of the drop), specifically localized to **[Failing Segment]**.
>
> **Diagnosed Cause**: [Summarize the most likely hypothesis and evidence].
```

## Common Mistakes
- **Vague Statements**: Writing hypotheses like "users are unhappy" or "there is a technical issue." Hypotheses must be specific and actionable (e.g., "v2.1 has a script error blocking form submissions on Safari").
- **Untestable Hypotheses**: Formulating hypotheses without a concrete validation plan.
- **Ignoring Counter-Evidence**: Drafting a hypothesis that is refuted by earlier segment comparison findings (e.g. suggesting an Android bug when Chrome and Mobile Web are unaffected).
