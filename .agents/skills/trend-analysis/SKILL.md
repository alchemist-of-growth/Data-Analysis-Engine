---
name: trend-analysis
description: Analyzes temporal trend lines, generates visualization plots, and detects breakpoints.
---

# Skill: Trend Analysis

## Overview
This skill tracks the daily trend of metrics over a extended timeline to pinpoint the exact time (breakpoint) of the metric drop and classify its temporal shape (sudden step-change vs. gradual decline).

## Dependencies
- [driver-decomposition](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/skills/driver-decomposition/SKILL.md): Used to determine which sub-metric driver trend should be highlighted and contrasted with the primary metric.

## Quick Start
Generate daily aggregates and plot them to locate the breakpoint:
```python
import matplotlib.pyplot as plt
# Plot metric over time, save as `driver_trends.png`, and locate the date of sudden change.
```

## Workflow

### 1. Daily Aggregation
Write a script to aggregate the primary metric and drivers on a daily basis, spanning a baseline buffer of 2-4 weeks before the drop.

### 2. Breakpoint Detection Algorithm
Compare daily values against the rolling mean and standard deviation of the baseline:
```python
# Calculate threshold: Baseline Mean - (3 * Baseline StdDev)
# Locate first day in analysed period falling below threshold.
```

### 3. Matplotlib Generation
Use this recipe to create the trend plot:
```python
import pandas as pd
import matplotlib.pyplot as plt
import yaml

# Read config
with open('analysis_config.yaml', 'r') as f:
    config = yaml.safe_load(f)

# (Load dataset daily_df containing date_col, metric, and driver_col)
# ...

fig, ax1 = plt.subplots(figsize=(10, 5))

# Plot Primary Metric
ax1.plot(daily_df[date_col], daily_df[metric], color='royalblue', linewidth=2, label=metric)
ax1.set_xlabel('Date')
ax1.set_ylabel(metric, color='royalblue')

# Plot Driver on Dual Y-axis
ax2 = ax1.twinx()
ax2.plot(daily_df[date_col], daily_df[driver_col], color='darkorange', linewidth=1.5, linestyle='--', label=driver_col)
ax2.set_ylabel(driver_col, color='darkorange')

plt.title('Daily Metric & Driver Trend')
fig.tight_layout()
plt.savefig('driver_trends.png', dpi=300)
```

## Common Mistakes
- **Timezone Mismatches**: Aggregating raw timestamps with mixed UTC/Local timezones, causing misalignment in daily buckets.
- **Visual Overcrowding**: Plotting more than 3 lines on a single axis without dual y-scaling, making scales unreadable.
- **Failing to Save Locally**: Outputting interactive matplotlib screens that block execution rather than saving directly to `driver_trends.png`.
