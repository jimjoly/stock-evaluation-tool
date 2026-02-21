const express = require("express");
const path = require("path");
const Parser = require("rss-parser");

const parser = new Parser();

const KPI_WEIGHTS = {
  value: 0.25,
  dividend: 0.4,
  upside: 0.35
};

const DEFAULT_UNIVERSE = [
  "AAPL",
  "MSFT",
  "JNJ",
  "ABBV",
  "XOM",
  "CVX",
  "PG",
  "KO",
  "PEP",
  "VZ",
  "T",
  "PFE",
  "AMGN",
  "HD",
  "UNP",
  "MRK",
  "CSCO",
  "IBM",
  "MCD",
  "BAC",
  "SO",
  "DUK",
  "O",
  "NEE",
  "TXN",
  "BLK"
];

const FMP_API_KEY = process.env.FMP_API_KEY || process.env.FINANCIAL_MODELING_PREP_API_KEY || "";
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || "";
const ALLOW_MODEL_FALLBACK = process.env.ALLOW_MODEL_FALLBACK !== "false";

const CACHE_TTL_MS = 15 * 60 * 1000;
const PER_STOCK_TTL_MS = 10 * 60 * 1000;
const cache = {
  stock: new Map(),
  universe: null
};

const SEC_TICKER_URL = "https://www.sec.gov/files/company_tickers.json";
let tickerMapCache = null;
let tickerMapCacheAt = 0;

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

const ASSET_PRESETS = {
  stocks: ["AAPL", "MSFT", "NVDA", "AMZN"],
  crypto: ["BTC-USD", "ETH-USD", "SOL-USD"],
  metals: ["GC=F", "SI=F"],
  funds: ["SPY", "QQQ", "GLD"]
};
const TOP_CATALYST_RESULTS = 10;
const SOURCE_WEIGHTS = {
  "SEC Filings": 3,
  "Yahoo Finance RSS": 1
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseTicker(input) {
  const clean = String(input || "")
    .trim()
    .toUpperCase();

  if (!/^[A-Z.\-]{1,10}$/.test(clean)) {
    return null;
  }

  return clean;
}

function getUserAgent() {
  const contact = process.env.CONTACT_EMAIL || "contact@example.com";
  return `market-catalyst-monitor/1.0 (${contact})`;
}

function normalizeAssetClassInput(raw) {
  if (!raw) return ["stocks"];
  const classes = String(raw)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => Object.hasOwn(ASSET_PRESETS, item));
  return classes.length ? [...new Set(classes)] : ["stocks"];
}

function normalizeTickerInput(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 8);
}

