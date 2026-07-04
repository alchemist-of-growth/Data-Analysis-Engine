# Data Analysis Engine - User & Deployment Guide

A premium, client-side diagnostic workbench for Product Managers and Growth Analysts to turn raw metric drops into structured, PM-ready investigation briefs.

This application runs **entirely in the browser** (no backend server required) and can be hosted completely free on **GitHub Pages**.

---

## 🚀 Independent GitHub Pages Deployment

The repository is equipped with a GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) to automatically build and host the application.

### Step 1: Push Code to GitHub
1. Open **GitHub Desktop** (or your terminal).
2. Choose **File -> Add Local Repository** and select this directory:
   ```text
   /Users/nishantagarwal/Documents/Data Analysis Engine
   ```
3. Commit all changes with a message:
   ```text
   feat: productize data analysis engine with custom formulas and history
   ```
4. Click **Publish repository** (or **Push origin**). Make sure to uncheck **Keep this code private** so GitHub Pages can host it.

### Step 2: Enable GitHub Pages Action
1. Go to your repository on **GitHub.com**.
2. Click on the **Settings** tab.
3. In the left sidebar, click **Pages** (under the "Code and automation" section).
4. Under **Build and deployment**, look for **Source** and change it to **GitHub Actions** in the dropdown.
5. The deployment action will trigger automatically on your next push. You can view progress in the **Actions** tab.

Once deployed, the app will be live at:
`https://<YOUR_GITHUB_USERNAME>.github.io/<YOUR_REPOSITORY_NAME>/`

---

## 💻 Local Preview

To run the application locally on your computer:

```bash
# Install dependencies
npm install

# Run Vite local development server
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your browser.

---

## 🛠️ Step-by-Step Diagnostic Workflow

### 1. Upload Dataset
- The engine accepts any standard CSV or TSV containing time-series granular metrics.
- Click **Upload custom CSV** on the landing page, or download the template CSV to see a sample schema format.
- *Privacy Note:* Since the application runs 100% client-side, your data never leaves your computer or uploads to any external servers.

### 2. Configure Metric & Custom Formulas
The wizard lets you define how your metrics relate to one another using a smart formula builder:
- **Date Column:** Select the CSV column containing date values.
- **Metric Name:** Name your primary metric (e.g., `Conversion_Rate`).
- **Primary Metric Formula:** Input a formula representing your target metric as a ratio of two columns (e.g., `orders / sessions`). Autocomplete suggestions will appear as you type.
- **Driver Metrics:** Map the steps of your funnel or product levers as driver ratios. Click **+ Add Driver** to insert additional levels (e.g., `Add_to_Cart_Rate = add_to_cart_clicks / sessions`).

### 3. Choose Segments
- Pick up to 6 categorical dimension columns (e.g., `device`, `browser`, `country`) to localize metric shifts.

### 4. Run Analysis
Click **Run Diagnosis** to process the data. The engine executes a 6-module analysis:
1. **Validate the Drop:** Checks week-over-week (WoW) and year-over-year (YoY) baselines to confirm if the drop is real or seasonal noise.
2. **Decompose Drivers:** Attributes the drop across your mapped formulas using log-ratio contributions.
3. **Find the Breakpoint:** Identifies the precise start date of the regression.
4. **Segment the Impact:** Breaks down the metrics across your dimensions to spot rate vs. mix shifts.
5. **Compare Cohorts:** Contrasts stable control groups against the failing cohort.
6. **Generate Hypotheses:** Compiles findings into testable root-cause recommendations.

### 5. Review & Export
- Head to the **Brief Preview** tab to review a rendered, PM-ready markdown summary.
- Click **Copy to Clipboard** to copy the document, or **Export as Markdown** to download the `.md` brief to share with leadership.
- The configuration is saved to the **Recent Investigations** list on the home page so you can reload it instantly later.
