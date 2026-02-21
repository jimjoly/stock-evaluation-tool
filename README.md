# Stock Investment Evaluator

Live stock evaluator that scores investments with KPI weighting:

- Dividend strength: 40%
- Upside potential: 35%
- Value quality: 25%

It returns a recommendation, the rationale for that recommendation, and top 5 ranked stocks.

## Run as web app

```bash
npm install
npm start
```

Open: `http://127.0.0.1:3000`

## Data providers and fallback

Provider order:

1. Yahoo Finance (no API key)
2. Financial Modeling Prep (`FMP_API_KEY` or `FINANCIAL_MODELING_PREP_API_KEY`)
3. Alpha Vantage (`ALPHA_VANTAGE_API_KEY`)

If Yahoo fails or rate limits, the app tries the next configured provider automatically.

Optional environment variables:

```bash
export FMP_API_KEY=your_fmp_key
export ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
```

## Run as desktop app (macOS)

```bash
npm install
npm run desktop
```

## Health check

`GET /healthz`

Returns JSON with service status and timestamp.