function resolveTickers(rawTickers, assetClasses) {
  const custom = normalizeTickerInput(rawTickers);
  if (custom.length) {
    return custom;
  }
  const preset = assetClasses.flatMap((assetClass) => ASSET_PRESETS[assetClass] || []);
  return [...new Set(preset)].slice(0, 24);
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
      strength: Math.abs(net),
      rationale: `Detected ${positive} positive catalyst signal(s) and ${negative} negative signal(s).`
    };
  }

  if (net < 0) {
    return {
      direction: "Likely Downward",
      confidence,
      strength: Math.abs(net),
      rationale: `Detected ${negative} negative catalyst signal(s) and ${positive} positive signal(s).`
    };
  }

  return {
    direction: "Unclear / Mixed",
    confidence: 0.5,
    strength: 0,
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

function applyTimeWindowFilter(items, windowKey) {
  if (!windowKey || windowKey === "all") return items;
  const now = Date.now();
  const windows = {
    "12h": 12 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "36h": 36 * 60 * 60 * 1000,
    "48h": 48 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000
  };
  const span = windows[windowKey];
  if (!span) return items;

  return items.filter((item) => {
    const published = new Date(item.publishedAt || "").getTime();
    if (!Number.isFinite(published)) return false;
    return now - published <= span;
  });
}

function rankCatalystItems(items) {
  return [...items].sort((a, b) => {
    const aDirectional = a.impact.direction === "Unclear / Mixed" ? 0 : 1;
    const bDirectional = b.impact.direction === "Unclear / Mixed" ? 0 : 1;
    if (bDirectional !== aDirectional) return bDirectional - aDirectional;
    const aSourceWeight = SOURCE_WEIGHTS[a.source] || 0;
    const bSourceWeight = SOURCE_WEIGHTS[b.source] || 0;
    if (bSourceWeight !== aSourceWeight) return bSourceWeight - aSourceWeight;
    if (b.impact.strength !== a.impact.strength) return b.impact.strength - a.impact.strength;
    if (b.impact.confidence !== a.impact.confidence) return b.impact.confidence - a.impact.confidence;
    const aTime = new Date(a.publishedAt || 0).getTime();
    const bTime = new Date(b.publishedAt || 0).getTime();
    return bTime - aTime;
  });
}

function hashTicker(ticker) {
  let hash = 0;
  for (let i = 0; i < ticker.length; i += 1) {
    hash = (hash * 31 + ticker.charCodeAt(i)) % 100000;
  }
  return hash;
}

function companyNameFromTicker(ticker) {
  const known = {
    AAPL: "Apple Inc.",
    MSFT: "Microsoft Corp.",
    JNJ: "Johnson & Johnson",
    ABBV: "AbbVie Inc.",
    XOM: "Exxon Mobil",
    CVX: "Chevron Corp.",
    PG: "Procter & Gamble",
    KO: "Coca-Cola Co.",
    PEP: "PepsiCo Inc.",
    VZ: "Verizon Communications",
    T: "AT&T Inc.",
    PFE: "Pfizer Inc.",
    AMGN: "Amgen Inc.",
    HD: "Home Depot",
    UNP: "Union Pacific",
    MRK: "Merck & Co.",
    CSCO: "Cisco Systems",
    IBM: "IBM",
    MCD: "McDonald's Corp.",
    BAC: "Bank of America"
  };

  return known[ticker] || `${ticker} Corporation`;
}

function inferSectorFromTicker(ticker) {
  const map = {
    XOM: "Energy",
    CVX: "Energy",
    T: "Communication Services",
    VZ: "Communication Services",
    SO: "Utilities",
    DUK: "Utilities",
    O: "Real Estate",
    NEE: "Utilities",
    BAC: "Financial Services",
    BLK: "Financial Services"
  };
  return map[ticker] || "Unknown";
}

function buildModelFallbackStock(ticker, providerErrors) {
  const h = hashTicker(ticker);
  const normalized = (n, min, max) => min + (((h + n * 97) % 1000) / 1000) * (max - min);

  return {
    ticker,
    company: companyNameFromTicker(ticker),
    sector: inferSectorFromTicker(ticker),
    industry: null,
    marketPrice: Number(normalized(1, 45, 320).toFixed(2)),
    pe: Number(normalized(2, 9, 31).toFixed(1)),
    fcfYield: Number(normalized(3, 2.5, 9.5).toFixed(1)),
    dividendYield: Number(normalized(4, 0.4, 5.8).toFixed(1)),
    dividendGrowth5y: Number(normalized(5, 1.0, 11.0).toFixed(1)),
    payoutRatio: Number(normalized(6, 28, 74).toFixed(1)),
    debtToEbitda: Number(normalized(7, 0.4, 3.1).toFixed(1)),
    upsidePotential: Number(normalized(8, 5.0, 18.0).toFixed(1)),
    earningsCagr3y: Number(normalized(9, 1.0, 12.0).toFixed(1)),
    source: "Model Fallback (Live providers unavailable)",
    isFallback: true,
    providerErrors,
    fetchedAt: new Date().toISOString()
  };
}

function readRaw(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object" && value !== null && typeof value.raw === "number") return value.raw;
  return null;
}

function parseNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[%,$]/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizePercent(value) {
  const numeric = parseNumber(value);
  if (!Number.isFinite(numeric)) return null;
  if (Math.abs(numeric) <= 1) return numeric * 100;
  return numeric;
}

function normalizeHigherBetter(value, min, max) {
  if (max === min) return 50;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

function normalizeLowerBetter(value, min, max) {
  if (max === min) return 50;
  return clamp(((max - value) / (max - min)) * 100, 0, 100);
}

function median(values, fallback) {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!clean.length) return fallback;
  const mid = Math.floor(clean.length / 2);
  if (clean.length % 2 === 0) {
    return (clean[mid - 1] + clean[mid]) / 2;
  }
  return clean[mid];
}

function metricOrDefault(value, defaultValue) {
  return Number.isFinite(value) ? value : defaultValue;
}

function getAnnualDividendGrowthFromEvents(events = {}) {
  const dividendEvents = events.dividends || {};
  const byYear = new Map();

  for (const event of Object.values(dividendEvents)) {
    const ts = Number(event.date || event.timestamp);
    const amount = Number(event.amount);
    if (!Number.isFinite(ts) || !Number.isFinite(amount)) continue;

    const year = new Date(ts * 1000).getUTCFullYear();
    byYear.set(year, (byYear.get(year) || 0) + amount);
  }

  const years = Array.from(byYear.keys()).sort((a, b) => a - b);
  if (years.length < 3) return null;

  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const firstValue = byYear.get(firstYear);
  const lastValue = byYear.get(lastYear);
  const span = lastYear - firstYear;

  if (!Number.isFinite(firstValue) || !Number.isFinite(lastValue) || firstValue <= 0 || span <= 0) {
    return null;
  }

  const growth = (Math.pow(lastValue / firstValue, 1 / span) - 1) * 100;
  return Number.isFinite(growth) ? growth : null;
}

function getUpsidePotential(targetMeanPrice, marketPrice) {
  if (!Number.isFinite(targetMeanPrice) || !Number.isFinite(marketPrice) || marketPrice <= 0) {
    return null;
  }
  return ((targetMeanPrice - marketPrice) / marketPrice) * 100;
}

async function fetchJson(url, providerLabel) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 CodexStockEvaluator/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`${providerLabel} request failed (${response.status}).`);
  }

  return response.json();
}

