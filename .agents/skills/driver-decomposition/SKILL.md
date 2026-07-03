---
name: driver-decomposition
description: Decomposes a high-level metric into mathematical driver metrics and attributes the share of drop.
---

# Skill: Driver Decomposition

## Overview
This skill breaks down a primary high-level metric into its mathematical drivers (sub-metrics) and attributes the percentage contribution of each driver to the overall drop.

## Dependencies
- [drop-validation](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/skills/drop-validation/SKILL.md): Must run first to ensure the drop is real and to verify baseline period metrics.

## Quick Start
For a multiplicative formula $Y = A \times B$:
$$\ln(Y_1 / Y_0) = \ln(A_1 / A_0) + \ln(B_1 / B_0)$$
$$\text{Contribution of A} = \frac{\ln(A_1 / A_0)}{\ln(Y_1 / Y_0)} \times 100\%$$

## Workflow

### 1. Mathematical Formulas Definition
Parse formulas from `analysis_config.yaml`. Determine relationship type:
- **Additive**: $Y = A + B + C$
- **Multiplicative**: $Y = A \times B \times C$
- **Ratio/Division**: $Y = A / B$

### 2. Attribution Calculations
Write and run a Python script to calculate exact log-differences or absolute-differences:
```python
import pandas as pd
import numpy as np
import yaml

with open('analysis_config.yaml', 'r') as f:
    config = yaml.safe_load(f)

# Load data and filter periods
df = pd.read_csv(config['data_file_path'])
df[config['date_column']] = pd.to_datetime(df[config['date_column']])
date_col = config['date_column']

p_analysed = config['periods']['analysed_period']
p_previous = config['periods']['previous_period']

df_prev = df[(df[date_col] >= p_previous['start']) & (df[date_col] <= p_previous['end'])]
df_curr = df[(df[date_col] >= p_analysed['start']) & (df[date_col] <= p_analysed['end'])]

# Calculate values for primary metric Y and sub-metrics A, B
# e.g., Y = A * B
y0 = df_prev['orders'].sum() / df_prev['sessions'].sum()
a0 = df_prev['cart_adds'].sum() / df_prev['sessions'].sum()
b0 = df_prev['orders'].sum() / df_prev['cart_adds'].sum()

y1 = df_curr['orders'].sum() / df_curr['sessions'].sum()
a1 = df_curr['cart_adds'].sum() / df_curr['sessions'].sum()
b1 = df_curr['orders'].sum() / df_curr['cart_adds'].sum()

# Multiplicative Log decomposition
log_y = np.log(y1 / y0)
log_a = np.log(a1 / a0)
log_b = np.log(b1 / b0)

contrib_a = (log_a / log_y) * 100
contrib_b = (log_b / log_y) * 100

print(f"Total Log Change (Y): {log_y:.4f} (100.0%)")
print(f"Driver A Log Change: {log_a:.4f} ({contrib_a:.1f}%)")
print(f"Driver B Log Change: {log_b:.4f} ({contrib_b:.1f}%)")
```

## Common Mistakes
- **Linear Attribution on Multiplicative Formulas**: Using simple subtraction (e.g., $\Delta Y = \Delta A \times \Delta B$), which fails to attribute the joint product of change correctly. Always use Logarithmic Decomposition for multiplicative relations.
- **Formula Misalignment**: Computing drivers on different timeframes or filter scopes than the parent metric, leading to mathematical imbalances.
- **Ignoring Zero Denominators**: Failing to handle divisions by zero in ratio metrics when filtering down to short time ranges.
