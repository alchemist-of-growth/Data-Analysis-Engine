---
name: segment-comparison
description: Performs contrast and cohort analysis comparing test (failing) vs. control (stable) segments.
---

# Skill: Segment Comparison

## Overview
This skill contrasts the failing segment (test group) with a stable segment (control group) during the analysed period to isolate key differences in secondary features, configuration mixes, or performance metrics.

## Dependencies
- [segment-breakdown](file:///Users/nishantagarwal/Documents/Data%20Analysis%20Engine/.agents/skills/segment-breakdown/SKILL.md): Identified the failing segment and the stable segment to compare.

## Quick Start
Split the dataset in the analysed period into test and control dataframes:
```python
df_test = df[df['device'] == 'Mobile']       # Test group
df_control = df[df['device'] == 'Desktop']   # Control group
# Contrast their browser, version, campaign, and error distributions.
```

## Workflow

### 1. Cohort Extraction
Filter the post-drop dataset into the Test Group (failing cohort) and Control Group (stable baseline cohort).

### 2. Categorical Distribution Contrast
Write and run a script to cross-tabulate distributions of categorical columns:
```python
def contrast_categorical(df_t, df_c, column):
    dist_t = df_t[column].value_counts(normalize=True).to_frame(name='Test_Share')
    dist_c = df_c[column].value_counts(normalize=True).to_frame(name='Control_Share')
    contrasted = dist_t.join(dist_c, how='outer').fillna(0)
    contrasted['Diff'] = contrasted['Test_Share'] - contrasted['Control_Share']
    return contrasted.sort_values(by='Diff', ascending=False)
```

### 3. Continuous Metric Contrast
Compare averages of latency, duration, or numeric error counts:
```python
# Compare means, medians, and standard deviations of metric columns (e.g. error_count, page_load_ms)
# between df_test and df_control.
```

## Common Mistakes
- **Ignoring Sample Size**: Drawing conclusions from a tiny test group (e.g. 5 sessions) compared to a huge control group (e.g. 10,000 sessions). Check sample sizes first.
- **Overlooking Confounding Variables**: Concluding that "Safari is buggy" when actually Safari is 95% mobile traffic, and the mobile site has a general bug. Control for parent variables (like device).
- **Comparing Different Time Periods**: Comparing test group post-drop vs control group pre-drop. Keep both cohorts in the **post-drop (analysed)** timeframe.