async function fetchFromYahoo(ticker) {
  const summaryUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    ticker
  )}?modules=price,summaryDetail,financialData,defaultKeyStatistics,assetProfile`;
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?range=5y&interval=1mo&events=div`;

  const [summaryPayload, chartPayload] = await Promise.all([
    fetchJson(summaryUrl, "Yahoo Finance"),
    fetchJson(chartUrl, "Yahoo Finance")
  ]);

  const summaryResult = summaryPayload?.quoteSummary?.result?.[0];
  const chartResult = chartPayload?.chart?.result?.[0];

  if (!summaryResult) {
    throw new Error(`Ticker not found in Yahoo Finance: ${ticker}`);
  }

  const price = summaryResult.price || {};
  const detail = summaryResult.summaryDetail || {};
  const financial = summaryResult.financialData || {};
  const stats = summaryResult.defaultKeyStatistics || {};
  const profile = summaryResult.assetProfile || {};

  const marketPrice = readRaw(price.regularMarketPrice);
  const targetMeanPrice = readRaw(financial.targetMeanPrice);
  const totalDebt = readRaw(financial.totalDebt);
  const ebitda = readRaw(financial.ebitda);
  const marketCap = readRaw(price.marketCap);
  const freeCashflow = readRaw(financial.freeCashflow);

  return {
    ticker,
    company: String(price.longName || price.shortName || detail.longName || `${ticker} Corporation`).trim(),
    sector: String(profile.sector || "Unknown").trim(),
    industry: String(profile.industry || "").trim() || null,
    marketPrice,
    pe: readRaw(detail.trailingPE) ?? readRaw(stats.trailingPE),
    fcfYield:
      Number.isFinite(freeCashflow) && Number.isFinite(marketCap) && marketCap > 0
        ? (freeCashflow / marketCap) * 100
        : null,
    dividendYield: Number.isFinite(readRaw(detail.dividendYield)) ? readRaw(detail.dividendYield) * 100 : null,
    dividendGrowth5y: getAnnualDividendGrowthFromEvents(chartResult?.events),
    payoutRatio: Number.isFinite(readRaw(detail.payoutRatio)) ? readRaw(detail.payoutRatio) * 100 : null,
    debtToEbitda: Number.isFinite(totalDebt) && Number.isFinite(ebitda) && ebitda > 0 ? totalDebt / ebitda : null,
    upsidePotential: getUpsidePotential(targetMeanPrice, marketPrice),
    earningsCagr3y: Number.isFinite(readRaw(financial.earningsGrowth)) ? readRaw(financial.earningsGrowth) * 100 : null,
    source: "Yahoo Finance",
    isFallback: false,
    fetchedAt: new Date().toISOString()
  };
}

