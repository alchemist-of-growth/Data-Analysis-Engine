// Browser-local analytical engine for PM-ready metric-drop diagnosis.

const EPSILON = 1e-9;

const toNumber = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pct = (value) => `${(value * 100).toFixed(2)}%`;

const pctChange = (current, previous) => (
  Math.abs(previous) > EPSILON ? ((current - previous) / previous) * 100 : 0
);

const safeLogRatio = (current, previous) => {
  if (current <= 0 || previous <= 0) return 0;
  return Math.log(current / previous);
};

const periodRows = (data, dateCol, period = {}) => {
  if (!dateCol || !period.start || !period.end) return [];
  return data.filter((row) => {
    const value = row[dateCol];
    return value >= period.start && value <= period.end;
  });
};

export function buildDataQualityReport(data, config, metricConfig) {
  const issues = [];
  const warnings = [];

  if (!data.length) issues.push("No rows were found in the dataset.");
  if (!config?.date_column) issues.push("Choose a date column before running the diagnosis.");
  if (!metricConfig?.primary?.num || !metricConfig?.primary?.den) {
    issues.push("Map the primary metric numerator and denominator.");
  }

  const requiredPeriods = ["analysed_period", "previous_period"];
  requiredPeriods.forEach((key) => {
    if (!config?.periods?.[key]?.start || !config?.periods?.[key]?.end) {
      issues.push(`Set the ${key.replace(/_/g, " ")} start and end dates.`);
    }
  });

  const analysedRows = periodRows(data, config?.date_column, config?.periods?.analysed_period);
  const previousRows = periodRows(data, config?.date_column, config?.periods?.previous_period);
  const yoyRows = periodRows(data, config?.date_column, config?.periods?.same_period_last_year);

  if (config?.periods?.analysed_period?.start && analysedRows.length === 0) {
    issues.push("The analysed period has no matching rows.");
  }
  if (config?.periods?.previous_period?.start && previousRows.length === 0) {
    issues.push("The previous period has no matching rows.");
  }
  if (config?.periods?.same_period_last_year?.start && yoyRows.length === 0) {
    warnings.push("No YoY rows were found. Seasonality confidence will be lower.");
  }
  if (!config?.segments?.length) {
    warnings.push("No segment fields were selected. Cohort localization will be limited.");
  }
  if (!Object.keys(metricConfig?.drivers || {}).length) {
    warnings.push("No driver metrics were mapped. Decomposition will fall back to the primary metric.");
  }

  return {
    ok: issues.length === 0,
    issues,
    warnings,
    rowCounts: {
      total: data.length,
      analysed: analysedRows.length,
      previous: previousRows.length,
      yoy: yoyRows.length,
    },
  };
}

export function aggregatePeriod(data, dateCol, start, end, metricConfig) {
  const subset = data.filter((row) => {
    const value = row[dateCol];
    return value >= start && value <= end;
  });

  const results = {
    primary: 0,
    primary_num: 0,
    primary_den: 0,
    drivers: {},
    secondary: {},
    rowCount: subset.length,
  };

  if (subset.length === 0 || !metricConfig?.primary?.num || !metricConfig?.primary?.den) {
    return results;
  }

  const pNum = subset.reduce((acc, row) => acc + toNumber(row[metricConfig.primary.num]), 0);
  const pDen = subset.reduce((acc, row) => acc + toNumber(row[metricConfig.primary.den]), 0);
  results.primary = pDen > 0 ? pNum / pDen : 0;
  results.primary_num = pNum;
  results.primary_den = pDen;

  Object.keys(metricConfig.drivers || {}).forEach((driverKey) => {
    const driverConfig = metricConfig.drivers[driverKey];
    const dNum = subset.reduce((acc, row) => acc + toNumber(row[driverConfig.num]), 0);
    const dDen = subset.reduce((acc, row) => acc + toNumber(row[driverConfig.den]), 0);
    results.drivers[driverKey] = dDen > 0 ? dNum / dDen : 0;
    results.drivers[`${driverKey}_num`] = dNum;
    results.drivers[`${driverKey}_den`] = dDen;
  });

  const numericCandidates = Object.keys(subset[0] || {}).filter((col) => {
    if ([metricConfig.primary.num, metricConfig.primary.den].includes(col)) return false;
    return subset.some((row) => Number.isFinite(parseFloat(row[col])));
  });

  numericCandidates.forEach((col) => {
    const sum = subset.reduce((acc, row) => acc + toNumber(row[col]), 0);
    results.secondary[col] = sum / subset.length;
  });

  return results;
}

