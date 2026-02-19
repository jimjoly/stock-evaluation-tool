const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const searchBtn = document.getElementById("searchBtn");
const tickersEl = document.getElementById("tickers");
const queryEl = document.getElementById("query");
const timeWindowEl = document.getElementById("timeWindow");
const assetClassEls = Array.from(document.querySelectorAll('.asset-groups input[type="checkbox"]'));

function fmtDate(value) {
  if (!value) return "Unknown date";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function impactClass(direction) {
  if (direction.includes("Upward")) return "up";
  if (direction.includes("Downward")) return "down";
  return "flat";
}

function cardTemplate(item) {
  const cls = impactClass(item.impact.direction);
  const confidence = Math.round(item.impact.confidence * 100);
  return `
    <article class="card">
      <div class="card-head">
        <div>
          <h3 class="title">${item.title}</h3>
          <p class="meta-row">${item.ticker} · ${item.source} · ${fmtDate(item.publishedAt)}</p>
        </div>
        <span class="impact ${cls}">${item.impact.direction} (${confidence}%)</span>
      </div>
      <p class="summary">${item.summary}</p>
      <p class="meta-row">Rationale: ${item.impact.rationale}</p>
      <p class="meta-row"><a target="_blank" rel="noopener noreferrer" href="${item.url}">View source</a></p>
    </article>
  `;
}

function render(items) {
  if (!items.length) {
    resultsEl.innerHTML =
      '<article class="card"><h3 class="title">No results</h3><p class="summary">Try broader tickers or remove keyword filters.</p></article>';
    return;
  }
  resultsEl.innerHTML = items.map(cardTemplate).join("");
}

function getSelectedAssets() {
  return assetClassEls
    .filter((el) => el.checked)
    .map((el) => el.value)
    .join(",");
}

function syncUrlParams() {
  const params = new URLSearchParams();
  const tickers = tickersEl.value.trim();
  const q = queryEl.value.trim();
  const assets = getSelectedAssets();
  const windowValue = timeWindowEl.value;

  if (tickers) params.set("tickers", tickers);
  if (q) params.set("q", q);
  if (assets) params.set("assets", assets);
  if (windowValue && windowValue !== "12h") params.set("window", windowValue);

  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
  window.history.replaceState(null, "", next);
}

function hydrateFromUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const tickers = params.get("tickers");
  const q = params.get("q");
  const assets = params.get("assets");
  const windowValue = params.get("window");

  if (tickers) tickersEl.value = tickers;
  if (q) queryEl.value = q;
  if (windowValue && ["all", "12h", "24h", "36h", "48h", "7d"].includes(windowValue)) {
    timeWindowEl.value = windowValue;
  } else {
    timeWindowEl.value = "12h";
  }
  if (assets) {
    const selected = new Set(
      assets
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    );
    assetClassEls.forEach((el) => {
      el.checked = selected.has(el.value);
    });
  }
}

async function search() {
  const tickers = encodeURIComponent(tickersEl.value.trim());
  const q = encodeURIComponent(queryEl.value.trim());
  const assets = getSelectedAssets();
  const windowValue = timeWindowEl.value;

  if (!assets) {
    statusEl.textContent = "Select at least one asset class.";
    return;
  }

  syncUrlParams();
  statusEl.textContent = "Loading top 10 catalyst items...";
  searchBtn.disabled = true;

  try {
    const response = await fetch(
      `/api/search?tickers=${tickers}&assets=${encodeURIComponent(assets)}&q=${q}&window=${encodeURIComponent(windowValue)}`
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");

    render(data.items || []);
    statusEl.textContent = `Showing top ${data.count} ranked items across ${(
      data.assetClasses || []
    ).join(", ")} (${data.totalMatched} matched, ${data.timeWindow}). Updated ${fmtDate(data.asOf)}.`;
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
    render([]);
  } finally {
    searchBtn.disabled = false;
  }
}

searchBtn.addEventListener("click", search);
queryEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") search();
});
tickersEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") search();
});

function init() {
  hydrateFromUrlParams();
  search();

  // Fallback retry in case the first request is interrupted during page boot.
  setTimeout(() => {
    if (!resultsEl.children.length) {
      search();
    }
  }, 1200);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