async function fetchFromFmp(ticker) {
  if (!FMP_API_KEY) {
    throw new Error("Financial Modeling Prep API key not configured.");
  }

  const base = "https://financialmodelingprep.com/api/v3";
  const [quotePayload, ratiosPayload, metricsPayload, estimatesPayload, profilePayload] = await Promise.all([
    fetchJson(`${base}/quote/${encodeURIComponent(ticker)}?apikey=${encodeURIComponent(FMP_API_KEY)}`, "FMP"),
    fetchJson(`${base}/ratios-ttm/${encodeURIComponent(ticker)}?apikey=${encodeURIComponent(FMP_API_KEY)}`, "FMP"),
    fetchJson(`${base}/key-metrics-ttm/${encodeURIComponent(ticker)}?apikey=${encodeURIComponent(FMP_API_KEY)}`, "FMP"),
    fetchJson(
      `${base}/analyst-estimates/${encodeURIComponent(ticker)}?limit=1&apikey=${encodeURIComponent(FMP_API_KEY)}`,
      "FMP"
    ),
    fetchJson(`${base}/profile/${encodeURIComponent(ticker)}?apikey=${encodeURIComponent(FMP_API_KEY)}`, "FMP")
  ]);

  const quote = Array.isArray(quotePayload) ? quotePayload[0] : null;
  const ratios = Array.isArray(ratiosPayload) ? ratiosPayload[0] : null;
  const metrics = Array.isArray(metricsPayload) ? metricsPayload[0] : null;
  const estimate = Array.isArray(estimatesPayload) ? estimatesPayload[0] : null;
  const profile = Array.isArray(profilePayload) ? profilePayload[0] : null;

  if (!quote) {
    throw new Error(`Ticker not found in FMP: ${ticker}`);
  }

  const marketPrice = parseNumber(quote.price);
  const targetPrice = parseNumber(quote.priceTarget) ?? parseNumber(estimate?.priceTarget);

  return {
    ticker,
    company: String(profile?.companyName || quote.name || `${ticker} Corporation`).trim(),
    sector: String(profile?.sector || "Unknown").trim(),
    industry: String(profile?.industry || "").trim() || null,
    marketPrice,
    pe: parseNumber(quote.pe) ?? parseNumber(ratios?.peRatioTTM),
    fcfYield: normalizePercent(metrics?.freeCashFlowYieldTTM),
    dividendYield: normalizePercent(quote.dividendYield),
    dividendGrowth5y: normalizePercent(metrics?.dividendYieldGrowthTTM),
    payoutRatio: normalizePercent(ratios?.payoutRatioTTM),
    debtToEbitda: parseNumber(metrics?.netDebtToEBITDATTM),
    upsidePotential: getUpsidePotential(targetPrice, marketPrice),
    earningsCagr3y: normalizePercent(estimate?.estimatedEpsAvgGrowth),
    source: "Financial Modeling Prep",
    isFallback: false,
    fetchedAt: new Date().toISOString()
  };
}

async function fetchFromAlphaVantage(ticker) {
  if (!ALPHA_VANTAGE_API_KEY) {
    throw new Error("Alpha Vantage API key not configured.");
  }

  const base = "https://www.alphavantage.co/query";
  const [overviewPayload, quotePayload] = await Promise.all([
    fetchJson(
      `${base}?function=OVERVIEW&symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(ALPHA_VANTAGE_API_KEY)}`,
      "Alpha Vantage"
    ),
    fetchJson(
      `${base}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(ALPHA_VANTAGE_API_KEY)}`,
      "Alpha Vantage"
    )
  ]);

  if (!overviewPayload || !overviewPayload.Symbol) {
    throw new Error(`Ticker not found in Alpha Vantage: ${ticker}`);
  }

  const marketPrice =
    parseNumber(quotePayload?.["Global Quote"]?.["05. price"]) ?? parseNumber(overviewPayload["52WeekHigh"]);
  const targetPrice = parseNumber(overviewPayload.AnalystTargetPrice);

  return {
    ticker,
    company: String(overviewPayload.Name || `${ticker} Corporation`).trim(),
    sector: String(overviewPayload.Sector || "Unknown").trim(),
    industry: String(overviewPayload.Industry || "").trim() || null,
    marketPrice,
    pe: parseNumber(overviewPayload.PERatio),
    fcfYield: null,
    dividendYield: normalizePercent(overviewPayload.DividendYield),
    dividendGrowth5y: null,
    payoutRatio: normalizePercent(overviewPayload.PayoutRatio),
    debtToEbitda: null,
    upsidePotential: getUpsidePotential(targetPrice, marketPrice),
    earningsCagr3y: normalizePercent(overviewPayload.QuarterlyEarningsGrowthYOY),
    source: "Alpha Vantage",
    isFallback: false,
    fetchedAt: new Date().toISOString()
  };
}

function hasCoreMetrics(stock) {
  return stock && Number.isFinite(stock.marketPrice) && stock.marketPrice > 0 && typeof stock.company === "string";
}

