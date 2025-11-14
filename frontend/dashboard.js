// ===============================
//  CORRECT API BASE
// ===============================
const API_BASE =
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost"
    ? "http://127.0.0.1:8000"
    : "";

// ===============================
//  SELECT CHART CANVAS
// ===============================
const ctxRisk = document.getElementById("riskChart").getContext("2d");
const ctxMissing = document.getElementById("missingChart").getContext("2d");

let riskChart, missingChart;

// ===============================
//  LOAD HISTORY FROM BACKEND
// ===============================
async function loadHistoryData() {
  try {
    const res = await fetch(`${API_BASE}/history`);
    if (!res.ok) throw new Error("History fetch failed");

    const data = await res.json();
    let records = [];

    // Accept all formats
    if (Array.isArray(data)) records = data;
    else if (Array.isArray(data.records)) records = data.records;
    else if (Array.isArray(data.history)) records = data.history;

    // Normalize
    records = records.map((r) => ({
      filename: r.filename || r.file || "unknown",
      risk_score: Number(r.risk_score ?? r.risk ?? 0),
      missing_count: Number(
        r.missing_count ??
          r.missing ??
          (r.missing_clauses ? r.missing_clauses.length : 0)
      ),
      timestamp: r.timestamp || r.time || r.date || null,
    }));

    // Sort newest first
    records.sort((a, b) => {
      if (a.timestamp && b.timestamp)
        return new Date(b.timestamp) - new Date(a.timestamp);
      return 0;
    });

    return records;
  } catch (err) {
    console.error("loadHistoryData", err);
    return [];
  }
}

// ===============================
//  METRICS
// ===============================
function computeMetrics(records) {
  const total = records.length;
  const avg =
    total === 0
      ? 0
      : Math.round(
          records.reduce((s, r) => s + (r.risk_score || 0), 0) / total
        );

  const maxRec = records.reduce(
    (best, r) => (r.risk_score > (best.risk_score || 0) ? r : best),
    {}
  );

  return { total, avg, maxRec };
}

// ===============================
//  SUMMARY TOP CARDS
// ===============================
function renderSummaryTop(metrics) {
  const container = document.getElementById("summaryTop");

  container.innerHTML = `
    <div class="glass-panel p-3 fade-in" style="min-width:120px;text-align:center">
      <div class="text-xs muted-small">Docs</div>
      <div class="font-bold text-[18px] text-accent">${metrics.total}</div>
    </div>

    <div class="glass-panel p-3 fade-in" style="min-width:160px;text-align:center">
      <div class="text-xs muted-small">Avg Risk</div>
      <div class="font-bold text-[18px] text-accent">${metrics.avg}</div>
    </div>
  `;

  gsap.from(container.children, {
    y: 12,
    opacity: 0,
    stagger: 0.08,
    duration: 0.6,
  });
}

// ===============================
//  QUICK STATS (LEFT PANEL)
// ===============================
function renderQuickStats(records) {
  const wrap = document.getElementById("quickStats");
  if (!wrap) return;

  const last = records.slice(0, 5);

  if (last.length === 0) {
    wrap.innerHTML = `<div class="muted-small">No data yet.</div>`;
    return;
  }

  wrap.innerHTML = last
    .map(
      (r) => `
    <div class="p-3 rounded-lg"
      style="background:linear-gradient(90deg, rgba(123,92,255,0.06), rgba(51,214,255,0.03)); border:1px solid rgba(255,255,255,0.03)">
      <div class="font-semibold">${r.filename}</div>
      <div class="muted-small">Risk: <strong class="text-accent">${r.risk_score}</strong> • Missing: ${r.missing_count}</div>
    </div>`
    )
    .join("");
}

// ===============================
//  HISTORY LIST (LEFT PANEL)
// ===============================
function renderHistoryList(records) {
  const el = document.getElementById("historyList");
  if (!el) return;

  if (records.length === 0) {
    el.innerHTML = `<div class="muted-small">No files analyzed yet.</div>`;
    return;
  }

  el.innerHTML = records
    .slice(0, 6)
    .map(
      (r) => `
    <div class="p-3 rounded-lg" 
         style="background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); border:1px solid rgba(255,255,255,0.03)">
      <div class="flex justify-between items-center">
        <div>
          <div class="font-semibold">${r.filename}</div>
          <div class="muted-small">${r.timestamp ? new Date(r.timestamp).toLocaleString() : ""}</div>
        </div>
        <div class="text-right">
          <div class="font-bold text-accent">${r.risk_score}</div>
          <div class="muted-small">Missing ${r.missing_count}</div>
        </div>
      </div>
    </div>`
    )
    .join("");
}

