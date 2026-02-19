# Market Catalyst Monitor

A lightweight website that searches financial catalyst content and republishes concise summaries with estimated price-direction impact:

- `Likely Upward`
- `Likely Downward`
- `Unclear / Mixed`

Sources currently included:

- Yahoo Finance RSS headlines per ticker
- SEC recent filings per ticker

## Run as web app

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Run as desktop app (macOS)

```bash
npm install
npm run desktop
```

## Build a macOS executable

```bash
npm install
npm run dist:mac
```

Build artifacts will be generated in `dist/`:

- `Market Catalyst Monitor.app`
- `Market Catalyst Monitor-<version>.dmg`

## Notes

- Impact scoring is heuristic keyword-based, not predictive advice.
- Content is republished as short summaries with source links (not full article text).
- The app is intended for research workflows, not autonomous trading decisions.
- Unsigned local builds may require allowing the app in macOS Security settings.
