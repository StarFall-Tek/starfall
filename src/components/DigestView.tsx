import { LiveWatchBar } from './LiveWatchBar'
import { DIGEST_COPY } from '../data/digest'
import { WATCHLIST } from '../data/watchlist'
import { formatPct, formatUsd } from '../lib/format'
import { useMarketWatch } from '../lib/liveWatch'
import { useQuoteSnap } from '../lib/quoteStore'

export function DigestView() {
  useMarketWatch(WATCHLIST.map((item) => item.symbol))
  const snap = useQuoteSnap()

  return (
    <section className="view" aria-labelledby="digest-title">
      <header className="view-header">
        <h1 id="digest-title">Digest</h1>
        <p className="muted">
          Watchlist prices from the public Coinbase Exchange ticker. No API key. Theme lines
          are plain-English stubs — there is no news feed in this build.
        </p>
        <LiveWatchBar />
      </header>

      {snap.error && (
        <p className="notice warn" role="status">
          {snap.error}
        </p>
      )}

      <div className="card-grid dense">
        {WATCHLIST.map((item) => {
          const copy = DIGEST_COPY[item.symbol]
          const quote = snap.quotes[item.symbol]
          const change = quote?.change24hPct
          const up = (change ?? 0) >= 0
          return (
            <article key={item.symbol} className="card asset-card">
              <div className="card-top">
                <div>
                  <h2>
                    {item.symbol} <span className="muted thin">{item.name}</span>
                  </h2>
                  <p className="price">
                    {quote ? formatUsd(quote.priceUsd) : snap.loading ? 'Fetching…' : 'Unavailable'}
                  </p>
                </div>
                <p className={`chg ${change == null ? '' : up ? 'up' : 'down'}`}>
                  {change == null ? '—' : formatPct(change, 1)}
                  <span className="chg-label">24h · Coinbase</span>
                </p>
              </div>
              {copy && (
                <>
                  <p className="eli5">
                    <strong>Theme:</strong> {copy.theme}
                  </p>
                  <p className="eli5">
                    <strong>ELI5:</strong> {copy.eli5}
                  </p>
                  <ul className="risks">
                    {copy.risks.map((risk) => (
                      <li key={risk}>{risk}</li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
