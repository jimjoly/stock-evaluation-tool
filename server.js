const express = require("express");
const path = require("path");
const Parser = require("rss-parser");

const parser = new Parser();

const SEC_TICKER_URL = "https://www.sec.gov/files/company_tickers.json";
let tickerMapCache = null;
let tickerMapCacheAt = 0;

function getUserAgent() {
  const contact = process.env.CONTACT_EMAIL || "contact@example.com";
  return `market-catalyst-monitor/1.0 (${contact})`;
}

const POSITIVE_SIGNALS = [
  "beats",
  "beat",
  "strong demand",
  "record revenue",
  "raises guidance",
  "increase dividend",
  "dividend increase",
  "share buyback",
  "buyback",
  "acquisition approved",
  "profit rises",
  "growth accelerates",
  "upgraded",
  "surge",
  "expands",
  "contract win"
];

const NEGATIVE_SIGNALS = [
  "misses",
  "miss",
  "cuts guidance",
  "guidance cut",
  "dividend cut",
  "suspends dividend",
  "sec probe",
  "investigation",
  "downgraded",
  "profit falls",
  "decline",
  "layoffs",
  "recall",
  "bankruptcy",
  "default",
  "loss widens"
];

function normalizeTickerInput(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 8);
}

function shortText(text, length = 260) {
  if (!text) return "";
  const plain = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (plain.length <= length) return plain;
  return `${plain.slice(0, length).trim()}...`;
}

function scoreImpact(text = "") {
  const lower = text.toLowerCase();
  let positive = 0;
  let negative = 0;

  for (const signal of POSITIVE_SIGNALS) {
    if (lower.includes(signal)) positive += 1;
  }

  for (const signal of NEGATIVE_SIGNALS) {
    if (lower.includes(signal)) negative += 1;
  }

  const net = positive - negative;
  const confidence = Math.min(0.95, 0.5 + Math.min(4, Math.abs(net)) * 0.1);

  if (net > 0) {
    return {
      direction: "Likely Upward",
      confidence,
      rationale: `Detected ${positive} positive catalyst signal(s) and ${negative} negative signal(s).`
    };
  }

  if (net < 0) {
    return {
      direction: "Likely Downward",
      confidence,
      rationale: `Detected ${negative} negative catalyst signal(s) and ${positive} positive signal(s).`
    };
  }

  return {
    direction: "Unclear / Mixed",
    confidence: 0.5,
    rationale: "No strong directional catalyst language detected."
  };
}

async function getTickerMap() {
  const now = Date.now();
  if (tickerMapCache && now - tickerMapCacheAt < 6 * 60 * 60 * 1000) {
    return tickerMapCache;
  }

  const response = await fetch(SEC_TICKER_URL, {
    headers: {
      "User-Agent": getUserAgent()
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch SEC ticker mapping: HTTP ${response.status}`);
  }

  const raw = await response.json();
  const map = {};

  for (const key of Object.keys(raw)) {
    const record = raw[key];
    if (!record?.ticker || !record?.cik_str) continue;
    map[record.ticker.toUpperCase()] = String(record.cik_str).padStart(10, "0");
  }

  tickerMapCache = map;
  tickerMapCacheAt = now;
  return map;
}

async function fetchYahooRssForTicker(ticker) {
  const rssUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(
    ticker
  )}&region=US&lang=en-US`;

  const feed = await parser.parseURL(rssUrl);
  const items = (feed.items || []).slice(0, 10);

  return items.map((item) => {
    const summary = shortText(item.contentSnippet || item.content || item.title || "");
    const combined = `${item.title || ""} ${summary}`;
    const impact = scoreImpact(combined);

    return {
      source: "Yahoo Finance RSS",
      ticker,
      title: item.title || `Headline for ${ticker}`,
      url: item.link || "",
      publishedAt: item.pubDate || null,
      summary,
      impact
    };
  });
}

async function fetchSecFilingCatalysts(ticker) {
  try {
    const map = await getTickerMap();
    const cik = map[ticker];
    if (!cik) return [];

    const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": getUserAgent()
      }
    });

    if (!response.ok) return [];
    const company = await response.json();
    const recent = company?.filings?.recent;
    if (!recent?.form || !recent?.filingDate) return [];

    const filings = [];
    for (let i = 0; i < Math.min(6, recent.form.length); i += 1) {
      const form = recent.form[i];
      const filingDate = recent.filingDate[i];
      const accession = recent.accessionNumber[i];
      if (!form || !filingDate || !accession) continue;

      const filingText = `${ticker} filed ${form} on ${filingDate}`;
      const impact = scoreImpact(filingText);
      const accessionCompact = accession.replace(/-/g, "");
      const secUrl = `https://www.sec.gov/Archives/edgar/data/${Number(
        cik
      )}/${accessionCompact}/${accession}-index.html`;

      filings.push({
        source: "SEC Filings",
        ticker,
        title: `${form} filing`,
        url: secUrl,
        publishedAt: filingDate,
        summary: shortText(
          "Recent SEC filing. Review this filing for potential catalysts like guidance changes, risk disclosures, or major corporate actions."
        ),
        impact
      });
    }

    return filings;
  } catch {
    return [];
  }
}

function applyQueryFilter(items, query) {
  if (!query) return items;
  const lower = query.toLowerCase();
  return items.filter((item) => {
    const hay = `${item.title} ${item.summary} ${item.ticker}`.toLowerCase();
    return hay.includes(lower);
  });
}

function createApp() {
  const app = express();

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true, asOf: new Date().toISOString() });
  });

  app.use(express.static(path.join(__dirname, "public")));

  app.get("/api/search", async (req, res) => {
    const tickers = normalizeTickerInput(req.query.tickers || "AAPL,MSFT,TSLA,NVDA");
    const query = String(req.query.q || "").trim();

    if (!tickers.length) {
      return res.status(400).json({ error: "Provide at least one ticker symbol." });
    }

    try {
      const allResults = [];

      for (const ticker of tickers) {
        const [news, filings] = await Promise.all([
          fetchYahooRssForTicker(ticker).catch(() => []),
          fetchSecFilingCatalysts(ticker)
        ]);
        allResults.push(...news, ...filings);
      }

      const filtered = applyQueryFilter(allResults, query).sort((a, b) => {
        const aTime = new Date(a.publishedAt || 0).getTime();
        const bTime = new Date(b.publishedAt || 0).getTime();
        return bTime - aTime;
      });

      res.json({
        asOf: new Date().toISOString(),
        tickers,
        query,
        count: filtered.length,
        items: filtered.slice(0, 120)
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to retrieve market catalyst content.",
        details: error.message
      });
    }
  });

  return app;
}

function startServer(
  port = process.env.PORT || 3000,
  host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1")
) {
  const app = createApp();
  return new Promise((resolve) => {
    const server = app.listen(port, host, () => {
      const address = server.address();
      const activePort = typeof address === "string" ? port : address.port;
      console.log(`Market Catalyst Monitor running at http://${host}:${activePort}`);
      resolve({ app, server, port: activePort });
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer
};
