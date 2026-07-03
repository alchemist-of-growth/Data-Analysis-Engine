// Sandbox Data for the Data Analysis Engine
// Pre-loaded datasets that simulate metric drops matching the flowchart scenarios.

export const ecommerceData = {
  name: "E-commerce Conversion Drop (Safari Mobile Bug)",
  metric: "Conversion_Rate",
  date_column: "timestamp",
  date_format: "YYYY-MM-DD",
  formulas: [
    "Conversion_Rate = Add_to_Cart_Rate * Cart_to_Purchase_Rate",
    "Add_to_Cart_Rate = Add_to_Cart_Clicks / Sessions",
    "Cart_to_Purchase_Rate = Orders / Add_to_Cart_Clicks"
  ],
  periods: {
    analysed_period: { start: "2026-06-21", end: "2026-06-27" },
    previous_period: { start: "2026-06-14", end: "2026-06-20" },
    same_period_last_year: { start: "2025-06-22", end: "2025-06-28" }
  },
  segments: ["device", "browser", "country", "traffic_source"],
  
  // Method to generate simulated rows of transactions or daily aggregates
  generateData() {
    const data = [];
    const startDate = new Date("2026-05-15");
    const endDate = new Date("2026-06-30");
    
    const devices = ["Mobile", "Desktop", "Tablet"];
    const browsers = ["Safari", "Chrome", "Firefox"];
    const countries = ["US", "UK", "DE", "JP"];
    const sources = ["Google Ads", "Facebook Ads", "Organic Search", "Direct"];
    
    // Generate daily rows
    let curr = new Date(startDate);
    while (curr <= endDate) {
      const dateStr = curr.toISOString().split("T")[0];
      const isAnalysedWeek = dateStr >= "2026-06-21" && dateStr <= "2026-06-27";
      
      // Let's generate records per segment combination
      devices.forEach(device => {
        browsers.forEach(browser => {
          countries.forEach(country => {
            sources.forEach(source => {
              // Base sessions
              let sessions = Math.floor(Math.random() * 50) + 20;
              
              // Base rates
              let add_to_cart_rate = 0.15; // 15%
              let cart_to_purchase_rate = 0.40; // 40%
              
              // Latency and errors
              let page_load_ms = Math.floor(Math.random() * 400) + 300; // 300-700ms
              let error_count = Math.random() < 0.05 ? 1 : 0;
              
              // Apply the drop condition: Mobile Safari drops conversion starting on June 21, 2026
              // The bug is: Add to Cart button is invisible in dark mode (Safari Mobile)
              // This makes the Add_to_Cart_Rate drop from 15% to 3%
              if (isAnalysedWeek && device === "Mobile" && browser === "Safari") {
                add_to_cart_rate = 0.03; // Heavy drop
                page_load_ms += 100; // Slight latency increase
                error_count += Math.random() < 0.15 ? 1 : 0; // More errors
              }
              
              const cart_adds = Math.round(sessions * add_to_cart_rate);
              const orders = Math.round(cart_adds * cart_to_purchase_rate);
              
              data.push({
                timestamp: dateStr,
                device,
                browser,
                country,
                traffic_source: source,
                sessions,
                add_to_cart_clicks: cart_adds,
                orders,
                page_load_ms,
                error_count
              });
            });
          });
        });
      });
      curr.setDate(curr.getDate() + 1);
    }
    
    // Also generate same period last year rows (2025 dates mapped)
    let currYoY = new Date("2025-06-15");
    const endYoY = new Date("2025-06-30");
    while (currYoY <= endYoY) {
      const dateStr = currYoY.toISOString().split("T")[0];
      devices.forEach(device => {
        browsers.forEach(browser => {
          countries.forEach(country => {
            sources.forEach(source => {
              let sessions = Math.floor(Math.random() * 50) + 20;
              let add_to_cart_rate = 0.15;
              let cart_to_purchase_rate = 0.40;
              const cart_adds = Math.round(sessions * add_to_cart_rate);
              const orders = Math.round(cart_adds * cart_to_purchase_rate);
              
              data.push({
                timestamp: dateStr,
                device,
                browser,
                country,
                traffic_source: source,
                sessions,
                add_to_cart_clicks: cart_adds,
                orders,
                page_load_ms: Math.floor(Math.random() * 400) + 300,
                error_count: Math.random() < 0.05 ? 1 : 0
              });
            });
          });
        });
      });
      currYoY.setDate(currYoY.getDate() + 1);
    }
    
    return data;
  }
};

