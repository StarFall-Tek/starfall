import { useEffect, useRef, useState, type FormEvent } from 'react'
import { formatEt, formatPct, formatQty, formatUsd } from '../lib/format'
import { askScout, loadScoutDesk, scoutStatus, type ChatTurn, type ScoutDesk } from '../lib/scoutDesk'

const MAX_CHARS = 1000

function tone(v: number | null | undefined): string {
  if (v == null || v === 0) return ''
  return v > 0 ? 'up' : 'down'
}

function when(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : formatEt(d)
}

export function ScoutView() {
  const [desk, setDesk] = useState<ScoutDesk | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadScoutDesk()
      .then((d) => alive && setDesk(d))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'load failed'))
    return () => {
      alive = false
    }
  }, [])

  return (
    <section className="view scout" aria-labelledby="scout-title">
      <header className="view-header scout-head">
        <img src="/starfall-mark.png" alt="" width={48} height={48} className="brand-mark" />
        <div>
          <h1 id="scout-title" className="scout-title">
            Crypto Scout <span className="badge paper">PAPER</span>
          </h1>
          <p className="muted">LOEB House desk · paper book synced from the market-watch routine.</p>
          {desk && <p className="timestamp">Book as of {when(desk.as_of)} · synced {when(desk.generated_at)}</p>}
        </div>
      </header>

      {error && <article className="card notice">Couldn’t load the desk ({error}).</article>}
      {!desk && !error && <p className="muted">Loading the desk…</p>}

      {desk && (
        <>
          <div className="card-grid dense book-grid">
            <article className="card stat-card">
              <h2>Book value</h2>
              <p className="stat">{formatUsd(desk.book.equity_usd)}</p>
              <p className={`meta ${tone(desk.book.pnl_usd)}`}>
                vs {formatUsd(desk.book.start_usd)}:{' '}
                <span className={`chg-inline ${tone(desk.book.pnl_usd)}`}>
                  {desk.book.pnl_usd >= 0 ? '+' : ''}
                  {formatUsd(desk.book.pnl_usd)} ({formatPct(desk.book.pnl_pct)})
                </span>
              </p>
            </article>
            <article className="card stat-card">
              <h2>Cash</h2>
              <p className="stat">{formatUsd(desk.book.cash_usd)}</p>
              <p className="meta">
                Seats {desk.book.seats_used}/{desk.book.max_seats ?? '—'}
              </p>
            </article>
            <article className="card stat-card">
              <h2>Today</h2>
              <p className={`stat ${tone(desk.book.day_pnl_usd)}`}>
                {desk.book.day_pnl_usd == null ? '—' : formatUsd(desk.book.day_pnl_usd)}
              </p>
              <p className="meta">
                {desk.book.day_pnl_pct == null ? '' : formatPct(desk.book.day_pnl_pct)} · kill{' '}
                {desk.book.kill_level_usd == null ? '—' : formatUsd(desk.book.kill_level_usd)}{' '}
                {desk.book.daily_kill ? '· KILL ON' : '· off'}
              </p>
            </article>
          </div>

          <article className="card">
            <h2>Open seats</h2>
            {desk.positions.length === 0 ? (
              <p className="empty">No open seats — all cash.</p>
            ) : (
              <ul className="seat-list">
                {desk.positions.map((p) => (
                  <li key={p.symbol} className="scout-seat">
                    <div className="seat-top">
                      <strong>
                        {p.symbol} {p.role === 'anchor' && <span className="badge anchor">ANCHOR</span>}
                      </strong>
                      <span className={`chg ${tone(p.pnl_pct)}`}>
                        {p.pnl_pct == null ? '—' : formatPct(p.pnl_pct)}
                        <span className="chg-label">{p.pnl_usd == null ? '' : formatUsd(p.pnl_usd)}</span>
                      </span>
                    </div>
                    <dl className="kv">
                      <dt>Entry</dt>
                      <dd>{p.entry_usd == null ? '—' : formatUsd(p.entry_usd)}</dd>
                      <dt>Mark</dt>
                      <dd>{p.mark_usd == null ? '—' : formatUsd(p.mark_usd)}</dd>
                      <dt>Size</dt>
                      <dd>
                        {p.qty == null ? '—' : formatQty(p.qty)} · {p.notional_usd == null ? '—' : formatUsd(p.notional_usd)}
                      </dd>
                      <dt>Stop</dt>
                      <dd className="down">
                        {p.stop_loss_usd == null ? '—' : formatUsd(p.stop_loss_usd)}
                        {p.stop_loss_pct != null && ` (−${p.stop_loss_pct}%)`}
                        {p.trailing_active && ' · trailing'}
                      </dd>
                      <dt>Take profit</dt>
                      <dd className="up">
                        {p.take_profit_usd == null ? 'None (held)' : formatUsd(p.take_profit_usd)}
                        {p.take_profit_pct != null && ` (+${p.take_profit_pct}%)`}
                      </dd>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
            {desk.cooldowns.length > 0 && (
              <p className="meta">
                Cooldowns:{' '}
                {desk.cooldowns.map((c) => `${c.symbol} until ${when(c.until)} (${c.reason})`).join('; ')}
              </p>
            )}
            {desk.last_note && <p className="note muted">{desk.last_note}</p>}
          </article>

          <ScoutChat />

          <article className="card rules-card">
            <h2>The rules right now</h2>
            <ul className="scout-rules">
              {desk.rules.summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>

          <article className="card">
            <h2>
              Recent trades <span className="thin muted">({desk.trades.total} total)</span>
            </h2>
            <div className="journal-scroll">
              <ul className="journal scout-trades">
                {desk.trades.recent.map((t, i) => (
                  <li key={`${t.at}-${t.symbol}-${i}`}>
                    <span className={t.side === 'buy' ? 'side-buy' : 'side-sell'}>{t.side.toUpperCase()}</span>{' '}
                    <strong>{t.symbol}</strong> @ {t.price_usd == null ? '—' : formatUsd(t.price_usd)}
                    {t.notional_usd != null && ` · ${formatUsd(t.notional_usd)}`}
                    {t.pnl_pct != null && (
                      <span className={`chg-inline ${tone(t.pnl_pct)}`}> · {formatPct(t.pnl_pct)}</span>
                    )}
                    <span className="meta"> — {when(t.at)}</span>
                    {t.reason && <p className="meta">{t.reason}</p>}
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <article className="card">
            <h2>Scout’s journal</h2>
            <div className="journal-scroll">
              {desk.journal.map((j) => (
                <div key={j.at + j.title} className="scout-journal">
                  <p className="timestamp">
                    {j.label} — {j.title}
                  </p>
                  <ul className="risks">
                    {j.lines.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </article>

          <p className="meta">Paper only · live trading off · not financial advice.</p>
        </>
      )}
    </section>
  )
}

function ScoutChat() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scoutStatus().then(setConnected)
  }, [])
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [turns, busy])

  async function send(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim().slice(0, MAX_CHARS)
    if (!text || busy) return
    const history = turns
    setTurns([...history, { role: 'user', text }])
    setDraft('')
    setBusy(true)
    setErr(null)
    const res = await askScout(text, history)
    setBusy(false)
    if (res.notConnected) {
      setConnected(false)
      setTurns(history)
      return
    }
    if (!res.ok) {
      setErr(res.reply)
      return
    }
    setTurns((t) => [...t, { role: 'model', text: res.reply }])
  }

  return (
    <article className="card scout-chat" aria-label="Chat with Crypto Scout">
      <h2>Talk to Scout</h2>
      {connected === false ? (
        <p className="empty">
          Chat not connected yet — the Gemini key hasn’t been added to the site. The desk above still updates.
        </p>
      ) : (
        <>
          <div className="chat-log" aria-live="polite">
            {turns.length === 0 && (
              <p className="muted">Ask about the book, a seat, or why Scout sat in cash. Paper only.</p>
            )}
            {turns.map((t, i) => (
              <p key={i} className={`bubble ${t.role === 'user' ? 'me' : 'scout'}`}>
                {t.text}
              </p>
            ))}
            {busy && <p className="bubble scout typing">Scout is thinking…</p>}
            {err && <p className="notice">{err}</p>}
            <div ref={endRef} />
          </div>
          <form className="chat-form" onSubmit={send}>
            <textarea
              className="chat-input"
              value={draft}
              maxLength={MAX_CHARS}
              rows={2}
              placeholder="Message Crypto Scout…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(e as unknown as FormEvent)
                }
              }}
              disabled={busy || connected === null}
            />
            <button type="submit" className="btn primary" disabled={busy || !draft.trim()}>
              Send
            </button>
          </form>
          <p className="meta">Powered by Google Gemini · {draft.length}/{MAX_CHARS} · not financial advice.</p>
        </>
      )}
    </article>
  )
}
