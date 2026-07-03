---
name: segment-breakdown
description: Performs dimensional segmentation and calculates Rate vs. Mix effects of segment shifts.
---

# Skill: Segment Breakdown

## Overview
This skill segments the failing driver across categorical dimensions (e.g. device, campaign) and uses Rate-Mix-Interaction decomposition to check if the drop is due to a decline in segment performance (Rate) or a change in traffic composition (Mix).

## Dependencies
- [trend-analysis](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/skills/trend-analysis/SKILL.md): Guides the selection of the primary driver to slice, and provides the breakpoint date to set the pre- and post-drop filters.

## Quick Start
For each segment $i$:
$$\text{Rate Effect}_i = w_{i,0} \times (m_{i,1} - m_{i,0})$$
$$\text{Mix Effect}_i = m_{i,0} \times (w_{i,1} - w_{i,0})$$
Where $w$ represents segment share (weight) and $m$ represents segment performance.

## Workflow

### 1. Dimensional Aggregation
Write a script to aggregate data by segment dimensions for the previous and analysed periods.

### 2. Rate-Mix-Interaction Decomposition
Calculate effects for each segment using this script:
```python
import pandas as pd
import yaml

# Load config and segments
with open('analysis_config.yaml', 'r') as f:
    config = yaml.safe_load(f)

# (Assume df_prev and df_curr are loaded and filtered by period)
# Let's say we segment along 'device' for driver 'conversion_rate'
dim = 'device'
agg_p = df_prev.groupby(dim).agg(num=('orders', 'sum'), den=('sessions', 'sum'))
agg_c = df_curr.groupby(dim).agg(num=('orders', 'sum'), den=('sessions', 'sum'))

# Compute shares and values
agg_p['share'] = agg_p['den'] / agg_p['den'].sum()
agg_p['val'] = agg_p['num'] / agg_p['den']

agg_c['share'] = agg_c['den'] / agg_c['den'].sum()
agg_c['val'] = agg_c['num'] / agg_c['den']

merged = agg_p.join(agg_c, lsuffix='_prev', rsuffix='_curr', how='outer').fillna(0)

# Calculate effects
merged['rate_effect'] = merged['share_prev'] * (merged['val_curr'] - merged['val_prev'])
merged['mix_effect'] = merged['val_prev'] * (merged['share_curr'] - merged['share_prev'])
merged['interaction'] = (merged['share_curr'] - merged['share_prev']) * (merged['val_curr'] - merged['val_prev'])
merged['total_contribution'] = merged['rate_effect'] + merged['mix_effect'] + merged['interaction']

print(merged[['share_prev', 'share_curr', 'val_prev', 'val_curr', 'rate_effect', 'mix_effect', 'total_contribution']])
```

### 3. Identify Primary Dimensional Shift
Locate which dimension has the largest absolute contribution to the drop, and find the segment value driving the decline.

## Common Mistakes
- **Ignoring Interaction Effects**: Distributing only Rate and Mix when segment shares change significantly. This leaves a mathematical remainder. Use the 3-part decomposition (Rate, Mix, and Interaction).
- **Ignoring Low-Volume Segments**: Focusing on a segment that dropped by 90% but only has 0.1% volume weight, while ignoring a 2% drop in a segment that carries 90% of the volume. Always focus on **Total Contribution**.
- **Incorrect Denominators**: Dividing by total rows instead of the true mathematical base (e.g. using row counts instead of sessions for session-based rates).