export const saasSubscriptionData = {
  name: "SaaS Activation Churn (Android v3.1 Billing Issue)",
  metric: "Activation_Rate",
  date_column: "timestamp",
  date_format: "YYYY-MM-DD",
  formulas: [
    "Activation_Rate = Trial_Start_Rate * Trial_to_Paid_Rate",
    "Trial_Start_Rate = Trials / Visitors",
    "Trial_to_Paid_Rate = Paid_Subscriptions / Trials"
  ],
  periods: {
    analysed_period: { start: "2026-06-21", end: "2026-06-27" },
    previous_period: { start: "2026-06-14", end: "2026-06-20" },
    same_period_last_year: { start: "2025-06-22", end: "2025-06-28" }
  },
  segments: ["device", "referrer", "country"],
  
  generateData() {
    const data = [];
    const startDate = new Date("2026-05-15");
    const endDate = new Date("2026-06-30");
    
    const devices = ["Android", "iOS", "Web"];
    const referrers = ["Direct", "AdWords", "Blog", "Partner"];
    const countries = ["US", "CA", "EU", "Asia"];
    
    let curr = new Date(startDate);
    while (curr <= endDate) {
      const dateStr = curr.toISOString().split("T")[0];
      const isAnalysedWeek = dateStr >= "2026-06-21" && dateStr <= "2026-06-27";
      
      devices.forEach(device => {
        referrers.forEach(ref => {
          countries.forEach(country => {
            let visitors = Math.floor(Math.random() * 100) + 50;
            let trial_start_rate = 0.10; // 10%
            let trial_to_paid_rate = 0.20; // 20%
            let error_count = 0;
            
            // Apply drop: Android users experience a trial_to_paid billing failure starting June 21
            // trial_to_paid drops from 20% to 2%
            if (isAnalysedWeek && device === "Android") {
              trial_to_paid_rate = 0.02;
              error_count = Math.floor(Math.random() * 5) + 3; // Elevated error counts
            }
            
            const trials = Math.round(visitors * trial_start_rate);
            const paid = Math.round(trials * trial_to_paid_rate);
            
            data.push({
              timestamp: dateStr,
              device,
              referrer: ref,
              country,
              visitors,
              trials,
              paid_subscriptions: paid,
              error_count
            });
          });
        });
      });
      curr.setDate(curr.getDate() + 1);
    }
    
    // YoY same period
    let currYoY = new Date("2025-06-15");
    const endYoY = new Date("2025-06-30");
    while (currYoY <= endYoY) {
      const dateStr = currYoY.toISOString().split("T")[0];
      devices.forEach(device => {
        referrers.forEach(ref => {
          countries.forEach(country => {
            let visitors = Math.floor(Math.random() * 100) + 50;
            let trial_start_rate = 0.10;
            let trial_to_paid_rate = 0.20;
            const trials = Math.round(visitors * trial_start_rate);
            const paid = Math.round(trials * trial_to_paid_rate);
            data.push({
              timestamp: dateStr,
              device,
              referrer: ref,
              country,
              visitors,
              trials,
              paid_subscriptions: paid,
              error_count: 0
            });
          });
        });
      });
      currYoY.setDate(currYoY.getDate() + 1);
    }
    
    return data;
  }
};
