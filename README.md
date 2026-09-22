# STARFALL

Paper-first crypto desk for **Christopher Loeb**.  
**Not financial advice.**

Mobile-first PWA: Vite + React + TypeScript. Demo digest, paper book, rooms radar, settings. No live trading. No API keys / secrets.

## Quick start

```bash
npm install
npm run dev          # local Vite dev server
npm run build        # production build → dist/
npm run preview      # preview the production build
```

## Add to Home Screen (PWA)

- **iOS Safari:** Share → *Add to Home Screen* → Add.  
  (iOS is picky: uses `apple-touch-icon`, `theme-color`, and `manifest.webmanifest`.)
- **Android Chrome:** Menu (⋮) → *Install app* or *Add to Home screen*.

After a Netlify (or any) deploy, do a **hard refresh** or open the app with a cache-buster query like `?v=2` so the service worker picks up the new shell. `sw.js` is served with `Cache-Control: must-revalidate` (see `netlify.toml`).

## What the desk does

- **Digest** — live USD prices from the public Coinbase Exchange ticker for the watchlist (15 names plus PEPE and SHIB), 24h change, as-of America/New_York. **Live watch** refreshes those public prices about every 20s while Digest or Paper is open, with a pause toggle. Theme lines are plain-English stubs. No news API. Price responses are network-only in the service worker.
- **Paper desk** — client-side paper ledger in `localStorage`. First visit seeds the saved book (cash and open seats). **Run rules** marks to market and paper-sells take-profit, stop, and daily-kill hits. **Analyze + attack** does that, then can open up to two $50 calm watchlist seats. **Quick in/out** (off by default) biases that attack toward rotating flat or dead seats into liquid movers and adds gut/quick-scalp **Bank early** and **Rotate** actions. The full TP target stays on the seat. **Movers radar** shows the day’s strongest and weakest liquid coins from the same public tape. Manual $50 buys stay on the watchlist. Rules stay locked: max $50, 5 seats, TP +8% (+10% BTC/ETH), SL −5%, daily kill −10% day P&L, 24h cooldown after a STOP only, one meme among DOGE/PEPE/SHIB. No live orders.
- **Rooms radar** — Curated Discord / Telegram / Reddit / X / TikTok list with signal-vs-noise tags + trust-radar checklist (static).
- **Settings** — PAPER badge, locked rules, `live_enabled` false, exchange Coinbase (NY), full watchlist, connect-accounts stub, **no API key fields**. Add-to-Home-Screen tip.

## What it does not do

- No live trading / order routing
- No exchange API keys or secrets
- No news feed (themes are stubs)
- No account linking yet  

## Deploy (Netlify)

`netlify.toml` builds with `npm run build`, publishes `dist/`, SPA-fallbacks to `index.html`, and sets Lucifer-style headers:

- `Cache-Control: must-revalidate` for `/*`, `/index.html`, `/sw.js`, `/manifest.webmanifest`
- `Service-Worker-Allowed: /` on `/sw.js`

## Stack notes

- PWA via `vite-plugin-pwa` → `sw.js` at site root, `registerSW` at boot  
- Navigation / HTML: **network-first**; static assets: **cache-first**; `/api/` and common price hosts: **network-only**  
- Dense card grids tuned for narrow folds (e.g. Galaxy Fold)

---

Footer everywhere: **Not financial advice.**
