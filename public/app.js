const refs = {
  analysisForm: document.getElementById("analysisForm"),
  tickerInput: document.getElementById("tickerInput"),
  strictMode: document.getElementById("strictMode"),
  resultTitle: document.getElementById("resultTitle"),
  resultSummary: document.getElementById("resultSummary"),
  scorePill: document.getElementById("scorePill"),
  kpiCards: document.getElementById("kpiCards"),
  reasonsList: document.getElementById("reasonsList"),
  topPicksRows: document.getElementById("topPicksRows")
};

let latestTopPicks = [];

function fmtPct(value) {
  if (!Number.isFinite(Number(value))) return "N/A";
  return `${Number(value).toFixed(1)}%`;
}

function fmtNum(value) {
  if (!Number.isFinite(Number(value))) return "N/A";
  return Number(value).toFixed(1);
}

function setEvaluationLoading(ticker) {
  const strictLabel = refs.strictMode?.value === "on" ? " (strict mode)" : "";
  refs.resultTitle.textContent = `Evaluating ${ticker}...`;
  refs.resultSummary.textContent = `Pulling live fundamentals, scoring risk gates, and ranking alternatives${strictLabel}.`;
  refs.scorePill.textContent = "...";
  refs.scorePill.className = "score-pill";
  refs.kpiCards.innerHTML = "";
  refs.reasonsList.innerHTML = "";
}

function setTopPicksLoading() {
  refs.topPicksRows.innerHTML = `
    <tr>
      <td colspan="10">Loading diversified live top picks...</td>
    </tr>
  `;
}

function setTopPicksError(message) {
  refs.topPicksRows.innerHTML = `
    <tr>
      <td colspan="10">${message}</td>
    </tr>
  `;
}

function setEvaluationError(message) {
  refs.resultTitle.textContent = "Unable to evaluate ticker";
  refs.resultSummary.textContent = message;
  refs.scorePill.textContent = "N/A";
  refs.scorePill.className = "score-pill warn";
  refs.kpiCards.innerHTML = "";
  refs.reasonsList.innerHTML = "";
}

function renderKpis(stock) {
  const scorecard = stock.scorecard || {};

  refs.kpiCards.innerHTML = `
    <article class="kpi"><h3>Value Score</h3><p>${fmtNum(scorecard.value ?? stock.valueScore)}</p></article>
    <article class="kpi"><h3>Dividend Score</h3><p>${fmtNum(scorecard.dividend ?? stock.dividendScore)}</p></article>
    <article class="kpi"><h3>Upside Score</h3><p>${fmtNum(scorecard.upside ?? stock.pricePotentialScore)}</p></article>
    <article class="kpi"><h3>Risk Score</h3><p>${fmtNum(scorecard.risk ?? stock.riskScore)}</p></article>
    <article class="kpi"><h3>Confidence</h3><p>${stock.dataQuality?.confidence || "N/A"}</p></article>
  `;
}

function buildFallbackThesis(stock) {
  const bullets = [];
  const value = fmtNum(stock.scorecard?.value ?? stock.valueScore);
  const dividend = fmtNum(stock.scorecard?.dividend ?? stock.dividendScore);
  const upside = fmtNum(stock.scorecard?.upside ?? stock.pricePotentialScore);
  const risk = fmtNum(stock.scorecard?.risk ?? stock.riskScore);
  const total = fmtNum(stock.totalScore);

  bullets.push(
    `Score profile: Value ${value}, Dividend ${dividend}, Upside ${upside}, Risk ${risk}, Total ${total}.`
  );

  if (Number.isFinite(Number(stock.dividendYield))) {
    bullets.push(`Dividend yield is ${fmtPct(stock.dividendYield)}.`);
  }

  if (Number.isFinite(Number(stock.upsidePotential))) {
    bullets.push(`Implied upside is ${fmtPct(stock.upsidePotential)}.`);
  }

  return bullets;
}

