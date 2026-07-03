import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  CheckCircle,
  ClipboardList,
  Cpu,
  Download,
  FileText,
  Gauge,
  GitCompare,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
} from "lucide-react";
import { ecommerceData, saasSubscriptionData } from "./data/sandbox";
import {
  analyzeDatasetReadiness,
  buildDataQualityReport,
  runDropValidation,
  runDriverDecomposition,
  runHypothesisGeneration,
  runSegmentBreakdown,
  runSegmentComparison,
  runTrendAnalysis,
} from "./utils/analysisEngine";

const metricTemplates = [
  {
    id: "conversion",
    label: "Conversion funnel",
    description: "Sessions to orders across product or checkout steps.",
    metric: "Conversion_Rate",
    primaryHint: ["orders", "sessions"],
    drivers: [
      { name: "Add_to_Cart_Rate", hint: ["add_to_cart_clicks", "sessions"] },
      { name: "Cart_to_Purchase_Rate", hint: ["orders", "add_to_cart_clicks"] },
    ],
  },
  {
    id: "activation",
    label: "Activation funnel",
    description: "Visitors to trials, signups, paid plans, or first success.",
    metric: "Activation_Rate",
    primaryHint: ["paid_subscriptions", "visitors"],
    drivers: [
      { name: "Trial_Start_Rate", hint: ["trials", "visitors"] },
      { name: "Trial_to_Paid_Rate", hint: ["paid_subscriptions", "trials"] },
    ],
  },
  {
    id: "retention",
    label: "Retention",
    description: "Users returning, renewing, or completing repeat behavior.",
    metric: "Retention_Rate",
    primaryHint: ["retained_users", "eligible_users"],
    drivers: [
      { name: "Eligible_to_Active_Rate", hint: ["active_users", "eligible_users"] },
      { name: "Active_to_Retained_Rate", hint: ["retained_users", "active_users"] },
    ],
  },
  {
    id: "revenue",
    label: "Revenue",
    description: "Orders, average order value, subscriptions, or monetization.",
    metric: "Revenue_Rate",
    primaryHint: ["revenue", "visitors"],
    drivers: [
      { name: "Purchase_Rate", hint: ["orders", "visitors"] },
      { name: "Revenue_per_Order", hint: ["revenue", "orders"] },
    ],
  },
  {
    id: "support",
    label: "Support/contact rate",
    description: "Tickets or contacts per active user, order, or session.",
    metric: "Contact_Rate",
    primaryHint: ["tickets", "users"],
    drivers: [
      { name: "Issue_Rate", hint: ["issue_events", "users"] },
      { name: "Issue_to_Ticket_Rate", hint: ["tickets", "issue_events"] },
    ],
  },
];

const moduleDefinitions = [
  {
    step: 1,
    key: "validation",
    title: "Validate The Drop",
    shortTitle: "Validate",
    icon: ShieldCheck,
    question: "Is the metric movement real enough to investigate?",
  },
  {
    step: 2,
    key: "decomposition",
    title: "Decompose Drivers",
    shortTitle: "Drivers",
    icon: BarChart2,
    question: "Which driver explains the largest share of the movement?",
  },
  {
    step: 3,
    key: "trend",
    title: "Find The Breakpoint",
    shortTitle: "Breakpoint",
    icon: TrendingUp,
    question: "When did the issue start, and what shape did it take?",
  },
  {
    step: 4,
    key: "breakdown",
    title: "Segment The Impact",
    shortTitle: "Segments",
    icon: Layers,
    question: "Where is the business impact concentrated?",
  },
  {
    step: 5,
    key: "comparison",
    title: "Compare Cohorts",
    shortTitle: "Compare",
    icon: GitCompare,
    question: "What differs between failing and stable cohorts?",
  },
  {
    step: 6,
    key: "hypothesis",
    title: "Generate Hypotheses",
    shortTitle: "Hypotheses",
    icon: Sparkles,
    question: "What should the PM validate next?",
  },
];

const formatRate = (value) => `${((value || 0) * 100).toFixed(2)}%`;
const formatSigned = (value) => `${value > 0 ? "+" : ""}${(value || 0).toFixed(1)}%`;
const titleize = (value = "") => value.replace(/_/g, " ");

function detectColumn(columns, hints = []) {
  const normalized = columns.map((column) => ({ column, lower: column.toLowerCase() }));
  return hints
    .map((hint) => normalized.find((entry) => entry.lower === hint.toLowerCase())?.column)
    .find(Boolean) || "";
}