export function runDropValidation(data, config, metricConfig) {
  const dateCol = config.date_column;
  const quality = buildDataQualityReport(data, config, metricConfig);
  const analysed = aggregatePeriod(data, dateCol, config.periods.analysed_period.start, config.periods.analysed_period.end, metricConfig);
  const previous = aggregatePeriod(data, dateCol, config.periods.previous_period.start, config.periods.previous_period.end, metricConfig);
  const yoy = aggregatePeriod(data, dateCol, config.periods.same_period_last_year.start, config.periods.same_period_last_year.end, metricConfig);

  const wowChange = pctChange(analysed.primary, previous.primary);
  const yoyChange = pctChange(analysed.primary, yoy.primary);

  const dateMap = {};
  periodRows(data, dateCol, config.periods.analysed_period).forEach((row) => {
    const date = row[dateCol];
    if (!dateMap[date]) dateMap[date] = { num: 0, den: 0 };
    dateMap[date].num += toNumber(row[metricConfig.primary.num]);
    dateMap[date].den += toNumber(row[metricConfig.primary.den]);
  });

  const dailyValues = Object.keys(dateMap).map((date) => (
    dateMap[date].den > 0 ? dateMap[date].num / dateMap[date].den : 0
  ));
  const avg = dailyValues.reduce((acc, value) => acc + value, 0) / (dailyValues.length || 1);
  const std = Math.sqrt(
    dailyValues.map((value) => Math.pow(value - avg, 2)).reduce((acc, value) => acc + value, 0) /
    (dailyValues.length || 1)
  );

  const outliers = Object.keys(dateMap)
    .map((date) => {
      const value = dateMap[date].den > 0 ? dateMap[date].num / dateMap[date].den : 0;
      const zScore = std > 0 ? (value - avg) / std : 0;
      return { date, value, zScore };
    })
    .filter((row) => row.zScore < -2)
    .sort((a, b) => a.zScore - b.zScore);

  const hasYoy = yoy.rowCount > 0 && yoy.primary_den > 0;
  const isReal = wowChange < -5 && (!hasYoy || yoyChange < -2);
  const isSeasonal = wowChange < -5 && hasYoy && Math.abs(yoyChange) < 3;
  const confidence = !quality.ok
    ? "Blocked"
    : isReal && Math.abs(wowChange) > 15
      ? "High"
      : isReal || isSeasonal || outliers.length > 0
        ? "Medium"
        : "Low";
  const verdict = isSeasonal
    ? "Likely seasonal"
    : isReal
      ? "Real drop"
      : outliers.length > 0
        ? "Outlier-led"
        : "Likely noise";

  return {
    analysedValue: analysed.primary,
    previousValue: previous.primary,
    yoyValue: yoy.primary,
    wowChange,
    yoyChange,
    outliers,
    isReal,
    isSeasonal,
    verdict,
    confidence,
    quality,
    interpretation: {
      whatChanged: `${config.metric} moved from ${pct(previous.primary)} to ${pct(analysed.primary)} (${wowChange.toFixed(1)}% WoW).`,
      whyItMatters: isReal
        ? "The drop clears the practical threshold for investigation and is not explained away by the available baseline."
        : "The movement is not yet strong enough to treat as a confirmed incident without more corroborating evidence.",
      couldDisprove: "A missing baseline period, changed tracking, or a known planned seasonal cycle could weaken this conclusion.",
      nextAction: isReal ? "Continue to driver decomposition." : "Check tracking and period selection before escalating.",
    },
  };
}

