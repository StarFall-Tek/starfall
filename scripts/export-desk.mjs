#!/usr/bin/env node
// Export the Crypto Scout paper book into public/scout/desk.json.
// READ-ONLY on the source folder: it never writes there and never opens baseline-snapshot.json.
// Usage: node scripts/export-desk.mjs [--src <crypto-bot dir>] [--out <file>]
// Env: SCOUT_SRC overrides the source folder.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '..')
const DEFAULT_SRC =
  '/home/box/agent-data/agents/5baea803-aae7-4de5-8808-b7ee7d28014a/memory/crypto-bot'

function arg(name) {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : undefined
}
const SRC = arg('--src') || process.env.SCOUT_SRC || DEFAULT_SRC
const OUT = path.resolve(arg('--out') || path.join(repo, 'public/scout/desk.json'))
const TRADES_N = 15
const JOURNAL_N = 6

function read(name, { optional = false } = {}) {
  if (name === 'baseline-snapshot.json') throw new Error('baseline-snapshot.json is off limits')
  const p = path.join(SRC, name)
  if (!fs.existsSync(p)) {
    if (optional) return null
    throw new Error(`Missing source file: ${p}`)
  }
  return fs.readFileSync(p, 'utf8')
}
const readJson = (n, o) => {
  const t = read(n, o)
  return t == null ? null : JSON.parse(t)
}
const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v))
const r = (v, d = 2) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d)

// --- tiny CSV parser (quoted fields, commas, doubled quotes) ---
function parseCsv(text) {
  const rows = []
  let row = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') q = false
      else field += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((x) => x !== '')) rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((x) => x !== '')) rows.push(row) }
  return rows
}

// "2026-09-14 12:22 EDT" or ISO with offset -> ISO string
function toIso(s) {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) (EDT|EST)$/.exec(s.trim())
  if (m) return new Date(`${m[1]}T${m[2]}:00${m[3] === 'EDT' ? '-04:00' : '-05:00'}`).toISOString()
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : d.toISOString()
}

function trades() {
  const rows = parseCsv(read('paper-trades.csv'))
  const out = []
  for (const x of rows.slice(1)) {
    // Two layouts live in this file:
    //  7 cols: date,side,asset,qty,price_usd,reason,mode
    // 11 cols: date,side,asset,qty,price_usd,notional_usd,reason,mode,id,pnl_pct,proceeds_usd
    const long = x.length >= 11
    const qty = num(x[3]), price = num(x[4])
    out.push({
      at: toIso(x[0]),
      side: x[1],
      symbol: x[2],
      qty,
      price_usd: price,
      notional_usd: long ? num(x[5]) : r(qty != null && price != null ? qty * price : null),
      reason: (long ? x[6] : x[5]) || '',
      mode: (long ? x[7] : x[6]) || 'paper',
      pnl_pct: long ? num(x[9]) : null,
      proceeds_usd: long ? num(x[10]) : null,
    })
  }
  out.sort((a, b) => (a.at < b.at ? 1 : -1))
  return { total: out.length, recent: out.slice(0, TRADES_N) }
}

// Journal is not strictly ordered (some runs prepend, others append), so sort by heading time.
function journal() {
  const text = read('journal.md', { optional: true }) || ''
  const lines = text.split(/\r?\n/)
  const head = /^#{2,3}\s+(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*ET\b\s*[—–-]?\s*(.*)$/
  const entries = []
  let cur = null
  for (const line of lines) {
    const m = head.exec(line)
    if (m) {
      if (cur) entries.push(cur)
      const [, day, hh, mm, title] = m
      // ET offset: EDT (-04:00) Mar–early Nov is good enough for this desk's dates; refine via Intl.
      const guess = new Date(`${day}T${hh.padStart(2, '0')}:${mm}:00-04:00`)
      const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' })
        .formatToParts(guess).find((p) => p.type === 'timeZoneName')?.value
      const off = offset === 'GMT-5' ? '-05:00' : '-04:00'
      cur = { at: new Date(`${day}T${hh.padStart(2, '0')}:${mm}:00${off}`).toISOString(), label: `${day} ${hh.padStart(2, '0')}:${mm} ET`, title: title.trim(), lines: [] }
    } else if (cur && line.trim()) {
      cur.lines.push(line.replace(/^\s*[-*]\s+/, '').replace(/\*\*/g, '').trim())
    } else if (/^#{1,3}\s/.test(line) && cur) {
      entries.push(cur); cur = null
    }
  }
  if (cur) entries.push(cur)
  entries.sort((a, b) => (a.at < b.at ? 1 : -1))
  return entries.slice(0, JOURNAL_N).map((e) => ({ ...e, lines: e.lines.slice(0, 12).map((l) => l.slice(0, 400)) }))
}