function Badge({ tone = "neutral", children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

const readinessTone = (status) => {
  if (status === "Ready") return "green";
  if (status === "Partial") return "yellow";
  return "danger";
};

function EvidenceCard({ title, icon: Icon = ClipboardList, children }) {
  return (
    <section className="evidence-card">
      <div className="evidence-heading">
        <Icon size={17} />
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function InsightBlock({ insight }) {
  if (!insight) return null;

  return (
    <div className="insight-grid">
      <div>
        <span className="insight-label">What changed</span>
        <p>{insight.whatChanged}</p>
      </div>
      <div>
        <span className="insight-label">Why it matters</span>
        <p>{insight.whyItMatters}</p>
      </div>
      <div>
        <span className="insight-label">Could disprove</span>
        <p>{insight.couldDisprove}</p>
      </div>
      <div>
        <span className="insight-label">Next action</span>
        <p>{insight.nextAction}</p>
      </div>
    </div>
  );
}

function App() {
  const [data, setData] = useState([]);
  const [fileName, setFileName] = useState("");
  const [config, setConfig] = useState(null);
  const [metricConfig, setMetricConfig] = useState(null);
  const [isWizard, setIsWizard] = useState(false);
  const [availableColumns, setAvailableColumns] = useState([]);
  const [activeStep, setActiveStep] = useState(1);
  const [results, setResults] = useState(null);
  const [selectedSegmentDim, setSelectedSegmentDim] = useState("");
  const [formErrors, setFormErrors] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("conversion");
  const [wizardConfig, setWizardConfig] = useState({
    metric: "Conversion_Rate",
    date_column: "",
    primary_num: "",
    primary_den: "",
    periods: {
      analysed_period: { start: "", end: "" },
      previous_period: { start: "", end: "" },
      same_period_last_year: { start: "", end: "" },
    },
    segments: [],
    drivers: [
      { name: "Add_to_Cart_Rate", num: "", den: "" },
      { name: "Cart_to_Purchase_Rate", num: "", den: "" },
    ],
  });

  const qualityReport = useMemo(() => (
    data.length && config && metricConfig
      ? buildDataQualityReport(data, config, metricConfig)
      : null
  ), [data, config, metricConfig]);

  const activeModule = moduleDefinitions.find((module) => module.step === activeStep) || moduleDefinitions[0];

  const currentSummary = useMemo(() => {
    if (!results) return null;
    const { validation, decomposition, trend, breakdown, hypothesis } = results;
    return {
      verdict: validation.verdict,
      confidence: hypothesis.confidence || validation.confidence,
      drop: formatSigned(validation.wowChange),
      driver: decomposition.primaryDriver ? titleize(decomposition.primaryDriver) : "Not available",
      breakpoint: trend.breakpoint,
      cohort: breakdown.worstDimension
        ? `${breakdown.worstDimension}=${breakdown.worstSegment}`
        : "No clear cohort",
      likelyCause: hypothesis.hypotheses[0]?.title || "Needs investigation",
      nextCheck: hypothesis.validationChecklist?.[0] || "Review metric setup.",
    };
  }, [results]);

  const applyTemplate = (templateId, columns = availableColumns) => {
    const template = metricTemplates.find((item) => item.id === templateId) || metricTemplates[0];
    setSelectedTemplateId(template.id);
    setWizardConfig((prev) => ({
      ...prev,
      metric: template.metric,
      primary_num: detectColumn(columns, [template.primaryHint[0], prev.primary_num]) || prev.primary_num,
      primary_den: detectColumn(columns, [template.primaryHint[1], prev.primary_den]) || prev.primary_den,
      drivers: template.drivers.map((driver, index) => ({
        name: driver.name,
        num: detectColumn(columns, [driver.hint[0], prev.drivers[index]?.num]) || prev.drivers[index]?.num || "",
        den: detectColumn(columns, [driver.hint[1], prev.drivers[index]?.den]) || prev.drivers[index]?.den || "",
      })),
    }));
  };

  const handleLoadSandbox = (sandbox) => {
    const rawData = sandbox.generateData();
    const isEcommerce = sandbox.name.includes("E-commerce");
    const mConfig = isEcommerce ? {
      primary: { num: "orders", den: "sessions" },
      drivers: {
        Add_to_Cart_Rate: { num: "add_to_cart_clicks", den: "sessions" },
        Cart_to_Purchase_Rate: { num: "orders", den: "add_to_cart_clicks" },
      },
    } : {
      primary: { num: "paid_subscriptions", den: "visitors" },
      drivers: {
        Trial_Start_Rate: { num: "trials", den: "visitors" },
        Trial_to_Paid_Rate: { num: "paid_subscriptions", den: "trials" },
      },
    };

    setData(rawData);
    setFileName(sandbox.name);
    setConfig({
      metric: sandbox.metric,
      date_column: sandbox.date_column,
      periods: sandbox.periods,
      segments: sandbox.segments,
    });
    setMetricConfig(mConfig);
    setIsWizard(false);
    setReadiness(analyzeDatasetReadiness(rawData));
    setFormErrors([]);
  };

  const handleCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (response) => {
        if (!response.data?.length) {
          setFormErrors(["The CSV parsed successfully, but no rows were found."]);
          return;
        }
        const rows = response.data;
        const columns = Object.keys(rows[0]);
        const readinessReport = analyzeDatasetReadiness(rows);
        const dateCol = columns.find((column) => {
          const lower = column.toLowerCase();
          return lower.includes("date") || lower.includes("time") || lower.includes("stamp");
        }) || readinessReport.dateColumns[0] || "";

        setData(rows);
        setAvailableColumns(columns);
        setResults(null);
        setConfig(null);
        setMetricConfig(null);
        setReadiness(readinessReport);
        setIsWizard(true);
        setFormErrors(readinessReport.blockers);
        setWizardConfig((prev) => ({
          ...prev,
          date_column: dateCol,
          segments: columns
            .filter((column) => column !== dateCol)
            .filter((column) => !rows.some((row) => Number.isFinite(parseFloat(row[column]))))
            .slice(0, 6),
        }));
        applyTemplate(selectedTemplateId, columns);
      },
      error: () => {
        setFormErrors(["The CSV could not be parsed. Check the file format and headers."]);
      },
    });
  };

  const handleDownloadTemplate = (event) => {
    event.stopPropagation();
    const rows = [
      "timestamp,device,browser,country,traffic_source,sessions,add_to_cart_clicks,orders,page_load_ms,error_count",
      "2026-06-15,Mobile,Safari,US,Google Ads,150,22,8,420,1",
      "2026-06-15,Desktop,Chrome,US,Organic Search,200,30,12,310,0",
      "2026-06-16,Mobile,Safari,US,Google Ads,160,24,9,430,2",
      "2026-06-16,Desktop,Chrome,US,Organic Search,210,32,13,290,0",
    ].join("\n");
    downloadText("data_analysis_template.csv", rows, "text/csv");
  };

  const handleRunCustomAnalysis = () => {
    const mConfig = {
      primary: { num: wizardConfig.primary_num, den: wizardConfig.primary_den },
      drivers: {},
    };
    wizardConfig.drivers.forEach((driver) => {
      if (driver.name && driver.num && driver.den) {
        mConfig.drivers[driver.name] = { num: driver.num, den: driver.den };
      }
    });

    const runConfig = {
      metric: wizardConfig.metric,
      date_column: wizardConfig.date_column,
      periods: wizardConfig.periods,
      segments: wizardConfig.segments,
    };
    const quality = buildDataQualityReport(data, runConfig, mConfig);
    const readinessReport = analyzeDatasetReadiness(data);

    if (readinessReport.status === "Not suitable") {
      setReadiness(readinessReport);
      setFormErrors([
        "This file is not suitable for the diagnosis yet.",
        ...readinessReport.blockers,
      ]);
      return;
    }
    if (!quality.ok) {
      setFormErrors(quality.issues);
      return;
    }

    setReadiness(readinessReport);
    setConfig(runConfig);
    setMetricConfig(mConfig);
    setIsWizard(false);
    setFormErrors(quality.warnings);
  };

  const handleReset = () => {
    setData([]);
    setFileName("");
    setConfig(null);
    setMetricConfig(null);
    setResults(null);
    setIsWizard(false);
    setFormErrors([]);
    setReadiness(null);
    setActiveStep(1);
  };

  const buildBrief = () => {
    if (!results || !currentSummary) return "";

    return [
      `# Metric Investigation Brief: ${config.metric}`,
      "",
      `Dataset: ${fileName}`,
      `Verdict: ${currentSummary.verdict}`,
      `Confidence: ${currentSummary.confidence}`,
      `WoW movement: ${currentSummary.drop}`,
      `Primary driver: ${currentSummary.driver}`,
      `Breakpoint: ${currentSummary.breakpoint}`,
      `Affected cohort: ${currentSummary.cohort}`,
      readiness ? `Dataset readiness: ${readiness.status} (${readiness.score}/${readiness.maxScore})` : "",
      "",
      readiness ? "## Dataset Readiness" : "",
      readiness ? readiness.summary : "",
      readiness?.blockers?.length ? "" : "",
      ...(readiness?.blockers?.length ? ["Blocking gaps:", ...readiness.blockers.map((item) => `- ${item}`)] : []),
      ...(readiness?.recommendedData?.length ? ["Recommended evidence:", ...readiness.recommendedData.map((item) => `- ${item}`)] : []),
      readiness ? "" : "",
      "## Executive Summary",
      results.hypothesis.executiveSummary,
      "",
      "## Evidence By Module",
      ...moduleDefinitions.flatMap((module) => {
        const result = results[module.key];
        return [
          "",
          `### ${module.step}. ${module.title}`,
          `Question: ${module.question}`,
          `Confidence: ${result?.confidence || "Not available"}`,
          result?.interpretation?.whatChanged ? `What changed: ${result.interpretation.whatChanged}` : "",
          result?.interpretation?.whyItMatters ? `Why it matters: ${result.interpretation.whyItMatters}` : "",
          result?.interpretation?.couldDisprove ? `Could disprove: ${result.interpretation.couldDisprove}` : "",
        ].filter(Boolean);
      }),
      "",
      "## Validation Checklist",
      ...results.hypothesis.validationChecklist.map((item) => `- ${item}`),
      "",
      "## Leading Hypotheses",
      ...results.hypothesis.hypotheses.flatMap((hypothesis, index) => [
        `${index + 1}. ${hypothesis.title} (${hypothesis.confidence} confidence, owner: ${hypothesis.owner})`,
        `   - Observation: ${hypothesis.observation}`,
        `   - Cause: ${hypothesis.cause}`,
        `   - Validation: ${hypothesis.validation}`,
      ]),
    ].join("\n");
  };

  const handleExportBrief = () => {
    downloadText(`${config.metric}_investigation_brief.md`, buildBrief(), "text/markdown");
  };

  useEffect(() => {
    if (!data.length || !config || !metricConfig) return;

    try {
      const validation = runDropValidation(data, config, metricConfig);
      const decomposition = runDriverDecomposition(data, config, metricConfig);
      const trend = runTrendAnalysis(data, config, metricConfig, decomposition.primaryDriver);
      const breakdown = runSegmentBreakdown(data, config, metricConfig, decomposition.primaryDriver);
      const comparison = runSegmentComparison(data, config, metricConfig, breakdown.worstDimension, breakdown.worstSegment);
      const hypothesis = runHypothesisGeneration(
        validation,
        decomposition,
        trend,
        breakdown,
        comparison,
        breakdown.worstDimension,
        breakdown.worstSegment,
        config
      );

      setResults({ validation, decomposition, trend, breakdown, comparison, hypothesis });
      setSelectedSegmentDim(config.segments[0] || "");
      setActiveStep(1);
    } catch (error) {
      setFormErrors([`Pipeline computation failed: ${error.message}`]);
    }
  }, [data, config, metricConfig]);

  if (isWizard) {
    return (
      <div className="app-shell">
        <AppHeader fileName={fileName} onReset={handleReset} />
        <main className="wizard-layout">
          <section className="panel wizard-intro">
            <div>
              <Badge tone="blue">Step 0 + metric model</Badge>
              <h2>Check whether this file can support the diagnosis</h2>
              <p>
                First confirm the dataset has the evidence needed for the analysis. Then map the business model, periods, drivers, and segments.
              </p>
            </div>
            <div className="template-grid">
              {metricTemplates.map((template) => (
                <button
                  key={template.id}
                  className={`template-card ${selectedTemplateId === template.id ? "selected" : ""}`}
                  onClick={() => applyTemplate(template.id)}
                  type="button"
                >
                  <span>{template.label}</span>
                  <small>{template.description}</small>
                </button>
              ))}
            </div>
          </section>

          {readiness && (
            <DataReadinessPanel readiness={readiness} />
          )}

          {formErrors.length > 0 && (
            <GuardrailPanel issues={formErrors} />
          )}

          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Required metric mapping</h2>
                <p>Use columns that represent counts or totals. Rates are calculated in the browser.</p>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Date column">
                <ColumnSelect
                  value={wizardConfig.date_column}
                  columns={availableColumns}
                  placeholder="Select date"
                  onChange={(value) => setWizardConfig({ ...wizardConfig, date_column: value })}
                />
              </Field>
              <Field label="Metric name">
                <input
                  value={wizardConfig.metric}
                  onChange={(event) => setWizardConfig({ ...wizardConfig, metric: event.target.value })}
                />
              </Field>
              <Field label="Primary numerator">
                <ColumnSelect
                  value={wizardConfig.primary_num}
                  columns={availableColumns}
                  placeholder="Example: orders"
                  onChange={(value) => setWizardConfig({ ...wizardConfig, primary_num: value })}
                />
              </Field>
              <Field label="Primary denominator">
                <ColumnSelect
                  value={wizardConfig.primary_den}
                  columns={availableColumns}
                  placeholder="Example: sessions"
                  onChange={(value) => setWizardConfig({ ...wizardConfig, primary_den: value })}
                />
              </Field>
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Driver metrics</h2>
                <p>These explain which part of the funnel changed. Add at least one driver for useful attribution.</p>
              </div>
            </div>
            <div className="driver-list">
              {wizardConfig.drivers.map((driver, index) => (
                <div className="driver-row" key={`${driver.name}-${index}`}>
                  <Field label={`Driver ${index + 1} name`}>
                    <input
                      value={driver.name}
                      onChange={(event) => updateDriver(index, "name", event.target.value, wizardConfig, setWizardConfig)}
                    />
                  </Field>
                  <Field label="Numerator">
                    <ColumnSelect
                      value={driver.num}
                      columns={availableColumns}
                      placeholder="Select column"
                      onChange={(value) => updateDriver(index, "num", value, wizardConfig, setWizardConfig)}
                    />
                  </Field>
                  <Field label="Denominator">
                    <ColumnSelect
                      value={driver.den}
                      columns={availableColumns}
                      placeholder="Select column"
                      onChange={(value) => updateDriver(index, "den", value, wizardConfig, setWizardConfig)}
                    />
                  </Field>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Comparison periods</h2>
                <p>Use ISO dates such as 2026-06-21. YoY is optional but improves confidence.</p>
              </div>
            </div>
            <div className="period-grid">
              <PeriodFields label="Analysed period" periodKey="analysed_period" wizardConfig={wizardConfig} setWizardConfig={setWizardConfig} />
              <PeriodFields label="Previous period" periodKey="previous_period" wizardConfig={wizardConfig} setWizardConfig={setWizardConfig} />
              <PeriodFields label="Same period last year" periodKey="same_period_last_year" wizardConfig={wizardConfig} setWizardConfig={setWizardConfig} />
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Segment fields</h2>
                <p>Pick categorical columns that might explain where the issue is concentrated.</p>
              </div>
              <Badge tone="neutral">Up to 6 recommended</Badge>
            </div>
            <div className="segment-picker">
              {availableColumns
                .filter((column) => ![
                  wizardConfig.date_column,
                  wizardConfig.primary_num,
                  wizardConfig.primary_den,
                  ...wizardConfig.drivers.flatMap((driver) => [driver.num, driver.den]),
                ].includes(column))
                .map((column) => (
                  <label className="check-pill" key={column}>
                    <input
                      type="checkbox"
                      checked={wizardConfig.segments.includes(column)}
                      onChange={(event) => {
                        const nextSegments = event.target.checked
                          ? [...wizardConfig.segments, column].slice(0, 6)
                          : wizardConfig.segments.filter((item) => item !== column);
                        setWizardConfig({ ...wizardConfig, segments: nextSegments });
                      }}
                    />
                    {column}
                  </label>
                ))}
            </div>
            <div className="action-row">
              <button
                className="btn btn-primary"
                disabled={readiness?.status === "Not suitable"}
                onClick={handleRunCustomAnalysis}
                type="button"
              >
                <Search size={16} />
                Run diagnosis
              </button>
              <button className="btn btn-secondary" onClick={handleReset} type="button">
                Cancel
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="app-shell">
        <AppHeader />
        <main className="workbench-home">
          <section className="panel hero-panel">
            <div className="hero-copy">
              <Badge tone="green">PM metric investigation</Badge>
              <h2>Turn a raw metric movement into a shareable diagnosis.</h2>
              <p>
                Upload a CSV or launch a sandbox. The app will guide the analysis through six fixed modules and produce an evidence-backed brief for leadership or engineering.
              </p>
              <div className="promise-grid">
                <Promise icon={ShieldCheck} title="Validate" copy="Real, seasonal, noisy, or outlier-led." />
                <Promise icon={BarChart2} title="Attribute" copy="Find the driver and cohort behind the movement." />
                <Promise icon={FileText} title="Brief" copy="Export a PM-ready investigation plan." />
              </div>
            </div>
            <div className="upload-panel">
              <button className="upload-zone" onClick={() => document.getElementById("csv-file")?.click()} type="button">
                <Upload size={30} />
                <span>Upload custom CSV</span>
                <small>Map your metric, periods, drivers, and segments.</small>
              </button>
              <input id="csv-file" type="file" accept=".csv" hidden onChange={handleCSVUpload} />
              <button className="btn btn-secondary wide" onClick={handleDownloadTemplate} type="button">
                <Download size={16} />
                Download template CSV
              </button>
            </div>
          </section>

          {formErrors.length > 0 && <GuardrailPanel issues={formErrors} />}

          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Sandbox investigations</h2>
                <p>Try the full workflow immediately with realistic metric-drop scenarios.</p>
              </div>
              <Badge tone="blue">Instant demo</Badge>
            </div>
            <div className="sandbox-grid">
              <SandboxCard
                title="E-commerce Conversion Drop"
                description="A checkout funnel issue affecting Mobile Safari users."
                metric="Conversion Rate"
                onClick={() => handleLoadSandbox(ecommerceData)}
              />
              <SandboxCard
                title="SaaS Activation Churn"
                description="A trial-to-paid billing issue affecting Android users."
                metric="Activation Rate"
                onClick={() => handleLoadSandbox(saasSubscriptionData)}
              />
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!results || !currentSummary) {
    return (
      <div className="app-shell">
        <AppHeader fileName={fileName} onReset={handleReset} />
        <main className="loading-panel panel">
          <Cpu size={30} />
          <h2>Running the six-module diagnosis...</h2>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppHeader fileName={fileName} onReset={handleReset} onExport={handleExportBrief} />
      <main className="dashboard-grid">
        <aside className="command-column">
          <section className="panel command-center">
            <Badge tone={currentSummary.confidence === "High" ? "green" : currentSummary.confidence === "Medium" ? "yellow" : "neutral"}>
              {currentSummary.confidence} confidence
            </Badge>
            <h2>{currentSummary.verdict}</h2>
            <p>{results.hypothesis.executiveSummary}</p>
            <div className="summary-stats">
              <SummaryStat label="WoW movement" value={currentSummary.drop} tone={results.validation.wowChange < 0 ? "bad" : "good"} />
              <SummaryStat label="Primary driver" value={currentSummary.driver} />
              <SummaryStat label="Breakpoint" value={currentSummary.breakpoint} />
              <SummaryStat label="Affected cohort" value={currentSummary.cohort} />
            </div>
            <div className="next-check">
              <span>Next check</span>
              <p>{currentSummary.nextCheck}</p>
            </div>
          </section>

          <nav className="module-nav" aria-label="Analysis modules">
            {moduleDefinitions.map((module) => {
              const Icon = module.icon;
              const moduleResult = results[module.key];
              return (
                <button
                  key={module.key}
                  className={`module-tab ${activeStep === module.step ? "active" : ""}`}
                  onClick={() => setActiveStep(module.step)}
                  type="button"
                >
                  <span className="module-index">{module.step}</span>
                  <span className="module-main">
                    <strong>
                      <Icon size={16} />
                      {module.shortTitle}
                    </strong>
                    <small>{moduleResult?.confidence || "Ready"}</small>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="module-column">
          {qualityReport && qualityReport.warnings.length > 0 && (
            <GuardrailPanel issues={qualityReport.warnings} tone="warning" />
          )}

          <section className="panel module-panel">
            <div className="module-header">
              <div>
                <Badge tone="blue">Module {activeModule.step}</Badge>
                <h2>{activeModule.title}</h2>
                <p>{activeModule.question}</p>
              </div>
              <Badge tone={results[activeModule.key]?.confidence === "High" ? "green" : results[activeModule.key]?.confidence === "Medium" ? "yellow" : "neutral"}>
                {results[activeModule.key]?.confidence || "Ready"}
              </Badge>
            </div>

            {activeStep === 1 && <ValidationModule result={results.validation} />}
            {activeStep === 2 && <DecompositionModule result={results.decomposition} metricName={config.metric} />}
            {activeStep === 3 && <TrendModule result={results.trend} metricName={config.metric} driverName={results.decomposition.primaryDriver} />}
            {activeStep === 4 && (
              <SegmentModule
                result={results.breakdown}
                selectedSegmentDim={selectedSegmentDim}
                setSelectedSegmentDim={setSelectedSegmentDim}
                segmentOptions={config.segments}
              />
            )}
            {activeStep === 5 && <ComparisonModule result={results.comparison} cohort={currentSummary.cohort} />}
            {activeStep === 6 && <HypothesisModule result={results.hypothesis} onExport={handleExportBrief} />}
          </section>
        </section>
      </main>
    </div>
  );
}

function AppHeader({ fileName, onReset, onExport }) {
  return (
    <header className="app-header">
      <div className="brand-lockup">
        <div className="brand-mark">
          <Cpu size={22} />
        </div>
        <div>
          <h1>Data Analysis Engine</h1>
          <span>{fileName ? `Dataset: ${fileName}` : "Six-module diagnostic workbench"}</span>
        </div>
      </div>
      <div className="header-actions">
        {onExport && (
          <button className="btn btn-primary" onClick={onExport} type="button">
            <Download size={16} />
            Export brief
          </button>
        )}
        {onReset && (
          <button className="btn btn-secondary" onClick={onReset} type="button">
            <RefreshCw size={16} />
            Reset
          </button>
        )}
      </div>
    </header>
  );
}

function Promise({ icon: Icon, title, copy }) {
  return (
    <div className="promise-item">
      <Icon size={18} />
      <strong>{title}</strong>
      <span>{copy}</span>
    </div>
  );
}

function SandboxCard({ title, description, metric, onClick }) {
  return (
    <button className="sandbox-card" onClick={onClick} type="button">
      <div>
        <Badge tone="neutral">{metric}</Badge>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <ArrowRight size={20} />
    </button>
  );
}

function DataReadinessPanel({ readiness }) {
  const profileRows = [
    ["Rows", readiness.rowCount.toLocaleString()],
    ["Columns", readiness.columnCount],
    ["Detected grain", readiness.grain],
    ["Date range", readiness.dateRange ? `${readiness.dateRange.start} to ${readiness.dateRange.end}` : "Not detected"],
    ["Numeric columns", readiness.numericColumns.length],
    ["Categorical columns", readiness.categoricalColumns.length],
    ["Diagnostic signals", readiness.diagnosticColumns.length || "None detected"],
  ];

  return (
    <section className="panel readiness-panel">
      <div className="readiness-hero">
        <div>
          <Badge tone={readinessTone(readiness.status)}>Step 0: {readiness.status}</Badge>
          <h2>Is this the right data?</h2>
          <p>{readiness.summary}</p>
        </div>
        <div className="readiness-score">
          <span>Readiness score</span>
          <strong>{readiness.score}/{readiness.maxScore}</strong>
        </div>
      </div>

      <div className="readiness-grid">
        <EvidenceCard title="Dataset profile" icon={ClipboardList}>
          <DataTable compact columns={["Check", "Detected"]} rows={profileRows} />
        </EvidenceCard>

        <EvidenceCard title="What this file can support" icon={ShieldCheck}>
          <div className="module-readiness-list">
            {readiness.modules.map((module) => (
              <div className="module-readiness-row" key={module.key}>
                <div>
                  <strong>{module.label}</strong>
                  <p>{module.reason}</p>
                </div>
                <Badge tone={module.strength === "Strong" ? "green" : module.strength === "Partial" ? "yellow" : "danger"}>
                  {module.strength}
                </Badge>
              </div>
            ))}
          </div>
        </EvidenceCard>
      </div>

      <div className="readiness-grid">
        <EvidenceCard title="Missing evidence to improve confidence" icon={AlertTriangle}>
          {readiness.recommendedData.length ? (
            <ul className="plain-list">
              {readiness.recommendedData.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : (
            <p className="empty-state">No major evidence gaps detected. Continue to mapping.</p>
          )}
        </EvidenceCard>

        <EvidenceCard title="Column signals" icon={Target}>
          <div className="signal-blocks">
            <SignalBlock label="Date" values={readiness.dateColumns} />
            <SignalBlock label="Numeric" values={readiness.numericColumns.slice(0, 8)} />
            <SignalBlock label="Segments" values={readiness.categoricalColumns.slice(0, 8)} />
            <SignalBlock label="Diagnostic" values={readiness.diagnosticColumns.slice(0, 8)} />
          </div>
        </EvidenceCard>
      </div>
    </section>
  );
}

function SignalBlock({ label, values }) {
  return (
    <div className="signal-block">
      <span>{label}</span>
      <p>{values.length ? values.join(", ") : "None detected"}</p>
    </div>
  );
}

function GuardrailPanel({ issues, tone = "danger" }) {
  return (
    <section className={`guardrail guardrail-${tone}`}>
      <AlertTriangle size={18} />
      <div>
        <strong>{tone === "warning" ? "Data warnings" : "Guardrails"}</strong>
        <ul>
          {issues.map((issue) => <li key={issue}>{issue}</li>)}
        </ul>
      </div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ColumnSelect({ value, columns, onChange, placeholder }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {columns.map((column) => (
        <option key={column} value={column}>{column}</option>
      ))}
    </select>
  );
}

function PeriodFields({ label, periodKey, wizardConfig, setWizardConfig }) {
  const period = wizardConfig.periods[periodKey];
  const updatePeriod = (field, value) => {
    setWizardConfig({
      ...wizardConfig,
      periods: {
        ...wizardConfig.periods,
        [periodKey]: { ...period, [field]: value },
      },
    });
  };

  return (
    <div className="period-card">
      <strong>{label}</strong>
      <div className="period-inputs">
        <input placeholder="YYYY-MM-DD" value={period.start} onChange={(event) => updatePeriod("start", event.target.value)} />
        <input placeholder="YYYY-MM-DD" value={period.end} onChange={(event) => updatePeriod("end", event.target.value)} />
      </div>
    </div>
  );
}

function updateDriver(index, field, value, wizardConfig, setWizardConfig) {
  const drivers = [...wizardConfig.drivers];
  drivers[index] = { ...drivers[index], [field]: value };
  setWizardConfig({ ...wizardConfig, drivers });
}

function SummaryStat({ label, value, tone }) {
  return (
    <div className="summary-stat">
      <span>{label}</span>
      <strong className={tone ? `tone-${tone}` : ""}>{value}</strong>
    </div>
  );
}

function ValidationModule({ result }) {
  return (
    <div className="module-body">
      <div className="metric-grid">
        <MetricBox label="Analysed period" value={formatRate(result.analysedValue)} sub="Current metric rate" />
        <MetricBox label="Previous period" value={formatRate(result.previousValue)} sub={`${formatSigned(result.wowChange)} WoW`} tone={result.wowChange < 0 ? "bad" : "good"} />
        <MetricBox label="Same period YoY" value={formatRate(result.yoyValue)} sub={`${formatSigned(result.yoyChange)} YoY`} tone={result.yoyChange < 0 ? "bad" : "good"} />
      </div>
      <InsightBlock insight={result.interpretation} />
      <EvidenceCard title="Outlier evidence" icon={Gauge}>
        {result.outliers.length ? (
          <DataTable
            columns={["Outlier date", "Metric value", "Z-score"]}
            rows={result.outliers.map((row) => [row.date, formatRate(row.value), row.zScore.toFixed(2)])}
          />
        ) : (
          <p className="empty-state">No single-day extreme outliers were detected in the analysed period.</p>
        )}
      </EvidenceCard>
    </div>
  );
}

function DecompositionModule({ result, metricName }) {
  return (
    <div className="module-body">
      <InsightBlock insight={result.interpretation} />
      <EvidenceCard title="Driver attribution" icon={BarChart2}>
        <DataTable
          columns={["Driver", "Previous", "Analysed", "WoW change", "Contribution"]}
          rows={[
            [titleize(metricName), formatRate(result.primaryMetricValuePrev), formatRate(result.primaryMetricValueCurr), formatSigned(result.wowChange), "100.0%"],
            ...result.contributions.map((row) => [
              titleize(row.driver),
              formatRate(row.previous),
              formatRate(row.current),
              formatSigned(row.pctChange),
              `${row.contribution.toFixed(1)}%`,
            ]),
          ]}
        />
      </EvidenceCard>
      <ChartFrame>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={result.contributions} layout="vertical" margin={{ left: 32, right: 24, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis type="number" stroke="#94a3b8" />
            <YAxis dataKey="driver" type="category" stroke="#94a3b8" width={136} tickFormatter={titleize} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="contribution" fill="#5eead4" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

function TrendModule({ result, metricName, driverName }) {
  return (
    <div className="module-body">
      <div className="metric-grid two">
        <MetricBox label="Detected breakpoint" value={result.breakpoint} sub="First notable deviation" />
        <MetricBox label="Pattern" value={result.pattern} sub="Trend drop profile" />
      </div>
      <InsightBlock insight={result.interpretation} />
      <ChartFrame tall>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={result.dailyList} margin={{ top: 10, right: 18, left: 4, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="date" stroke="#94a3b8" minTickGap={32} />
            <YAxis yAxisId="left" stroke="#94a3b8" tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
            <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => value === null ? "n/a" : formatRate(value)} />
            <Legend />
            <ReferenceLine yAxisId="left" y={result.threshold} stroke="#fb7185" strokeDasharray="4 4" label="Threshold" />
            <ReferenceLine yAxisId="left" x={result.breakpoint} stroke="#fbbf24" label="Breakpoint" />
            <Line yAxisId="left" type="monotone" dataKey="primary" stroke="#38bdf8" strokeWidth={2.4} name={metricName} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="driver" stroke="#fbbf24" strokeWidth={1.8} name={titleize(driverName)} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

function SegmentModule({ result, selectedSegmentDim, setSelectedSegmentDim, segmentOptions }) {
  const rows = selectedSegmentDim ? result.breakdowns[selectedSegmentDim] || [] : [];

  return (
    <div className="module-body">
      <InsightBlock insight={result.interpretation} />
      <div className="toolbar-row">
        <span>Breakdown dimension</span>
        <select value={selectedSegmentDim} onChange={(event) => setSelectedSegmentDim(event.target.value)}>
          {segmentOptions.map((segment) => <option key={segment} value={segment}>{segment}</option>)}
        </select>
      </div>
      <EvidenceCard title="Rate vs mix contribution" icon={Layers}>
        {rows.length ? (
          <DataTable
            columns={["Segment", "Prev share", "Curr share", "Prev rate", "Curr rate", "Rate effect", "Mix effect", "Total"]}
            rows={rows.map((row) => [
              row.segment,
              `${row.sharePrev.toFixed(1)}%`,
              `${row.shareCurr.toFixed(1)}%`,
              formatRate(row.metricPrev),
              formatRate(row.metricCurr),
              formatRate(row.rateEffect),
              formatRate(row.mixEffect),
              formatRate(row.totalContribution),
            ])}
          />
        ) : (
          <p className="empty-state">No segment rows are available for this dimension.</p>
        )}
      </EvidenceCard>
      {rows.length > 0 && (
        <ChartFrame>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="segment" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatRate(value)} />
              <Legend />
              <Bar dataKey="rateEffect" fill="#5eead4" name="Rate effect" />
              <Bar dataKey="mixEffect" fill="#60a5fa" name="Mix effect" />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      )}
    </div>
  );
}

function ComparisonModule({ result, cohort }) {
  return (
    <div className="module-body">
      <div className="metric-grid two">
        <MetricBox label="Failing cohort" value={result.testSize} sub={cohort} />
        <MetricBox label="Stable control" value={result.controlSize} sub="Rows outside cohort" />
      </div>
      <InsightBlock insight={result.interpretation} />
      <EvidenceCard title="Continuous metric contrast" icon={GitCompare}>
        {result.continuousCompare?.length ? (
          <DataTable
            columns={["Metric", "Failing mean", "Control mean", "Difference"]}
            rows={result.continuousCompare.slice(0, 6).map((row) => [
              titleize(row.metric),
              row.testMean.toFixed(1),
              row.controlMean.toFixed(1),
              formatSigned(row.diffPct),
            ])}
          />
        ) : (
          <p className="empty-state">{result.message || "No continuous comparison metrics were available."}</p>
        )}
      </EvidenceCard>
      <EvidenceCard title="Categorical mix contrast" icon={Target}>
        {result.contrasts?.length ? (
          <div className="contrast-list">
            {result.contrasts.slice(0, 3).map((contrast) => (
              <div className="contrast-card" key={contrast.dimension}>
                <strong>{contrast.dimension}</strong>
                <DataTable
                  compact
                  columns={["Value", "Failing", "Control", "Diff"]}
                  rows={contrast.distribution.slice(0, 3).map((row) => [
                    row.key,
                    `${row.testShare.toFixed(1)}%`,
                    `${row.controlShare.toFixed(1)}%`,
                    formatSigned(row.diff),
                  ])}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">No categorical contrasts are available.</p>
        )}
      </EvidenceCard>
    </div>
  );
}

function HypothesisModule({ result, onExport }) {
  return (
    <div className="module-body">
      <InsightBlock insight={result.interpretation} />
      <EvidenceCard title="Ranked hypotheses" icon={Sparkles}>
        <div className="hypothesis-list">
          {result.hypotheses.map((hypothesis, index) => (
            <article className="hypothesis-card" key={`${hypothesis.title}-${index}`}>
              <div className="hypothesis-title">
                <span>H{index + 1}</span>
                <div>
                  <h3>{hypothesis.title}</h3>
                  <small>{hypothesis.confidence} confidence - Owner: {hypothesis.owner}</small>
                </div>
              </div>
              <p><strong>Observation:</strong> {hypothesis.observation}</p>
              <p><strong>Likely cause:</strong> {hypothesis.cause}</p>
              <p><strong>Validation:</strong> {hypothesis.validation}</p>
            </article>
          ))}
        </div>
      </EvidenceCard>
      <EvidenceCard title="Validation checklist" icon={CheckCircle}>
        <ol className="checklist">
          {result.validationChecklist.map((item) => <li key={item}>{item}</li>)}
        </ol>
        <button className="btn btn-primary" onClick={onExport} type="button">
          <Download size={16} />
          Export investigation brief
        </button>
      </EvidenceCard>
    </div>
  );
}

function MetricBox({ label, value, sub, tone }) {
  return (
    <div className="metric-box">
      <span>{label}</span>
      <strong className={tone ? `tone-${tone}` : ""}>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function DataTable({ columns, rows, compact = false }) {
  return (
    <div className="table-wrap">
      <table className={compact ? "compact-table" : ""}>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row.join("-")}-${rowIndex}`}>
              {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartFrame({ children, tall = false }) {
  return <div className={`chart-frame ${tall ? "tall" : ""}`}>{children}</div>;
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type: `${type};charset=utf-8;` });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const tooltipStyle = {
  background: "#111827",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  color: "#f8fafc",
};

export default App;