async function fetchStockFundamentals(ticker) {
  const cached = cache.stock.get(ticker);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const providers = [fetchFromYahoo, fetchFromFmp, fetchFromAlphaVantage];
  const errors = [];

  for (const provider of providers) {
    try {
      const data = await provider(ticker);
      if (hasCoreMetrics(data)) {
        cache.stock.set(ticker, { data, expiresAt: now + PER_STOCK_TTL_MS });
        return data;
      }
      errors.push(`${provider.name}: missing core metrics`);
    } catch (error) {
      errors.push(`${provider.name}: ${error.message}`);
    }
  }

  if (ALLOW_MODEL_FALLBACK) {
    const data = buildModelFallbackStock(ticker, errors);
    cache.stock.set(ticker, { data, expiresAt: now + PER_STOCK_TTL_MS });
    return data;
  }

  throw new Error(`Failed to load live data for ${ticker}. ${errors.join(" | ")}`);
}

function getMissingMetrics(stock) {
  const missing = [];
  if (!Number.isFinite(stock.pe)) missing.push("pe");
  if (!Number.isFinite(stock.fcfYield)) missing.push("fcfYield");
  if (!Number.isFinite(stock.dividendYield)) missing.push("dividendYield");
  if (!Number.isFinite(stock.payoutRatio)) missing.push("payoutRatio");
  if (!Number.isFinite(stock.upsidePotential)) missing.push("upsidePotential");
  if (!Number.isFinite(stock.earningsCagr3y)) missing.push("earningsCagr3y");
  return missing;
}

function sectorBucket(sector) {
  const text = String(sector || "Unknown").toLowerCase();
  if (!text || text === "unknown") return "Unknown";
  if (text.includes("utility")) return "Utilities";
  if (text.includes("communication") || text.includes("telecom")) return "Communication Services";
  if (text.includes("real estate") || text.includes("reit")) return "Real Estate";
  if (text.includes("energy")) return "Energy";
  if (text.includes("financial")) return "Financial Services";
  if (text.includes("technology") || text.includes("tech")) return "Technology";
  return sector;
}

function leverageThresholdBySector(sector) {
  const bucket = sectorBucket(sector);
  if (bucket === "Utilities" || bucket === "Communication Services") return 4.2;
  if (bucket === "Real Estate") return 5.0;
  return 3.5;
}

function getHardRiskFlags(stock, missingMetrics) {
  const flags = [];
  const leverageThreshold = leverageThresholdBySector(stock.sector);

  if (stock.payoutRatio > 85) {
    flags.push("Payout ratio above 85%.");
  }

  if (stock.debtToEbitda > leverageThreshold) {
    flags.push(`Debt/EBITDA (${stock.debtToEbitda.toFixed(1)}x) above sector threshold (${leverageThreshold.toFixed(1)}x).`);
  }

  if (stock.earningsCagr3y < 0 && stock.payoutRatio > 70) {
    flags.push("Negative earnings trend with elevated payout ratio.");
  }

  if (missingMetrics.includes("upsidePotential") && missingMetrics.includes("fcfYield")) {
    flags.push("Missing both upside proxy and cash-flow quality proxy.");
  }

  return flags;
}

function getRiskScore(stock, missingMetrics, hardFlags) {
  let score = 100;

  if (Number.isFinite(stock.debtToEbitda)) {
    score -= Math.max(0, stock.debtToEbitda - 1.5) * 9;
  }

  if (Number.isFinite(stock.payoutRatio)) {
    score -= Math.max(0, stock.payoutRatio - 65) * 0.55;
  }

  if (Number.isFinite(stock.earningsCagr3y) && stock.earningsCagr3y < 0) {
    score -= Math.abs(stock.earningsCagr3y) * 2.4;
  }

  score -= missingMetrics.length * 6;
  score -= hardFlags.length * 10;
  if (stock.isFallback) score -= 15;

  return clamp(score, 0, 100);
}

function getConfidence(stock, missingMetrics, hardFlags) {
  if (stock.isFallback) {
    return "Low";
  }

  if (hardFlags.length >= 2 || missingMetrics.length >= 3) {
    return "Low";
  }

  if (hardFlags.length >= 1 || missingMetrics.length >= 1) {
    return "Medium";
  }

  return "High";
}

function getRecommendation(totalScore, hardFlags) {
  if (totalScore >= 72 && hardFlags.length === 0) return "Recommend";
  if (totalScore >= 72 && hardFlags.length > 0) return "Hold / Selective Buy";
  if (totalScore >= 55) return "Hold / Selective Buy";
  return "Do Not Recommend";
}

