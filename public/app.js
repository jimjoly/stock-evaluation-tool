const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const searchBtn = document.getElementById("searchBtn");
const tickersEl = document.getElementById("tickers");
const queryEl = document.getElementById("query");

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

async function search() {
  const tickers = encodeURIComponent(tickersEl.value.trim());
  const q = encodeURIComponent(queryEl.value.trim());
  statusEl.textContent = "Loading catalyst data...";
  searchBtn.disabled = true;

  try {
    const response = await fetch(`/api/search?tickers=${tickers}&q=${q}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");

    render(data.items || []);
    statusEl.textContent = `Found ${data.count} items. Updated ${fmtDate(data.asOf)}.`;
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

search();