export function runDriverDecomposition(data, config, metricConfig) {
  const dateCol = config.date_column;
  const analysed = aggregatePeriod(data, dateCol, config.periods.analysed_period.start, config.periods.analysed_period.end, metricConfig);
  const previous = aggregatePeriod(data, dateCol, config.periods.previous_period.start, config.periods.previous_period.end, metricConfig);
  const yRatio = safeLogRatio(analysed.primary, previous.primary);

  const driverEntries = Object.keys(metricConfig.drivers || {}).length
    ? Object.keys(metricConfig.drivers)
    : [config.metric];

  const contributions = driverEntries.map((driverKey) => {
    const previousValue = driverKey === config.metric ? previous.primary : previous.drivers[driverKey];
    const currentValue = driverKey === config.metric ? analysed.primary : analysed.drivers[driverKey];
    const dRatio = safeLogRatio(currentValue, previousValue);

    return {
      driver: driverKey,
      previous: previousValue || 0,
      current: currentValue || 0,
      absChange: (currentValue || 0) - (previousValue || 0),
      pctChange: pctChange(currentValue || 0, previousValue || 0),
      contribution: Math.abs(yRatio) > EPSILON ? (dRatio / yRatio) * 100 : 0,
    };
  });

  const sorted = [...contributions].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const primaryDriver = sorted[0]?.driver || "";
  const primaryContribution = sorted[0]?.contribution || 0;

  return {
    primaryMetricValuePrev: previous.primary,
    primaryMetricValueCurr: analysed.primary,
    wowChange: pctChange(analysed.primary, previous.primary),
    contributions,
    primaryDriver,
    confidence: primaryDriver && Math.abs(primaryContribution) > 50 ? "High" : primaryDriver ? "Medium" : "Low",
    interpretation: {
      whatChanged: primaryDriver
        ? `${primaryDriver.replace(/_/g, " ")} is the leading driver, explaining ${primaryContribution.toFixed(1)}% of the log-ratio movement.`
        : "No driver metric was available, so the app cannot attribute the drop below the primary metric.",
      whyItMatters: "Driver attribution tells a PM which funnel step or business lever deserves investigation first.",
      couldDisprove: "If the metric formula is incomplete, attribution can overstate one driver and hide a missing factor.",
      nextAction: primaryDriver ? "Inspect the timeline for this driver." : "Add driver metrics to improve attribution.",
    },
  };
}