function parseStrictMode(value) {
  if (value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
}

function buildWhyAndThesis(stock, scorecard, recommendation, hardFlags, confidence, assumptions) {
  const positives = [];
  const negatives = [];

  if (stock.dividendYield >= 3.0) {
    positives.push(`Dividend yield is income-competitive at ${stock.dividendYield.toFixed(1)}%.`);
  } else {
    negatives.push(`Dividend yield is modest at ${stock.dividendYield.toFixed(1)}%.`);
  }

  if (stock.upsidePotential >= 12) {
    positives.push(`Implied upside is healthy at ${stock.upsidePotential.toFixed(1)}%.`);
  } else {
    negatives.push(`Implied upside is limited at ${stock.upsidePotential.toFixed(1)}%.`);
  }

  if (stock.pe <= 17 && stock.fcfYield >= 5) {
    positives.push(`Valuation/cash-flow mix is strong (P/E ${stock.pe.toFixed(1)}, FCF yield ${stock.fcfYield.toFixed(1)}%).`);
  } else if (stock.pe > 24) {
    negatives.push(`Valuation is rich with P/E ${stock.pe.toFixed(1)}.`);
  } else {
    positives.push(`Valuation appears reasonable (P/E ${stock.pe.toFixed(1)}).`);
  }

  if (hardFlags.length > 0) {
    negatives.push(...hardFlags);
  }

  const thesis = [];
  thesis.push(
    `Score profile: Value ${scorecard.value.toFixed(1)}, Dividend ${scorecard.dividend.toFixed(1)}, Upside ${scorecard.upside.toFixed(1)}, Risk ${scorecard.risk.toFixed(1)}.`
  );
  thesis.push(
    `${recommendation} based on weighted total ${scorecard.total.toFixed(1)} with dividend and upside prioritized.`
  );

  if (hardFlags.length > 0) {
    thesis.push(`Risk gate triggered: ${hardFlags[0]}`);
  }

  if (assumptions.length > 0) {
    thesis.push(`Assumptions applied: ${assumptions.join(", ")}.`);
  }

  thesis.push(`Confidence is ${confidence} given current data completeness and source quality.`);

  return {
    thesis: thesis.slice(0, 4),
    why: {
      positives: positives.slice(0, 3),
      negatives: negatives.slice(0, 3)
    }
  };
}

function scoreStocks(stocks, options = {}) {
  const strictMode = Boolean(options.strictMode);
  const defaults = {
    pe: median(stocks.map((s) => s.pe), 18),
    fcfYield: median(stocks.map((s) => s.fcfYield), 5),
    dividendYield: median(stocks.map((s) => s.dividendYield), 2.5),
    dividendGrowth5y: median(stocks.map((s) => s.dividendGrowth5y), 4),
    payoutRatio: median(stocks.map((s) => s.payoutRatio), 55),
    debtToEbitda: median(stocks.map((s) => s.debtToEbitda), 1.8),
    upsidePotential: median(stocks.map((s) => s.upsidePotential), 10),
    earningsCagr3y: median(stocks.map((s) => s.earningsCagr3y), 6)
  };

  const normalized = stocks.map((stock) => {
    const missingMetrics = getMissingMetrics(stock);
    const assumptions = [];

    const withDefaults = {
      ...stock,
      pe: metricOrDefault(stock.pe, defaults.pe),
      fcfYield: metricOrDefault(stock.fcfYield, defaults.fcfYield),
      dividendYield: metricOrDefault(stock.dividendYield, defaults.dividendYield),
      dividendGrowth5y: metricOrDefault(stock.dividendGrowth5y, defaults.dividendGrowth5y),
      payoutRatio: metricOrDefault(stock.payoutRatio, defaults.payoutRatio),
      debtToEbitda: metricOrDefault(stock.debtToEbitda, defaults.debtToEbitda),
      upsidePotential: metricOrDefault(stock.upsidePotential, defaults.upsidePotential),
      earningsCagr3y: metricOrDefault(stock.earningsCagr3y, defaults.earningsCagr3y),
      sector: stock.sector || "Unknown"
    };

    if (missingMetrics.includes("fcfYield")) assumptions.push("fcfYield median proxy");
    if (missingMetrics.includes("upsidePotential")) assumptions.push("upsidePotential median proxy");
    if (missingMetrics.includes("dividendGrowth5y")) assumptions.push("dividendGrowth median proxy");

    return {
      ...withDefaults,
      missingMetrics,
      assumptions
    };
  });

  const bounds = {
    peMin: Math.min(...normalized.map((s) => s.pe)),
    peMax: Math.max(...normalized.map((s) => s.pe)),
    fcfMin: Math.min(...normalized.map((s) => s.fcfYield)),
    fcfMax: Math.max(...normalized.map((s) => s.fcfYield)),
    dyMin: Math.min(...normalized.map((s) => s.dividendYield)),
    dyMax: Math.max(...normalized.map((s) => s.dividendYield)),
    dgMin: Math.min(...normalized.map((s) => s.dividendGrowth5y)),
    dgMax: Math.max(...normalized.map((s) => s.dividendGrowth5y)),
    upMin: Math.min(...normalized.map((s) => s.upsidePotential)),
    upMax: Math.max(...normalized.map((s) => s.upsidePotential)),
    earnMin: Math.min(...normalized.map((s) => s.earningsCagr3y)),
    earnMax: Math.max(...normalized.map((s) => s.earningsCagr3y))
  };

  return normalized
    .map((stock) => {
      const peScore = normalizeLowerBetter(stock.pe, bounds.peMin, bounds.peMax);
      const fcfScore = normalizeHigherBetter(stock.fcfYield, bounds.fcfMin, bounds.fcfMax);
      const leveragePenalty = stock.debtToEbitda > leverageThresholdBySector(stock.sector) ? 12 : stock.debtToEbitda > 2.5 ? 6 : 0;
      const valueScore = clamp(peScore * 0.45 + fcfScore * 0.55 - leveragePenalty, 0, 100);

      const yieldScore = normalizeHigherBetter(stock.dividendYield, bounds.dyMin, bounds.dyMax);
      const growthScore = normalizeHigherBetter(stock.dividendGrowth5y, bounds.dgMin, bounds.dgMax);
      const payoutSustainability = clamp(100 - Math.abs(stock.payoutRatio - 55) * 2, 0, 100);
      const dividendScore = clamp(yieldScore * 0.65 + growthScore * 0.2 + payoutSustainability * 0.15, 0, 100);

      const upsideScore = normalizeHigherBetter(stock.upsidePotential, bounds.upMin, bounds.upMax);
      const earningsSupport = normalizeHigherBetter(stock.earningsCagr3y, bounds.earnMin, bounds.earnMax);
      const pricePotentialScore = clamp(upsideScore * 0.8 + earningsSupport * 0.2, 0, 100);

      const hardFlags = getHardRiskFlags(stock, stock.missingMetrics);
      const riskScore = getRiskScore(stock, stock.missingMetrics, hardFlags);

      const totalScore =
        valueScore * KPI_WEIGHTS.value +
        dividendScore * KPI_WEIGHTS.dividend +
        pricePotentialScore * KPI_WEIGHTS.upside;

      const recommendation = getRecommendation(totalScore, hardFlags);
      const confidence = getConfidence(stock, stock.missingMetrics, hardFlags);
      const finalRecommendation =
        strictMode && confidence === "Low" && recommendation === "Recommend"
          ? "Hold / Selective Buy"
          : recommendation;
      const scorecard = {
        value: valueScore,
        dividend: dividendScore,
        upside: pricePotentialScore,
        risk: riskScore,
        total: totalScore
      };

      const { thesis, why } = buildWhyAndThesis(
        stock,
        { ...scorecard, total: totalScore },
        finalRecommendation,
        hardFlags,
        confidence,
        stock.assumptions
      );

      return {
        ...stock,
        valueScore,
        dividendScore,
        pricePotentialScore,
        riskScore,
        totalScore,
        recommendation: finalRecommendation,
        baseRecommendation: recommendation,
        thesis,
        scorecard,
        why,
        hardRiskFlags: hardFlags,
        reasons: [...thesis, ...why.positives, ...why.negatives],
        dataQuality: {
          source: stock.source,
          sourceDate: stock.fetchedAt,
          missingMetrics: stock.missingMetrics,
          confidence,
          assumptions: stock.assumptions,
          isFallback: Boolean(stock.isFallback)
        }
      };
    })
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.dividendScore !== a.dividendScore) return b.dividendScore - a.dividendScore;
      if (b.pricePotentialScore !== a.pricePotentialScore) return b.pricePotentialScore - a.pricePotentialScore;
      return a.debtToEbitda - b.debtToEbitda;
    });
}