function rules(cfg) {
  const f = cfg.fast_money || {}
  const band = f.entry_filter?.chg_vs_24h_open_pct || [3, 12]
  const a = f.btc_anchor || {}
  return {
    mode: cfg.strategy_mode || 'fast_money',
    params: {
      take_profit_pct: f.take_profit_pct ?? cfg.take_profit_pct,
      trail_arm_pct: f.trail_arm_pct,
      trail_pct: f.trail_pct,
      hard_stop_pct: f.hard_stop_pct ?? cfg.stop_loss_pct,
      entry_band_pct: band,
      proven_hold_hours: 2,
      daily_kill_pct: f.daily_kill_pct ?? cfg.daily_loss_kill_pct,
      btc_anchor_stop_pct: a.hard_stop_pct,
      btc_anchor_take_profit: a.take_profit ?? null,
      seat_usd: f.seat_usd,
      best_seat_usd: f.best_seat_usd,
      max_seats: f.max_seats ?? cfg.max_open_positions,
      time_stop_hours: f.time_stop_hours,
      time_stop_flat_band_pct: f.time_stop_flat_band_pct,
      cooldown_hours_after_stop: f.reentry_cooldown_hours_after_stop ?? cfg.cooldown_hours_after_stop,
      min_24h_usd_volume: f.entry_filter?.min_24h_usd_volume,
    },
    summary: [
      `Take profit at +${f.take_profit_pct}% on every fast seat.`,
      `Trailing stop arms at +${f.trail_arm_pct}% and then trails ${f.trail_pct}% below the high.`,
      `Hard stop at −${f.hard_stop_pct}% from entry.`,
      `Only buy coins up ${band[0]}–${band[1]}% vs the 24h open that have held that band for 2 hours (proven hold), with rising volume and >$${Math.round((f.entry_filter?.min_24h_usd_volume || 2e7) / 1e6)}M 24h volume.`,
      `Daily kill: stop for the day if the book is down ${f.daily_kill_pct}%.`,
      `BTC anchor: one held seat, −${a.hard_stop_pct}% stop, no take profit, exempt from the time stop.`,
      `$${f.seat_usd} seats ($${f.best_seat_usd} for the single best idea), ${f.max_seats} seats max, never add to a loser.`,
      `Time stop: cut a seat still flat (±${f.time_stop_flat_band_pct}%) after ${f.time_stop_hours}h. ${f.reentry_cooldown_hours_after_stop}h cooldown after a stop; no same-day re-entry.`,
      'Flat before the overnight gap: fast seats sold at the 8:25 PM ET run; no new fast entries after 7:30 PM ET.',
      `Paper only. Live needs the exact phrase "${cfg.live_phrase_required || 'go live STARFALL'}". Not financial advice.`,
    ],
    changed_note: cfg.take_profit_note || null,
  }
}

function main() {
  const cfg = readJson('config.json')
  const open = readJson('open-positions.json')
  const snap = readJson('last-snapshot.json', { optional: true }) || {}
  read('rules.md') // must exist; summary is derived from config + rules.md content
  const prices = snap.prices || {}
  const snapPos = Object.fromEntries((snap.positions || []).map((p) => [p.symbol, p]))
  const start = num(open.paper_balance_usd ?? cfg.paper_balance_usd) ?? 10000
  const cash = num(open.cash_remaining_usd) ?? 0

  const positions = (open.positions || []).map((p) => {
    const s = snapPos[p.symbol] || {}
    const mark = num(s.mark_usd) ?? num(prices[p.symbol]) ?? null
    const qty = num(p.qty)
    const value = mark != null && qty != null ? mark * qty : num(p.notional_usd)
    const pnlUsd = value != null ? value - num(p.notional_usd) : null
    const tpPct = num(p.take_profit_pct)
    return {
      symbol: p.symbol,
      role: p.role || 'fast',
      side: p.side || 'long',
      qty,
      entry_usd: num(p.entry_usd),
      mark_usd: mark,
      notional_usd: num(p.notional_usd),
      mark_value_usd: r(value, 4),
      pnl_usd: r(pnlUsd, 4),
      pnl_pct: mark != null ? r(((mark - p.entry_usd) / p.entry_usd) * 100, 3) : null,
      stop_loss_usd: num(p.stop_loss_usd),
      stop_loss_pct: num(p.stop_loss_pct),
      take_profit_usd: num(p.take_profit_usd),
      take_profit_pct: tpPct,
      trailing_active: !!p.trailing_active,
      high_water_usd: num(p.high_water_usd),
      opened_at: p.opened_at ? new Date(p.opened_at).toISOString() : null,
    }
  })
  const invested = positions.reduce((t, p) => t + (p.mark_value_usd ?? 0), 0)
  const equity = num(snap.equity_usd) ?? r(cash + invested, 4)
  const day = open.day_reference || {}

  const desk = {
    schema: 1,
    generated_at: new Date().toISOString(),
    as_of: snap.as_of ? new Date(snap.as_of).toISOString() : open.as_of ? new Date(open.as_of).toISOString() : null,
    persona: 'Crypto Scout',
    desk: 'LOEB House',
    mode: cfg.mode || 'paper',
    live_enabled: !!cfg.live_enabled,
    exchange: cfg.exchange,
    not_financial_advice: true,
    book: {
      start_usd: start,
      equity_usd: r(equity, 2),
      cash_usd: r(cash, 2),
      pnl_usd: r(equity - start, 2),
      pnl_pct: r(((equity - start) / start) * 100, 2),
      day_reference_usd: r(num(snap.day_reference_usd ?? day.reference_usd), 2),
      day_pnl_usd: r(num(snap.day_pnl_usd), 2),
      day_pnl_pct: num(snap.day_pnl_pct),
      kill_level_usd: r(num(day.kill_level_usd), 2),
      daily_kill: !!(snap.daily_kill ?? day.kill_active),
      seats_used: positions.length,
      max_seats: num(open.max_open_positions ?? cfg.max_open_positions),
    },
    positions,
    cooldowns: Object.entries(open.cooldowns || {}).map(([symbol, c]) => ({ symbol, until: c.until ? new Date(c.until).toISOString() : null, reason: c.reason || '' })),
    last_note: snap.note || open.last_mark?.note || null,
    scan_near: (snap.scan?.near || []).slice(0, 5),
    trades: trades(),
    journal: journal(),
    rules: rules(cfg),
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(desk, null, 2) + '\n')
  console.log(`desk.json written: ${path.relative(process.cwd(), OUT) || OUT} (equity $${desk.book.equity_usd}, ${positions.length} seat(s), ${desk.trades.recent.length} trades, ${desk.journal.length} journal entries)`)
}

main()
