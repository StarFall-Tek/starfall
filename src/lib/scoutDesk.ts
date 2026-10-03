export type ScoutPosition = {
  symbol: string
  role: string
  qty: number | null
  entry_usd: number | null
  mark_usd: number | null
  notional_usd: number | null
  mark_value_usd: number | null
  pnl_usd: number | null
  pnl_pct: number | null
  stop_loss_usd: number | null
  stop_loss_pct: number | null
  take_profit_usd: number | null
  take_profit_pct: number | null
  trailing_active: boolean
  high_water_usd: number | null
  opened_at: string | null
}

export type ScoutTrade = {
  at: string
  side: string
  symbol: string
  qty: number | null
  price_usd: number | null
  notional_usd: number | null
  reason: string
  pnl_pct: number | null
  proceeds_usd: number | null
}

export type ScoutJournal = { at: string; label: string; title: string; lines: string[] }

export type ScoutDesk = {
  generated_at: string
  as_of: string | null
  mode: string
  live_enabled: boolean
  book: {
    start_usd: number
    equity_usd: number
    cash_usd: number
    pnl_usd: number
    pnl_pct: number
    day_reference_usd: number | null
    day_pnl_usd: number | null
    day_pnl_pct: number | null
    kill_level_usd: number | null
    daily_kill: boolean
    seats_used: number
    max_seats: number | null
  }
  positions: ScoutPosition[]
  cooldowns: { symbol: string; until: string | null; reason: string }[]
  last_note: string | null
  trades: { total: number; recent: ScoutTrade[] }
  journal: ScoutJournal[]
  rules: { summary: string[]; changed_note: string | null }
}

export async function loadScoutDesk(): Promise<ScoutDesk> {
  const res = await fetch(`/scout/desk.json?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`desk.json ${res.status}`)
  return (await res.json()) as ScoutDesk
}

export type ChatTurn = { role: 'user' | 'model'; text: string }

export async function scoutStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/scout-chat', { cache: 'no-store' })
    if (!res.ok) return false
    const data = (await res.json()) as { connected?: boolean }
    return Boolean(data.connected)
  } catch {
    return false
  }
}

export async function askScout(message: string, history: ChatTurn[]): Promise<{ reply: string; ok: boolean; notConnected?: boolean }> {
  try {
    const res = await fetch('/api/scout-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, history: history.slice(-10) }),
    })
    const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string }
    if (data.error === 'not_connected') return { ok: false, notConnected: true, reply: data.reply ?? '' }
    if (!res.ok) return { ok: false, reply: data.reply ?? `Scout hit an error (${res.status}). Try again.` }
    return { ok: true, reply: data.reply ?? '' }
  } catch {
    return { ok: false, reply: 'Can’t reach Scout — check your connection.' }
  }
}