function selectDiversifiedTopPicks(scored, limit = 5) {
  const picks = [];
  const sectorCounts = new Map();

  for (const stock of scored) {
    if (picks.length >= limit) break;
    const bucket = sectorBucket(stock.sector);
    const count = sectorCounts.get(bucket) || 0;

    if (count >= 2) continue;

    picks.push(stock);
    sectorCounts.set(bucket, count + 1);
  }

  // Backfill if diversification constraints prevented reaching limit.
  if (picks.length < limit) {
    for (const stock of scored) {
      if (picks.length >= limit) break;
      if (picks.some((pick) => pick.ticker === stock.ticker)) continue;
      picks.push(stock);
    }
  }

  return picks;
}

async function fetchUniverseStocks() {
  const now = Date.now();
  if (cache.universe && cache.universe.expiresAt > now) {
    return cache.universe.data;
  }

  const settled = await Promise.allSettled(DEFAULT_UNIVERSE.map((ticker) => fetchStockFundamentals(ticker)));
  const available = settled
    .filter((item) => item.status === "fulfilled")
    .map((item) => item.value)
    .filter((item) => item && Number.isFinite(item.marketPrice));

  if (!available.length) {
    throw new Error("Unable to load live stock universe right now.");
  }

  cache.universe = {
    data: available,
    expiresAt: now + CACHE_TTL_MS
  };

  return available;
}