function buildFallbackWhy(stock) {
  const positives = [];
  const negatives = [];

  if (Number(stock.dividendYield) >= 3) {
    positives.push(`Income profile is solid with ${fmtPct(stock.dividendYield)} yield.`);
  } else if (Number.isFinite(Number(stock.dividendYield))) {
    negatives.push(`Income profile is lighter at ${fmtPct(stock.dividendYield)} yield.`);
  }

  if (Number(stock.upsidePotential) >= 12) {
    positives.push(`Upside signal is strong at ${fmtPct(stock.upsidePotential)}.`);
  } else if (Number.isFinite(Number(stock.upsidePotential))) {
    negatives.push(`Upside signal is modest at ${fmtPct(stock.upsidePotential)}.`);
  }

  if (Number(stock.pe) > 24) {
    negatives.push(`Valuation is rich with P/E ${fmtNum(stock.pe)}.`);
  } else if (Number.isFinite(Number(stock.pe))) {
    positives.push(`Valuation is acceptable with P/E ${fmtNum(stock.pe)}.`);
  }

  return { positives, negatives };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderSection(title, contentHtml) {
  return `
    <section class="contract-section">
      <h3 class="contract-title">${escapeHtml(title)}</h3>
      ${contentHtml}
    </section>
  `;
}

function renderBulletList(items, className = "") {
  const rows = items
    .filter((item) => item && String(item).trim())
    .map((item) => `<li class="${className}">${escapeHtml(item)}</li>`)
    .join("");
  return rows ? `<ul class="contract-list">${rows}</ul>` : "";
}

function renderContract(stock, topAlternatives) {
  const thesis = Array.isArray(stock.thesis) && stock.thesis.length ? stock.thesis : buildFallbackThesis(stock);
  const fallbackWhy = buildFallbackWhy(stock);
  const positives =
    Array.isArray(stock.why?.positives) && stock.why.positives.length ? stock.why.positives : fallbackWhy.positives;
  const negatives =
    Array.isArray(stock.why?.negatives) && stock.why.negatives.length ? stock.why.negatives : fallbackWhy.negatives;
  const flags = stock.hardRiskFlags || [];
  const dataQuality = stock.dataQuality || {};
  const alternativeLines = (topAlternatives || []).slice(0, 5).map((alt, i) => {
    return `${i + 1}. ${alt.ticker} (${fmtNum(alt.totalScore)}) - ${alt.recommendation}`;
  });
  const qualityLines = [
    `Source date: ${dataQuality.sourceDate ? new Date(dataQuality.sourceDate).toLocaleString() : "N/A"}`,
    `Missing metrics: ${dataQuality.missingMetrics?.length ? dataQuality.missingMetrics.join(", ") : "none"}`,
    `Confidence: ${dataQuality.confidence || "N/A"}`,
    `Assumptions: ${dataQuality.assumptions?.length ? dataQuality.assumptions.join(", ") : "none"}`
  ];

  const sections = [];
  sections.push(
    renderSection(
      "Recommendation",
      `<p class="contract-lead">${escapeHtml(stock.recommendation || "N/A")}</p>`
    )
  );

  if (thesis.length) {
    sections.push(renderSection("Thesis", renderBulletList(thesis)));
  }

  if (positives.length || negatives.length) {
    const whyHtml = `${renderBulletList(positives, "positive")}${renderBulletList(negatives, "negative")}`;
    sections.push(renderSection("Why It Scores This Way", whyHtml));
  }

  if (flags.length) {
    sections.push(renderSection("Risk Gates Triggered", renderBulletList(flags, "negative")));
  }

  if (alternativeLines.length) {
    sections.push(renderSection("Top 5 Alternatives", renderBulletList(alternativeLines)));
  }

  sections.push(renderSection("Data Quality + Confidence", renderBulletList(qualityLines)));
  refs.reasonsList.innerHTML = sections.join("");
}

function renderStockEvaluation(payload) {
  const stock = payload.stock;
  const total = fmtNum(stock.totalScore);
  const isPositive = stock.recommendation === "Recommend";
  const sourceLabel = stock.source ? `Source: ${stock.source}.` : "";
  const fallbackLabel = stock.isFallback ? " Using model fallback data due to live provider failure." : "";
  const strictLabel = payload.strictMode ? " Strict mode is ON." : "";
  const downgradeLabel =
    stock.baseRecommendation && stock.baseRecommendation !== stock.recommendation
      ? ` Recommendation downgraded from ${stock.baseRecommendation} due to low confidence.`
      : "";

  refs.resultTitle.textContent = `${stock.ticker} - ${stock.recommendation}`;
  refs.resultSummary.textContent =
    `${stock.company} scored ${total} using weighted KPIs (Dividend 40%, Upside 35%, Value 25%). ${sourceLabel}${fallbackLabel}${strictLabel}${downgradeLabel}`.trim();
  refs.scorePill.textContent = total;
  refs.scorePill.className = `score-pill ${isPositive ? "ok" : "warn"}`;

  renderKpis(stock);
  renderContract(stock, payload.topAlternatives || []);
}

function renderTopPicks(picks) {
  refs.topPicksRows.innerHTML = picks
    .map(
      (stock, index) => `
      <tr>
        <td>#${index + 1}</td>
        <td><strong>${stock.ticker}</strong></td>
        <td>${stock.company}</td>
        <td>${stock.sector || "Unknown"}</td>
        <td>${fmtNum(stock.totalScore)}</td>
        <td>${fmtPct(stock.dividendYield)}</td>
        <td>${fmtPct(stock.upsidePotential)}</td>
        <td>${fmtNum(stock.valueScore)}</td>
        <td>${fmtNum(stock.riskScore)}</td>
        <td class="${stock.recommendation === "Recommend" ? "ok" : "warn"}">${stock.recommendation}</td>
      </tr>
    `
    )
    .join("");
}

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }

  return payload;
}

async function evaluateTicker(ticker) {
  const clean = ticker.trim().toUpperCase();
  if (!clean) return;

  setEvaluationLoading(clean);

  try {
    const strict = refs.strictMode?.value === "on" ? "1" : "0";
    const payload = await fetchJson(`/api/stock/${encodeURIComponent(clean)}?strict=${strict}`);
    renderStockEvaluation(payload);
  } catch (error) {
    setEvaluationError(error.message || "Evaluation failed.");
  }
}

async function loadTopPicks() {
  setTopPicksLoading();

  try {
    const strict = refs.strictMode?.value === "on" ? "1" : "0";
    const payload = await fetchJson(`/api/top-picks?strict=${strict}`);
    latestTopPicks = payload.topPicks || [];

    if (!latestTopPicks.length) {
      setTopPicksError("No picks available right now.");
      return;
    }

    renderTopPicks(latestTopPicks);
  } catch (error) {
    setTopPicksError(error.message || "Failed to load top picks.");
  }
}

refs.analysisForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await evaluateTicker(refs.tickerInput.value);
});

refs.strictMode?.addEventListener("change", async () => {
  await loadTopPicks();
  await evaluateTicker(refs.tickerInput.value || latestTopPicks[0]?.ticker || "AAPL");
});

async function init() {
  await loadTopPicks();

  const defaultTicker = latestTopPicks[0]?.ticker || "AAPL";
  refs.tickerInput.value = defaultTicker;
  await evaluateTicker(defaultTicker);
}

init();
