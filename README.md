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

Then open `http://127.0.0.1:3000`.

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

## Host publicly (Render)

### 1. Push to GitHub

```bash
git add .
git commit -m "Prepare app for public hosting"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/market-catalyst-monitor.git
git push -u origin main
```

If `origin` already exists, use:

```bash
git remote set-url origin https://github.com/YOUR_USERNAME/market-catalyst-monitor.git
git push -u origin main
```

### 2. Deploy on Render

1. Go to [Render](https://render.com) and click **New +** -> **Blueprint**.
2. Select your GitHub repo.
3. Render will detect `render.yaml` and create the web service.
4. In service Environment settings, set `CONTACT_EMAIL` to a real email you control.
5. Deploy and open the generated public URL.

### 3. Verify deployment

- Health check: `https://YOUR-RENDER-URL/healthz`
- App: `https://YOUR-RENDER-URL/`

## Environment variables

- `PORT`: Port provided by hosting platform (Render sets this automatically).
- `HOST`: Optional; defaults to `0.0.0.0` in production and `127.0.0.1` locally.
- `CONTACT_EMAIL`: Email used in SEC `User-Agent` header (recommended for SEC API etiquette).

## Notes

- Impact scoring is heuristic keyword-based, not predictive advice.
- Content is republished as short summaries with source links (not full article text).
- The app is intended for research workflows, not autonomous trading decisions.
- Unsigned local builds may require allowing the app in macOS Security settings.
