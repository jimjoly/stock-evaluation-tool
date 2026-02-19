# Retirement Planner Web

Retirement planning website with a year-by-year projection model for savings accumulation and retirement drawdown.

## Features

- Input assumptions for age, savings, contributions, returns, inflation, and Social Security.
- Summary metrics for retirement balance, final balance, depletion age, and plan health.
- Balance-over-time chart and full projection table.
- Works as a web app and Electron desktop app.

## Run locally

```bash
npm install
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Publish to GitHub

```bash
git add .
git commit -m "Convert app to retirement planner website"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/retirement-planner-web.git
git push -u origin main
```

If `origin` already exists:

```bash
git remote set-url origin https://github.com/YOUR_USERNAME/retirement-planner-web.git
git push -u origin main
```

## Deploy to Render

1. Go to [Render](https://render.com) and click **New +** -> **Blueprint**.
2. Connect your GitHub repo.
3. Render will detect `render.yaml` and create the web service.
4. Deploy and open the generated URL.

Verify deployment:

- Health check: `https://YOUR-RENDER-URL/healthz`
- App: `https://YOUR-RENDER-URL/`

## Environment variables

- `PORT`: Set by Render.
- `HOST`: Optional (defaults to `0.0.0.0` in production).
