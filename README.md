# FINCRIME COMMAND v21 — LIVE

v20.2 was a static prototype (demo data). v21 is live:

- js/live.js       — live engine: 5 web-search jobs, 12h auto-sync, globe feed
- api/claude.js    — Vercel serverless proxy (REQUIRED for live data)
- FATF latest (all jurisdictions), Reuters/wires top-10 with Arabic,
  IQTFS Iraq sanctions top-10, USD/IQD official vs parallel, FATF
  black/grey lists with flags — all clickable, all with real source URLs.

## Deploy (Vercel required — GitHub Pages CANNOT run the api/ folder)
1. Push everything (index.html, css/, js/, api/) to the GitHub repo.
2. Vercel → project → Settings → Environment Variables:
   ANTHROPIC_API_KEY = sk-ant-...     (required)
   ACCESS_CODE       = team password  (optional; users asked once/session)
3. Every git commit redeploys automatically on the same URL.

## Update cycle
Data auto-refreshes every 12 hours per browser (localStorage cache).
SYNC NOW button forces a fresh sync. The chip in the header shows
last-sync age and time to next sync.
