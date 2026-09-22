import { DESK, RULE_ROWS } from '../data/deskConfig'
import { WATCHLIST } from '../data/watchlist'

export function SettingsView() {
  return (
    <section className="view" aria-labelledby="settings-title">
      <header className="view-header">
        <h1 id="settings-title">Settings</h1>
        <p className="muted">Paper-first desk. No API keys. No live keys stored.</p>
      </header>

      <div className="card-grid dense">
        <article className="card">
          <h2>
            Mode <span className="badge paper">PAPER</span>
          </h2>
          <p>
            Mode is {DESK.mode}. live_enabled is {String(DESK.liveEnabled)}. Exchange is{' '}
            {DESK.exchangeLabel}. Clock is {DESK.timezone}.
          </p>
        </article>

        <article className="card rules-card">
          <h2>
            Locked rules <span className="badge locked-badge">LOCKED</span>
          </h2>
          <ul className="rules">
            {RULE_ROWS.map((row) => (
              <li key={row.id}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </li>
            ))}
          </ul>
          <p className="note">
            Take-profit is +{DESK.takeProfitPct}% by default and +{DESK.takeProfitPctByAsset.BTC}% for BTC and ETH. Stops are −{DESK.stopLossPct}%.
            The 24h cooldown applies after a STOP only, not after a take-profit. Not financial
            advice.
          </p>
        </article>

        <article className="card">
          <h2>Watchlist</h2>
          <ul className="watchlist">
            {WATCHLIST.map((w) => (
              <li key={w.symbol}>
                <strong>{w.symbol}</strong> {w.name}
              </li>
            ))}
          </ul>
        </article>

        <article className="card locked">
          <h2>
            Live trading <span className="badge locked-badge">LOCKED</span>
          </h2>
          <p>
            live_enabled is false. Preferred venue is Coinbase (NY). This build does not route
            orders and does not ask for API keys.
          </p>
        </article>

        <article className="card stub">
          <h2>Connect accounts</h2>
          <p className="muted">Stub — coming later. No OAuth or API key fields.</p>
          <button type="button" className="btn ghost" disabled>
            Connect later
          </button>
        </article>

        <article className="card pwa-tip" role="note">
          <h2>Add to Home Screen</h2>
          <ul>
            <li>
              <strong>iOS Safari:</strong> Share → <em>Add to Home Screen</em> →
              Add.
            </li>
            <li>
              <strong>Android Chrome:</strong> Menu (⋮) → <em>Install app</em> or{' '}
              <em>Add to Home screen</em>.
            </li>
          </ul>
          <p className="muted tip-foot">
            After a deploy: hard-refresh or open with <code>?v=</code> so the
            service worker picks up the new shell (Lucifer/Netlify tip).
          </p>
        </article>
      </div>
    </section>
  )
}
