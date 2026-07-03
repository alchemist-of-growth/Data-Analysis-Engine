---
name: drop-validation
description: Validates whether a metric drop is real or skewed by seasonality, promotions, outliers, or tracking errors.
---

# Skill: Drop Validation

## Overview
This skill is used to check if a reported drop in a primary metric represents a genuine negative performance change, or if it is merely statistical noise, seasonality, or baseline distortion.

## Dependencies
None. This is the entry point of the metric analysis pipeline.

## Quick Start
To validate a drop, load the dataset and filter the metric for the target date ranges:
```python
import pandas as pd
df = pd.read_csv("path/to/data.csv")
# Filter dates to calculate mean/sum of metric across:
# 1. Analysed Period (current)
# 2. Previous Period (baseline)
# 3. Same Period Last Year (YoY)
```

## Workflow

### 1. Data Parsing & Filtering
Verify that date formatting is correct and filter the dataset into the three target ranges:
- **Analysed Period**: Current range where the drop is observed.
- **Previous Period**: Sequential baseline range preceding the drop.
- **Same Period Last Year (YoY)**: Historical baseline range to control for seasonality.

### 2. Percentage Comparison
Calculate relative changes using the formula:
$$\text{Change WoW} = \frac{M_{\text{analysed}} - M_{\text{previous}}}{M_{\text{previous}}} \times 100\%$$
$$\text{Change YoY} = \frac{M_{\text{analysed}} - M_{\text{YoY}}}{M_{\text{YoY}}} \times 100\%$$

### 3. Outlier and Seasonality Check
Run the following Python script to check for statistical anomalies and skewing baseline factors:

```python
import pandas as pd
import numpy as np
import yaml

# Load config
with open('analysis_config.yaml', 'r') as f:
    config = yaml.safe_load(f)

df = pd.read_csv(config['data_file_path'])
df[config['date_column']] = pd.to_datetime(df[config['date_column']], format=config.get('date_format', None))

metric = config['metric']
date_col = config['date_column']

p_analysed = config['periods']['analysed_period']
p_previous = config['periods']['previous_period']
p_yoy = config['periods']['same_period_last_year']

# Segment
df_analysed = df[(df[date_col] >= p_analysed['start']) & (df[date_col] <= p_analysed['end'])]
df_previous = df[(df[date_col] >= p_previous['start']) & (df[date_col] <= p_previous['end'])]
df_yoy = df[(df[date_col] >= p_yoy['start']) & (df[date_col] <= p_yoy['end'])]

val_analysed = df_analysed[metric].mean()
val_previous = df_previous[metric].mean()
val_yoy = df_yoy[metric].mean()

# WoW and YoY shifts
wow_change = (val_analysed - val_previous) / val_previous * 100
yoy_change = (val_analysed - val_yoy) / val_yoy * 100

print(f"Analysed Period Value: {val_analysed:.4f}")
print(f"Previous Period Value: {val_previous:.4f} (WoW: {wow_change:+.2f}%)")
print(f"Same Period Last Year Value: {val_yoy:.4f} (YoY: {yoy_change:+.2f}%)")

# Outliers check: Look for Z-score < -3
daily_metric = df_analysed.groupby(df_analysed[date_col].dt.date)[metric].mean()
z_scores = (daily_metric - daily_metric.mean()) / daily_metric.std()
outliers = daily_metric[z_scores < -3]
print("Outlier Days (Z < -3):", list(outliers.index))
```

## Common Mistakes
- **Ignoring Seasonality**: Assuming a drop is a bug when YoY comparison shows a matching seasonal drop every year.
- **Ignoring Baseline Skew**: Comparing against a previous week that had an abnormally high spike due to a promotion, which creates a false drop impression.
- **Aggregate Outliers**: Not looking at daily/granular trends to see if a single outlier transaction or date caused the entire drop.