export function runTrendAnalysis(data, config, metricConfig, primaryDriver) {
  const dateCol = config.date_column;
  const dailyMap = {};

  data.forEach((row) => {
    const date = row[dateCol];
    if (!date) return;
    if (!dailyMap[date]) {
      dailyMap[date] = { primary_num: 0, primary_den: 0, driver_num: 0, driver_den: 0 };
    }

    dailyMap[date].primary_num += toNumber(row[metricConfig.primary.num]);
    dailyMap[date].primary_den += toNumber(row[metricConfig.primary.den]);

    if (primaryDriver && metricConfig.drivers?.[primaryDriver]) {
      const driverConfig = metricConfig.drivers[primaryDriver];
      dailyMap[date].driver_num += toNumber(row[driverConfig.num]);
      dailyMap[date].driver_den += toNumber(row[driverConfig.den]);
    }
  });

  const dailyList = Object.keys(dailyMap)
    .map((date) => {
      const row = dailyMap[date];
      return {
        date,
        primary: row.primary_den > 0 ? row.primary_num / row.primary_den : 0,
        driver: row.driver_den > 0 ? row.driver_num / row.driver_den : null,
      };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const baselineList = dailyList.filter((row) => row.date < config.periods.analysed_period.start);
  const baselineValues = baselineList.map((row) => row.primary).filter((value) => value > 0);
  const baselineAvg = baselineValues.reduce((acc, value) => acc + value, 0) / (baselineValues.length || 1);
  const std = Math.sqrt(
    baselineValues.map((value) => Math.pow(value - baselineAvg, 2)).reduce((acc, value) => acc + value, 0) /
    (baselineValues.length || 1)
  );
  const threshold = baselineAvg - 2.5 * std;
  const dropRangeList = dailyList.filter((row) => (
    row.date >= config.periods.analysed_period.start && row.date <= config.periods.analysed_period.end
  ));

  let breakpoint = dropRangeList.find((row) => row.primary < threshold)?.date || null;
  if (!breakpoint && dropRangeList.length) {
    const sortedByDrop = [...dropRangeList].sort((a, b) => a.primary - b.primary);
    breakpoint = sortedByDrop[0].date;
  }

  let pattern = "Volatile";
  if (breakpoint) {
    const bpIndex = dailyList.findIndex((row) => row.date === breakpoint);
    const prev = dailyList[bpIndex - 1]?.primary || 0;
    const current = dailyList[bpIndex]?.primary || 0;
    const dailyDrop = prev > 0 ? (current - prev) / prev : 0;
    pattern = dailyDrop < -0.15 ? "Sudden step-change" : "Gradual decay";
  }

  return {
    dailyList,
    breakpoint: breakpoint || config.periods.analysed_period.start,
    pattern,
    baselineAvg,
    threshold,
    confidence: baselineValues.length >= 14 ? "High" : baselineValues.length >= 5 ? "Medium" : "Low",
    interpretation: {
      whatChanged: `The first notable deviation appears around ${breakpoint || config.periods.analysed_period.start}.`,
      whyItMatters: "A breakpoint narrows the search to releases, campaigns, outages, pricing changes, or tracking changes around that date.",
      couldDisprove: "Sparse daily data or low volume can make the detected date approximate.",
      nextAction: "Compare failing and stable cohorts around the breakpoint.",
    },
  };
}

export function runSegmentBreakdown(data, config, metricConfig, primaryDriver) {
  const dateCol = config.date_column;
  const previousRows = periodRows(data, dateCol, config.periods.previous_period);
  const currentRows = periodRows(data, dateCol, config.periods.analysed_period);
  const driverConfig = metricConfig.drivers?.[primaryDriver] || metricConfig.primary;
  const breakdowns = {};

  (config.segments || []).forEach((dimension) => {
    const previousAgg = {};
    const currentAgg = {};

    previousRows.forEach((row) => {
      const value = row[dimension] || "Unknown";
      if (!previousAgg[value]) previousAgg[value] = { num: 0, den: 0 };
      previousAgg[value].num += toNumber(row[driverConfig.num]);
      previousAgg[value].den += toNumber(row[driverConfig.den]);
    });

    currentRows.forEach((row) => {
      const value = row[dimension] || "Unknown";
      if (!currentAgg[value]) currentAgg[value] = { num: 0, den: 0 };
      currentAgg[value].num += toNumber(row[driverConfig.num]);
      currentAgg[value].den += toNumber(row[driverConfig.den]);
    });

    const totalDenPrev = Object.values(previousAgg).reduce((acc, row) => acc + row.den, 0);
    const totalDenCurr = Object.values(currentAgg).reduce((acc, row) => acc + row.den, 0);
    const allSegments = Array.from(new Set([...Object.keys(previousAgg), ...Object.keys(currentAgg)]));

    breakdowns[dimension] = allSegments.map((segment) => {
      const pDen = previousAgg[segment]?.den || 0;
      const pNum = previousAgg[segment]?.num || 0;
      const cDen = currentAgg[segment]?.den || 0;
      const cNum = currentAgg[segment]?.num || 0;
      const w0 = totalDenPrev > 0 ? pDen / totalDenPrev : 0;
      const w1 = totalDenCurr > 0 ? cDen / totalDenCurr : 0;
      const m0 = pDen > 0 ? pNum / pDen : 0;
      const m1 = cDen > 0 ? cNum / cDen : 0;
      const rateEffect = w0 * (m1 - m0);
      const mixEffect = m0 * (w1 - w0);
      const interaction = (w1 - w0) * (m1 - m0);

      return {
        segment,
        sharePrev: w0 * 100,
        shareCurr: w1 * 100,
        metricPrev: m0,
        metricCurr: m1,
        rateEffect,
        mixEffect,
        interaction,
        totalContribution: rateEffect + mixEffect + interaction,
      };
    }).sort((a, b) => a.totalContribution - b.totalContribution);
  });

  let worstDimension = "";
  let worstSegment = "";
  let worstContribution = 0;

  Object.keys(breakdowns).forEach((dimension) => {
    const row = breakdowns[dimension][0];
    if (row && row.totalContribution < worstContribution) {
      worstContribution = row.totalContribution;
      worstDimension = dimension;
      worstSegment = row.segment;
    }
  });

  return {
    breakdowns,
    worstDimension,
    worstSegment,
    worstContribution,
    confidence: worstDimension && Math.abs(worstContribution) > 0.01 ? "High" : worstDimension ? "Medium" : "Low",
    interpretation: {
      whatChanged: worstDimension
        ? `${worstDimension}=${worstSegment} is the largest negative segment contributor.`
        : "No segment stood out as the clear source of impact.",
      whyItMatters: "Segment impact tells the PM whether to route the investigation to platform, market, acquisition, pricing, or lifecycle owners.",
      couldDisprove: "Very small segment sizes can look dramatic without explaining much total business impact.",
      nextAction: worstDimension ? "Compare this failing cohort against the rest." : "Add richer segment columns.",
    },
  };
}

export function runSegmentComparison(data, config, metricConfig, worstDimension, worstSegment) {
  const dateCol = config.date_column;
  const currentRows = periodRows(data, dateCol, config.periods.analysed_period);

  if (!worstDimension || !worstSegment) {
    return {
      contrasts: [],
      continuousCompare: [],
      testSize: 0,
      controlSize: 0,
      message: "No failing cohort was identified.",
      confidence: "Low",
      interpretation: {
        whatChanged: "The app could not form a failing cohort.",
        whyItMatters: "Without a cohort, comparison evidence is unavailable.",
        couldDisprove: "Selecting more segment fields or widening the analysis period may create a useful cohort.",
        nextAction: "Inspect segment selection and data volume.",
      },
    };
  }

  const testGroup = currentRows.filter((row) => (row[worstDimension] || "Unknown") === worstSegment);
  const controlGroup = currentRows.filter((row) => (row[worstDimension] || "Unknown") !== worstSegment);

  if (!testGroup.length || !controlGroup.length) {
    return {
      contrasts: [],
      continuousCompare: [],
      testSize: testGroup.length,
      controlSize: controlGroup.length,
      message: "Insufficient comparison cohorts.",
      confidence: "Low",
      interpretation: {
        whatChanged: "There are not enough test and control rows to compare.",
        whyItMatters: "A comparison needs both a failing group and a stable reference group.",
        couldDisprove: "More rows or broader segments may create a valid comparison.",
        nextAction: "Use a broader period or a less granular segment.",
      },
    };
  }

  const contrasts = (config.segments || [])
    .filter((dimension) => dimension !== worstDimension)
    .map((dimension) => {
      const testCounts = {};
      const controlCounts = {};

      testGroup.forEach((row) => {
        const value = row[dimension] || "Unknown";
        testCounts[value] = (testCounts[value] || 0) + 1;
      });
      controlGroup.forEach((row) => {
        const value = row[dimension] || "Unknown";
        controlCounts[value] = (controlCounts[value] || 0) + 1;
      });

      const allKeys = Array.from(new Set([...Object.keys(testCounts), ...Object.keys(controlCounts)]));
      return {
        dimension,
        distribution: allKeys.map((key) => {
          const testShare = (testCounts[key] || 0) / testGroup.length;
          const controlShare = (controlCounts[key] || 0) / controlGroup.length;
          return {
            key,
            testShare: testShare * 100,
            controlShare: controlShare * 100,
            diff: (testShare - controlShare) * 100,
          };
        }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)),
      };
    });

  const categorical = new Set([dateCol, ...(config.segments || [])]);
  const usedMetricCols = new Set([
    metricConfig.primary.num,
    metricConfig.primary.den,
    ...Object.values(metricConfig.drivers || {}).flatMap((driver) => [driver.num, driver.den]),
  ]);
  const continuousCols = Object.keys(currentRows[0] || {}).filter((col) => {
    if (categorical.has(col) || usedMetricCols.has(col)) return false;
    return currentRows.some((row) => Number.isFinite(parseFloat(row[col])));
  });

  const continuousCompare = continuousCols.map((metric) => {
    const testMean = testGroup.reduce((acc, row) => acc + toNumber(row[metric]), 0) / testGroup.length;
    const controlMean = controlGroup.reduce((acc, row) => acc + toNumber(row[metric]), 0) / controlGroup.length;
    return {
      metric,
      testMean,
      controlMean,
      diffPct: pctChange(testMean, controlMean),
    };
  }).sort((a, b) => Math.abs(b.diffPct) - Math.abs(a.diffPct));

  const topContrast = contrasts.flatMap((contrast) => (
    contrast.distribution[0] ? [{ ...contrast.distribution[0], dimension: contrast.dimension }] : []
  )).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];

  return {
    contrasts,
    continuousCompare,
    testSize: testGroup.length,
    controlSize: controlGroup.length,
    confidence: testGroup.length >= 20 && controlGroup.length >= 20 ? "High" : "Medium",
    interpretation: {
      whatChanged: topContrast
        ? `The failing cohort is most differentiated by ${topContrast.dimension}=${topContrast.key}.`
        : "No secondary categorical contrast stands out.",
      whyItMatters: "Cohort contrast turns a segment finding into a more precise investigation clue.",
      couldDisprove: "If rows are pre-aggregated too coarsely, cohort contrast may reflect data grain rather than user behavior.",
      nextAction: "Convert the strongest contrasts into root-cause hypotheses.",
    },
  };
}