function getSourceBreakdown(stocks) {
  const counts = {};
  for (const stock of stocks) {
    const key = stock.source || "Unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function createApp() {
  const app = express();

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true, service: "investment-tools-suite", asOf: new Date().toISOString() });
  });

  app.get("/api/stock/:ticker", async (req, res) => {
    try {
      const ticker = parseTicker(req.params.ticker);
      if (!ticker) {
        res.status(400).json({ error: "Invalid ticker format." });
        return;
      }
      const strictMode = parseStrictMode(req.query.strict);

      const [targetStock, universe] = await Promise.all([fetchStockFundamentals(ticker), fetchUniverseStocks()]);
      const combined = universe.some((stock) => stock.ticker === ticker) ? universe : [...universe, targetStock];
      const scored = scoreStocks(combined, { strictMode });
      const match = scored.find((stock) => stock.ticker === ticker);

      if (!match) {
        res.status(404).json({ error: `No market data found for ${ticker}.` });
        return;
      }

      const topAlternatives = selectDiversifiedTopPicks(scored.filter((stock) => stock.ticker !== ticker), 5);

      res.json({
        asOf: new Date().toISOString(),
        strictMode,
        weights: KPI_WEIGHTS,
        stock: match,
        topAlternatives,
        sourceBreakdown: getSourceBreakdown(combined)
      });
    } catch (error) {
      res.status(502).json({ error: error.message || "Failed to evaluate ticker." });
    }
  });

  app.get("/api/top-picks", async (_req, res) => {
    try {
      const strictMode = parseStrictMode(_req.query.strict);
      const universe = await fetchUniverseStocks();
      const scored = scoreStocks(universe, { strictMode });
      const topPicks = selectDiversifiedTopPicks(scored, 5);

      res.json({
        asOf: new Date().toISOString(),
        strictMode,
        source: "Live providers with fallback",
        sourceBreakdown: getSourceBreakdown(universe),
        topPicks
      });
    } catch (error) {
      res.status(502).json({ error: error.message || "Failed to load top picks." });
    }
  });

  app.get("/api/search", async (req, res) => {
    const assetClasses = normalizeAssetClassInput(String(req.query.assets || "stocks"));
    const tickers = resolveTickers(String(req.query.tickers || ""), assetClasses);
    const query = String(req.query.q || "").trim();
    const timeWindow = String(req.query.window || "all").toLowerCase();

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

      const filteredByQuery = applyQueryFilter(allResults, query);
      const filtered = applyTimeWindowFilter(filteredByQuery, timeWindow);
      const ranked = rankCatalystItems(filtered);

      res.json({
        asOf: new Date().toISOString(),
        tickers,
        assetClasses,
        timeWindow,
        query,
        count: Math.min(TOP_CATALYST_RESULTS, ranked.length),
        totalMatched: ranked.length,
        items: ranked.slice(0, TOP_CATALYST_RESULTS)
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to retrieve market catalyst content.",
        details: error.message
      });
    }
  });

  app.use(express.static(path.join(__dirname, "public")));

  app.get("/", (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  app.get("/retirement-planner", (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "retirement-planner", "index.html"));
  });

  app.get("/stock-evaluator", (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "stock-evaluator", "index.html"));
  });

  app.get("/stock-catalyst", (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "stock-catalyst", "index.html"));
  });

  app.get("*", (_req, res) => {
    res.redirect(302, "/");
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
      console.log(`Investment tools suite running at http://${host}:${activePort}`);
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