// ===============================
//  TABLE VIEW (RIGHT PANEL)
// ===============================
function renderHistoryTable(records) {
  const tbody = document.getElementById("historyTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";
  records.slice(0, 20).forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="p-2">${r.filename}</td>
      <td class="p-2 text-right">${r.risk_score}</td>
      <td class="p-2 text-right">${r.missing_count}</td>
      <td class="p-2 text-right">${r.timestamp ? new Date(r.timestamp).toLocaleString() : "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ===============================
//  CHARTS
// ===============================
function prepareCharts(records) {
  const labels = records
    .slice(0, 30)
    .map((r) =>
      r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : "NA"
    )
    .reverse();

  const riskData = records.slice(0, 30).map((r) => r.risk_score).reverse();
  const missingData = records
    .slice(0, 30)
    .map((r) => r.missing_count)
    .reverse();

  if (riskChart) riskChart.destroy();
  if (missingChart) missingChart.destroy();

  // ------- RISK LINE CHART -------
  riskChart = new Chart(ctxRisk, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Risk Score",
          data: riskData,
          tension: 0.35,
          fill: true,
          backgroundColor: "rgba(51,214,255,0.12)",
          borderColor: "rgba(51,214,255,0.95)",
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { suggestedMin: 0, suggestedMax: 100 },
        x: { ticks: { maxRotation: 0 } },
      },
    },
  });

  // ------- MISSING BAR CHART -------
  missingChart = new Chart(ctxMissing, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Missing Clauses",
          data: missingData,
          backgroundColor: "rgba(123,92,255,0.9)",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true },
        x: { display: false },
      },
    },
  });
}

// ===============================
//  REFRESH ALL
// ===============================
async function refreshAll() {
  const records = await loadHistoryData();
  const metrics = computeMetrics(records);

  document.getElementById("totalDocs").innerText = metrics.total;
  document.getElementById("avgRisk").innerText = metrics.avg;
  document.getElementById("maxRiskFile").innerText = metrics.maxRec.filename
    ? `${metrics.maxRec.filename} (${metrics.maxRec.risk_score})`
    : "—";

  renderSummaryTop(metrics);
  renderQuickStats(records);
  renderHistoryList(records);
  renderHistoryTable(records);
  prepareCharts(records);
}

// ===============================
//  ANALYSIS PANEL FUNCTION
// ===============================
function renderAnalysisPanel(analysis) {
  const panel = document.getElementById("analysisPanel");
  const riskBox = document.getElementById("riskBox");
  const missingList = document.getElementById("missingList");
  const presentList = document.getElementById("presentList");
  const detailsBox = document.getElementById("detailsBox");

  panel.classList.remove("hidden");

  // Risk summary
  riskBox.innerHTML = `
    Risk Score: <span class="text-accent">${analysis.risk_score}</span><br>
    Level: <strong>${analysis.risk_level}</strong>
  `;

  // Missing clauses
  missingList.innerHTML = "";
  analysis.missing_clauses.forEach((c) => {
    let li = document.createElement("li");
    li.textContent = c;
    missingList.appendChild(li);
  });

  // Present clauses
  presentList.innerHTML = "";
  analysis.present_clauses.forEach((c) => {
    let li = document.createElement("li");
    li.textContent = c;
    presentList.appendChild(li);
  });

  // Clause details
  detailsBox.innerHTML = analysis.details
    .map(
      (d) => `
    <div class="p-2 border-b border-white/10">
      <strong>${d.clause}</strong> — ${d.status}<br>
      Severity: ${d.severity}<br>
      Advice: ${d.advice}
    </div>`
    )
    .join("");

  gsap.from(panel, { opacity: 0, y: 20, duration: 0.5 });
}

// ===============================
//  ANALYZE BUTTON
// ===============================
document.getElementById("analyzeBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("fileInput");
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Select a file first.");
    return;
  }

  const file = fileInput.files[0];
  const fd = new FormData();
  fd.append("file", file, file.name);

  try {
    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const txt = await res.text();
      alert("Upload failed: " + txt);
      return;
    }

    const analysis = await res.json();
    console.log("Analysis:", analysis);

    // store for PDF export
    window.lastAnalysis = {
      ...analysis,
      filename: file.name,
    };

    // show results
    renderAnalysisPanel(analysis);

    refreshAll();
  } catch (err) {
    console.error(err);
    alert("Analyze failed.");
  }
});

// ===============================
//  PDF DOWNLOAD
// ===============================
document
  .getElementById("downloadReportBtn")
  .addEventListener("click", async () => {
    if (!window.lastAnalysis) {
      alert("Run analysis first.");
      return;
    }

    const fd = new FormData();
    fd.append("filename", window.lastAnalysis.filename || "report.pdf");
    fd.append("analysis_json", JSON.stringify(window.lastAnalysis));

    try {
      const res = await fetch(`${API_BASE}/report`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        alert("Failed to generate report.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "Compliance-Report.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF error:", err);
      alert("PDF failed.");
    }
  });

// ===============================
//  REFRESH BUTTON
// ===============================
document
  .getElementById("refreshBtn")
  .addEventListener("click", () => refreshAll());

// ===============================
//  INIT LOAD
// ===============================
refreshAll();