export function runHypothesisGeneration(valRes, decRes, trendRes, breakRes, compRes, worstDimension, worstSegment, config) {
  const hypotheses = [];
  const mainDriver = decRes.primaryDriver || config.metric;
  const changePct = valRes.wowChange.toFixed(1);
  const errorComp = compRes.continuousCompare?.find((row) => row.metric.toLowerCase().includes("error"));
  const latencyComp = compRes.continuousCompare?.find((row) => (
    row.metric.toLowerCase().includes("load") ||
    row.metric.toLowerCase().includes("latency") ||
    row.metric.toLowerCase().includes("ms")
  ));
  const topCategorical = compRes.contrasts
    ?.flatMap((contrast) => (
      contrast.distribution[0] ? [{ ...contrast.distribution[0], dimension: contrast.dimension }] : []
    ))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];

  if (errorComp && errorComp.diffPct > 40) {
    hypotheses.push({
      title: "Client or backend error spike in the failing cohort",
      confidence: "High",
      owner: "Engineering",
      observation: `${errorComp.metric.replace(/_/g, " ")} is ${errorComp.diffPct.toFixed(0)}% higher in the failing cohort.`,
      cause: `A flow-breaking exception or failed request is suppressing ${mainDriver.replace(/_/g, " ")} for ${worstDimension}=${worstSegment}.`,
      validation: `Check application logs, release diffs, and error monitoring filtered to ${worstDimension}=${worstSegment} after ${trendRes.breakpoint}.`,
    });
  }

  if (latencyComp && latencyComp.diffPct > 20) {
    hypotheses.push({
      title: "Performance regression changed user behavior",
      confidence: latencyComp.diffPct > 50 ? "High" : "Medium",
      owner: "Web or Platform",
      observation: `${latencyComp.metric.replace(/_/g, " ")} is ${latencyComp.diffPct.toFixed(0)}% higher for the failing cohort.`,
      cause: "Slower load or response times are creating abandonment before the target action completes.",
      validation: `Review CDN, frontend bundle, API timing, and Core Web Vitals around ${trendRes.breakpoint}.`,
    });
  }

  if (topCategorical && Math.abs(topCategorical.diff) > 10) {
    hypotheses.push({
      title: `Interaction issue concentrated in ${topCategorical.dimension}`,
      confidence: Math.abs(topCategorical.diff) > 25 ? "High" : "Medium",
      owner: "Product and Design",
      observation: `The failing cohort over-indexes on ${topCategorical.dimension}=${topCategorical.key} by ${topCategorical.diff.toFixed(1)} points.`,
      cause: `A UX, eligibility, messaging, or compatibility issue may affect the intersection of ${worstDimension}=${worstSegment} and ${topCategorical.dimension}=${topCategorical.key}.`,
      validation: "Replay the end-to-end user flow for that exact cohort and compare feature flags, copy, eligibility, and layout.",
    });
  }

  if (!hypotheses.length) {
    hypotheses.push({
      title: "Configuration, traffic quality, or tracking shift",
      confidence: valRes.isReal ? "Medium" : "Low",
      owner: "Analytics and PM",
      observation: `${mainDriver.replace(/_/g, " ")} changed around ${trendRes.breakpoint}, but comparison signals are not decisive.`,
      cause: "The most likely cause is a tracking change, rollout configuration, or traffic-quality shift not represented in the uploaded columns.",
      validation: `Audit tracking changes, campaign mix, launches, and feature flags from ${trendRes.breakpoint}.`,
    });
  }

  const executiveSummary = `${config.metric} ${valRes.wowChange < 0 ? "dropped" : "changed"} ${changePct}% WoW. The strongest evidence points to ${mainDriver.replace(/_/g, " ")} around ${trendRes.breakpoint}, concentrated in ${worstDimension || "no clear dimension"}${worstSegment ? `=${worstSegment}` : ""}.`;
  const validationChecklist = [
    `Check launches, experiments, and feature flags around ${trendRes.breakpoint}.`,
    worstDimension ? `Replay the user flow for ${worstDimension}=${worstSegment}.` : "Add segment fields to localize the cohort.",
    `Review the instrumentation for ${config.metric} and ${mainDriver.replace(/_/g, " ")}.`,
    "Compare the failing cohort against a stable control in logs or session replay.",
  ];

  return {
    hypotheses,
    executiveSummary,
    validationChecklist,
    confidence: hypotheses[0]?.confidence || "Low",
    interpretation: {
      whatChanged: executiveSummary,
      whyItMatters: "The final module turns analysis into an investigation plan with owners and falsifiable checks.",
      couldDisprove: "A missing explanatory column, broken tracking, or external event could change the leading hypothesis.",
      nextAction: "Export the brief and route the validation checklist to the right team.",
    },
  };
}
