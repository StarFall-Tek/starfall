import { useState } from 'react'
import { LiveWatchBar } from './LiveWatchBar'
import { RULE_ROWS } from '../data/deskConfig'
import { WATCHLIST } from '../data/watchlist'
import { formatEt, formatPct, formatQty, formatUsd } from '../lib/format'
import { autoRotateTarget, bankEarlyBlock, liquidTape } from '../lib/paperEngine'
import { setQuickScalpEnabled, useQuickScalp } from '../lib/quickMode'
import { usePaperBook } from '../lib/usePaperBook'

function coinName(symbol: string): string {
  return WATCHLIST.find((item) => item.symbol === symbol)?.name ?? symbol
}

export function PaperDeskView() {
  const {
    book,
    marked,
    quotes,
    busy,
    notice,
    cooldowns,
    entryBlock,
    runRules,
    analyzeAndAttack,
    buyManual,
    bankEarly,
    rotateSeat,
    quickSeat,
  } = usePaperBook()
  const quick = useQuickScalp()
  const [symbol, setSymbol] = useState('XRP')
  const block = entryBlock(symbol)
  const hardBlock = block != null && block.code !== 'price'
  const priceMissing = block?.code === 'price' && quotes.fetchedAt != null && !quotes.loading
  const { summary } = marked
  const dayUp = (summary.dayPnlPct ?? 0) >= 0
  const tape = liquidTape(quotes.quotes)
  const tapeReady = tape.strongest.length > 0 || tape.weakest.length > 0
  const now = new Date()

  return (
    <section className="view" aria-labelledby="paper-title" aria-busy={busy}>
      <header className="view-header">
        <h1 id="paper-title">
          Paper desk <span className="badge paper">PAPER</span>
        </h1>
        <p className="muted">
          $1,000 paper book. Cash below is what is not in a seat. Live trading stays off —
          these buttons only update the paper ledger.
        </p>
        <LiveWatchBar />
      </header>

      {book.killActive && (
        <article className="card warn-banner" role="status">
          <h2>Daily kill is on</h2>
          <p>
            Day P&amp;L hit −10%. New paper entries are paused until the next ET day.
            Live trading is still off.
          </p>
        </article>
      )}

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {quotes.error && (
        <p className="notice warn" role="status">
          {quotes.error}
        </p>
      )}

      <article className={`card mode-card ${quick ? 'on' : ''}`}>
        <div className="mode-head">
          <h2>
            Quick in/out <span className="badge example">GUT / QUICK-SCALP</span>
          </h2>
          <button
            type="button"
            className={`btn tiny ${quick ? 'gold' : ''}`}
            aria-pressed={quick}
            onClick={() => setQuickScalpEnabled(!quick)}
          >
            {quick ? 'On' : 'Off'}
          </button>
        </div>
        <p className="muted">
          When on, Analyze + attack can rotate flat or dead seats into liquid movers before
          the full +8% / +10% take-profit, and each seat can bank early. Stops stay −5%. $50,
          5 seats, and the −10% daily kill stay locked. Paper only.
        </p>
      </article>

      <div className="action-bar">
        <button type="button" className="btn primary" onClick={() => void runRules()} disabled={busy}>
          {busy ? 'Working…' : 'Run rules'}
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={() => void analyzeAndAttack()}
          disabled={busy}
        >
          Analyze + attack
        </button>
      </div>
      <p className="muted action-help">
        {quick
          ? 'Quick in/out is on. Run rules still paper-sells the full take-profit, the −5% stop, and the daily kill. Analyze + attack does that, then can rotate up to two flat or dead seats into liquid movers and fill a free seat with a mover. A seat up about +1% or better stays on its TP unless you bank early.'
          : 'Run rules fetches Coinbase prices, paper-sells take-profit, stop, and daily-kill hits, then refreshes marks. Analyze + attack does that, then opens up to two calm watchlist seats ($50 each) when a seat and cash are free. Parabolic day spikes are skipped when a calmer name is available. One meme seat max.'}
      </p>

      <article className="card movers-card">
        <h2>Movers radar</h2>
        <p className="muted">
          Day’s strongest and weakest liquid coins from the public Coinbase 24h change. Memes
          stay off this tape. Paper only — pick a rotate without leaving the desk.
        </p>
        {!tapeReady && (
          <p className="empty">
            {quotes.loading || !quotes.fetchedAt
              ? 'Waiting for Coinbase 24h stats…'
              : 'No liquid 24h change yet.'}
          </p>
        )}
        {tapeReady && (
          <div className="tape-grid">
            <div>
              <h3 className="tape-label">Strongest</h3>
              <ul className="mover-list">
                {tape.strongest.map((row) => {
                  const held = book.positions.some((position) => position.symbol === row.symbol)
                  const rowBlock = entryBlock(row.symbol)
                  const canOpen = quick && rowBlock == null
                  const canRotate = quick && !held && rowBlock?.code === 'seats'
                  const disabled = busy || (!canOpen && !canRotate)
                  const label = canRotate ? 'Rotate in' : 'Quick seat'
                  const title = !quick
                    ? 'Turn on quick in/out'
                    : held
                      ? `${row.symbol} already has an open paper seat.`
                      : canOpen
                        ? `Paper $50 ${row.symbol}`
                        : canRotate
                          ? `Rotate the flattest seat into ${row.symbol}`
                          : (rowBlock?.message ?? 'Unavailable')
                  return (
                    <li key={row.symbol} className="mover-row">
                      <div className="mover-main">
                        <strong>{row.symbol}</strong>{' '}
                        <span className="muted thin">{coinName(row.symbol)}</span>
                        <span className="meta mover-px">{formatUsd(row.priceUsd)}</span>
                      </div>
                      <span className={`mover-chg ${row.change24hPct >= 0 ? 'up' : 'down'}`}>
                        {formatPct(row.change24hPct, 1)}
                      </span>
                      <button
                        type="button"
                        className="btn tiny"
                        disabled={disabled}
                        title={title}
                        onClick={() => void quickSeat(row.symbol)}
                      >
                        {label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
            {tape.weakest.length > 0 && (
            <div>
              <h3 className="tape-label">Weakest</h3>
              <ul className="mover-list">
                {tape.weakest.map((row) => (
                  <li key={row.symbol} className="mover-row">
                    <div className="mover-main">
                      <strong>{row.symbol}</strong>{' '}
                      <span className="muted thin">{coinName(row.symbol)}</span>
                      <span className="meta mover-px">{formatUsd(row.priceUsd)}</span>
                    </div>
                    <span className={`mover-chg ${row.change24hPct >= 0 ? 'up' : 'down'}`}>
                      {formatPct(row.change24hPct, 1)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            )}
          </div>
        )}
      </article>

      <div className="card-grid dense book-grid">
        <article className="card stat-card">
          <h2>Cash</h2>
          <p className="stat">{formatUsd(summary.cashUsd)}</p>
        </article>
        <article className="card stat-card">
          <h2>Book mark</h2>
          <p className="stat">{formatUsd(summary.bookMarkUsd)}</p>
          {!summary.marksComplete && book.positions.length > 0 && (
            <p className="meta">Partial — a live price is still missing</p>
          )}
        </article>
        <article className="card stat-card">
          <h2>Seats</h2>
          <p className="stat">
            {summary.seatsUsed} / {summary.seatsMax}
          </p>
        </article>
        <article className="card stat-card">
          <h2>Day P&amp;L</h2>
          <p className={`stat ${summary.dayPnlPct == null ? '' : dayUp ? 'up' : 'down'}`}>
            {summary.dayPnlPct == null ? '—' : formatPct(summary.dayPnlPct)}
          </p>
          {summary.dayPnlUsd != null && (
            <p className="meta">{formatUsd(summary.dayPnlUsd)}</p>
          )}
        </article>
      </div>

      <article className="card">
        <h2>Open seats</h2>
        {marked.positions.length === 0 ? (
          <p className="empty">No open positions — book is clean.</p>
        ) : (
          <ul className="seat-list">
            {marked.positions.map((position) => {
              const up = (position.pnlPct ?? 0) >= 0
              const bankBlock = bankEarlyBlock(position, quotes.quotes)
              const mover =
                position.liveUsd == null
                  ? null
                  : autoRotateTarget(book, position, quotes.quotes, now)
              return (
                <li key={position.id} className="seat">
                  <div className="seat-top">
                    <h3>
                      {position.symbol} <span className="muted thin">long</span>
                    </h3>
                    <span className="badge paper">PAPER</span>
                    {position.meme && <span className="badge example">MEME</span>}
                  </div>
                  <dl className="kv">
                    <div>
                      <dt>Entry</dt>
                      <dd>{formatUsd(position.entryUsd)}</dd>
                    </div>
                    <div>
                      <dt>Live</dt>
                      <dd>{position.liveUsd == null ? '—' : formatUsd(position.liveUsd)}</dd>
                    </div>
                    <div>
                      <dt>P&amp;L</dt>
                      <dd className={position.pnlPct == null ? '' : up ? 'up' : 'down'}>
                        {position.pnlPct == null ? '—' : formatPct(position.pnlPct)}
                      </dd>
                    </div>
                    <div>
                      <dt>TP</dt>
                      <dd>
                        {formatUsd(position.takeProfitUsd)} ({formatPct(position.takeProfitPct, 0)})
                      </dd>
                    </div>
                    <div>
                      <dt>SL</dt>
                      <dd>{formatUsd(position.stopLossUsd)} (−5%)</dd>
                    </div>
                  </dl>
                  <p className="meta">
                    {formatQty(position.qty)} {position.symbol} · {formatUsd(position.notionalUsd)} risk ·{' '}
                    {formatEt(new Date(position.openedAt))}
                  </p>
                  <p className="note">{position.reason}</p>
                  {quick && (
                    <div className="seat-actions">
                      <button
                        type="button"
                        className="btn tiny gold"
                        disabled={busy || bankBlock != null}
                        title={bankBlock ?? 'Paper-sell now. The full TP stays the rule target.'}
                        onClick={() => void bankEarly(position.id)}
                      >
                        Bank early · gut
                      </button>
                      <button
                        type="button"
                        className="btn tiny"
                        disabled={busy || mover == null}
                        title={
                          mover
                            ? `Rotate this flat seat into ${mover}`
                            : 'Rotate waits for a flat or dead seat and a stronger liquid mover.'
                        }
                        onClick={() => void rotateSeat(position.id)}
                      >
                        {mover ? `Rotate → ${mover} · quick-scalp` : 'Rotate · quick-scalp'}
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </article>

      <article className="card">
        <h2>Manual $50 buy</h2>
        <p className="muted">
          Watchlist only. Rules run first so a stop or kill is not ignored. Still paper.
        </p>
        <div className="buy-row">
          <label className="field">
            <span>Symbol</span>
            <select
              className="select"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
            >
              {WATCHLIST.map((item) => (
                <option key={item.symbol} value={item.symbol}>
                  {item.symbol} — {item.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn"
            disabled={busy || hardBlock}
            onClick={() => void buyManual(symbol)}
          >
            Buy $50 paper
          </button>
        </div>
        {hardBlock && (
          <p className="note" role="status">
            {block.message}
          </p>
        )}
        {priceMissing && (
          <p className="note" role="status">
            {block.message}
          </p>
        )}
      </article>

      {cooldowns.length > 0 && (
        <article className="card">
          <h2>Cooldowns after stops</h2>
          <ul className="watchlist">
            {cooldowns.map((row) => (
              <li key={row.symbol}>
                <strong>{row.symbol}</strong> until {formatEt(new Date(row.until))}
              </li>
            ))}
          </ul>
        </article>
      )}

      <article className="card">
        <h2>Trade journal</h2>
        {book.journal.length === 0 ? (
          <p className="empty">No paper fills yet.</p>
        ) : (
          <div className="journal-scroll">
            <ul className="journal">
              {[...book.journal].reverse().map((entry) => (
                <li key={entry.id}>
                  <span className={entry.side === 'buy' ? 'side-buy' : 'side-sell'}>
                    {entry.side.toUpperCase()}
                  </span>
                  <span>
                    <strong>{entry.symbol}</strong> · {formatUsd(entry.priceUsd)}
                  </span>
                  <span className="meta">{formatEt(new Date(entry.at))}</span>
                  <span className="reason">{entry.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>

      <article className="card rules-card">
        <h2>Desk rules</h2>
        <ul className="rules">
          {RULE_ROWS.map((row) => (
            <li key={row.id}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </li>
          ))}
        </ul>
      </article>
    </section>
  )
}
