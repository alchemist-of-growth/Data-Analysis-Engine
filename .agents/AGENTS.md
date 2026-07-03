# Workspace Agent Guidelines - Data Analysis Engine

Welcome! You are part of the Data Analysis Engine multi-agent system. This workspace contains tools, system configurations, and subagents to analyze a sudden drop in a business or product metric.

## General Principles

1. **Cumulative Report**: All outputs must be written directly to `analysis_report.md` in the workspace root. Do not overwrite other sections unless correcting mistakes. Always append your findings in the designated header section.
2. **Configuration-Driven**: Always read `analysis_config.yaml` at the start of your turn to understand the dataset path, metric names, date columns, formulas, and dimensions.
3. **Data-Centric and Rigorous**: You have terminal access and code-execution abilities. Never guess or hallucinate metrics. Always run Python/Pandas scripts to inspect columns, calculate exact values, verify ratios, and generate charts.
4. **Clean Markdown Formatting**: Use tables, clear bullet points, and headers. Bold critical numbers. Do not include large code dumps or raw terminal output in the report—summarize the results clearly.
5. **Continuous Learning**: Read [.agents/experience_log.md](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/experience_log.md) at the start of your turn to retrieve past lessons, and document any new errors, fixes, or user corrections to it at the end of your execution following the [.agents/LEARNING_PROTOCOL.md](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/LEARNING_PROTOCOL.md).


---

## Workflow Sequence

The diagnostic process is strictly sequential:

| Step | Agent / Persona | Skill Folder | Objective |
| :--- | :--- | :--- | :--- |
| **1** | [01_drop_validator](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/agents/01_drop_validator.md) | `drop-validation` | Verify if the metric drop is real or noise (seasonality/outliers). |
| **2** | [02_driver_decomposer](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/agents/02_driver_decomposer.md) | `driver-decomposition` | Decompose the metric into mathematical drivers and find which driver dropped the most. |
| **3** | [03_trend_analyzer](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/agents/03_trend_analyzer.md) | `trend-analysis` | Plot and analyze driver trends over time. Identify when the break happened. |
| **4** | [04_segment_breakdown](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/agents/04_segment_breakdown.md) | `segment-breakdown` | Slice the failing driver by various categorical dimensions. Find the biggest shift. |
| **5** | [05_segment_comparator](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/agents/05_segment_comparator.md) | `segment-comparison` | Compare stable segments vs failing segments to identify key differences. |
| **6** | [06_hypothesis_generator](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/agents/06_hypothesis_generator.md) | `hypothesis-generation` | Synthesize findings into 1-3 actionable, data-validated hypotheses. |

---

## Step Transition Protocol

When a subagent completes its step:
1. Verify that its section in `analysis_report.md` is populated, complete, and contains the required content.
2. Ensure compliance with the [.agents/WORKFLOW_PROTOCOL.md](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/WORKFLOW_PROTOCOL.md) (aesthetic, formatting, and formatting rules).
3. Signal the next agent in the sequence to take over.
4. If any step fails or lacks data, raise a warning and suggest diagnostic paths to the user as defined in the error-recovery protocol.

