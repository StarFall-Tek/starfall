import { DESK, isMemeSymbol, takeProfitPctFor } from '../data/deskConfig'
import { WATCHLIST_SYMBOLS } from '../data/watchlist'
import { etDayKey, formatPct, formatUsd, roundCash } from './format'
import type { Quote, Quotes } from './prices'

export type PaperPosition = {
  id: string
  symbol: string
  side: 'long'
  qty: number
  notionalUsd: number
  entryUsd: number
  takeProfitUsd: number
  stopLossUsd: number
  takeProfitPct: number
  openedAt: string
  reason: string
  mode: 'paper'
  meme: boolean
}

export type JournalEntry = {
  id: string
  at: string
  side: 'buy' | 'sell'
  symbol: string
  qty: number
  priceUsd: number
  notionalUsd: number
  reason: string
  mode: 'paper'
  chgPct?: number
}

export type PaperBook = {
  version: 1
  cashUsd: number
  positions: PaperPosition[]
  journal: JournalEntry[]
  /** Symbol -> ISO time when a post-stop cooldown ends. */
  cooldowns: Record<string, string>
  /** ET calendar day YYYY-MM-DD that dayStartEquityUsd belongs to. */
  dayKey: string
  dayStartEquityUsd: number | null
  /** Set when day P&L hits the kill. Cleared on the next ET day. */
  killActive: boolean
  updatedAt: string
}

export type CloseKind = 'take_profit' | 'stop_loss' | 'daily_kill'

export type CloseAction = {
  kind: CloseKind
  symbol: string
  qty: number
  entryUsd: number
  exitUsd: number
  proceedsUsd: number
  chgPct: number
  reason: string
}

export type MarkedPosition = PaperPosition & {
  liveUsd: number | null
  markUsd: number | null
  pnlUsd: number | null
  pnlPct: number | null
}

export type BookSummary = {
  cashUsd: number
  bookMarkUsd: number
  seatsUsed: number
  seatsMax: number
  dayPnlUsd: number | null
  dayPnlPct: number | null
  marksComplete: boolean
}

export type EntryBlockCode =
  | 'live'
  | 'watchlist'
  | 'kill'
  | 'seats'
  | 'held'
  | 'cooldown'
  | 'meme'
  | 'cash'
  | 'price'

export type EntryBlock = { code: EntryBlockCode; message: string }

let idSeq = 0

/** Round a level for display and rule checks so 100 * 1.1 does not become 110.00000000000001. */
function roundPx(value: number): number {
  const abs = Math.abs(value)
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 6 : 10
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function nextId(prefix: string): string {
  idSeq += 1
  return `${prefix}-${Date.now().toString(36)}-${idSeq}`
}

export function cooldownUntil(book: PaperBook, symbol: string, now: Date): string | null {
  const until = book.cooldowns[symbol]
  if (!until) return null
  const ends = new Date(until).getTime()
  if (!Number.isFinite(ends) || ends <= now.getTime()) return null
  return until
}

export function listCooldowns(
  book: PaperBook,
  now = new Date(),
): { symbol: string; until: string }[] {
  return Object.keys(book.cooldowns)
    .map((symbol) => ({ symbol, until: cooldownUntil(book, symbol, now) }))
    .filter((row): row is { symbol: string; until: string } => row.until != null)
    .sort((a, b) => a.until.localeCompare(b.until))
}

/** Roll the ET day and snapshot day-start equity once marks are complete. */
export function withDayRoll(book: PaperBook, markedEquity: number | null, now: Date): PaperBook {
  const key = etDayKey(now)
  if (book.dayKey !== key) {
    return {
      ...book,
      dayKey: key,
      dayStartEquityUsd: markedEquity,
      killActive: false,
      updatedAt: now.toISOString(),
    }
  }
  if (book.dayStartEquityUsd == null && markedEquity != null) {
    return {
      ...book,
      dayStartEquityUsd: markedEquity,
      updatedAt: now.toISOString(),
    }
  }
  return book
}

export function equityOf(
  book: PaperBook,
  quotes: Quotes,
): { equity: number; complete: boolean } {
  let complete = true
  let seats = 0
  for (const position of book.positions) {
    const price = quotes[position.symbol]?.priceUsd
    if (!(price > 0)) {
      complete = false
      seats += position.notionalUsd
    } else {
      seats += position.qty * price
    }
  }
  return { equity: book.cashUsd + seats, complete }
}

export function dayPnl(
  book: PaperBook,
  equity: number,
): { usd: number; pct: number } | null {
  const start = book.dayStartEquityUsd
  if (start == null || !(start > 0)) return null
  const usd = equity - start
  return { usd, pct: (usd / start) * 100 }
}

export function isDailyKill(dayStartEquityUsd: number, equity: number): boolean {
  if (!(dayStartEquityUsd > 0)) return false
  const loss = dayStartEquityUsd - equity
  const limit = dayStartEquityUsd * (DESK.dailyLossKillPct / 100)
  return loss + 1e-6 >= limit
}

export function markBook(
  book: PaperBook,
  quotes: Quotes,
): { positions: MarkedPosition[]; summary: BookSummary } {
  const positions: MarkedPosition[] = book.positions.map((position) => {
    const live = quotes[position.symbol]?.priceUsd
    const liveUsd = live > 0 ? live : null
    const markUsd = liveUsd == null ? null : position.qty * liveUsd
    const pnlUsd = markUsd == null ? null : markUsd - position.notionalUsd
    const pnlPct =
      liveUsd == null ? null : ((liveUsd - position.entryUsd) / position.entryUsd) * 100
    return { ...position, liveUsd, markUsd, pnlUsd, pnlPct }
  })
  const marksComplete = positions.every((position) => position.liveUsd != null)
  const seatsValue = positions.reduce(
    (sum, position) => sum + (position.markUsd ?? position.notionalUsd),
    0,
  )
  const bookMarkUsd = book.cashUsd + seatsValue
  const pnl = dayPnl(book, bookMarkUsd)
  return {
    positions,
    summary: {
      cashUsd: book.cashUsd,
      bookMarkUsd,
      seatsUsed: book.positions.length,
      seatsMax: DESK.maxOpenPositions,
      dayPnlUsd: pnl?.usd ?? null,
      dayPnlPct: pnl?.pct ?? null,
      marksComplete,
    },
  }
}

function closeReason(
  kind: CloseKind,
  position: PaperPosition,
  exitUsd: number,
  chgPct: number,
): string {
  const at = formatUsd(exitUsd)
  const entry = formatUsd(position.entryUsd)
  const chg = formatPct(chgPct)
  if (kind === 'take_profit') {
    return `Paper TAKE-PROFIT +${position.takeProfitPct}% rule @ ${at} (entry ${entry}; ${chg})`
  }
  if (kind === 'stop_loss') {
    return `Paper STOP −${DESK.stopLossPct}% rule @ ${at} (entry ${entry}; ${chg})`
  }
  return `Paper daily kill −${DESK.dailyLossKillPct}% day P&L @ ${at} (entry ${entry}; ${chg})`
}

function closePosition(
  book: PaperBook,
  position: PaperPosition,
  exitUsd: number,
  kind: CloseKind,
  now: Date,
): { book: PaperBook; action: CloseAction } {
  const proceedsUsd = roundCash(position.qty * exitUsd)
  const chgPct = ((exitUsd - position.entryUsd) / position.entryUsd) * 100
  const reason = closeReason(kind, position, exitUsd, chgPct)
  const action: CloseAction = {
    kind,
    symbol: position.symbol,
    qty: position.qty,
    entryUsd: position.entryUsd,
    exitUsd,
    proceedsUsd,
    chgPct,
    reason,
  }
  const cooldowns = { ...book.cooldowns }
  if (kind === 'stop_loss') {
    cooldowns[position.symbol] = new Date(
      now.getTime() + DESK.cooldownHoursAfterStop * 60 * 60 * 1000,
    ).toISOString()
  }
  const entry: JournalEntry = {
    id: nextId(`j-${position.symbol}-sell`),
    at: now.toISOString(),
    side: 'sell',
    symbol: position.symbol,
    qty: position.qty,
    priceUsd: exitUsd,
    notionalUsd: proceedsUsd,
    reason,
    mode: 'paper',
    chgPct,
  }
  return {
    action,
    book: {
      ...book,
      cashUsd: roundCash(book.cashUsd + proceedsUsd),
      positions: book.positions.filter((row) => row.id !== position.id),
      journal: [...book.journal, entry],
      cooldowns,
      updatedAt: now.toISOString(),
    },
  }
}

function closeWhere(
  book: PaperBook,
  quotes: Quotes,
  now: Date,
  actions: CloseAction[],
  pick: (position: PaperPosition, price: number) => CloseKind | null,
): PaperBook {
  let next = book
  for (const position of [...book.positions]) {
    const price = quotes[position.symbol]?.priceUsd
    if (!(price > 0)) continue
    if (!next.positions.some((row) => row.id === position.id)) continue
    const kind = pick(position, price)
    if (!kind) continue
    const closed = closePosition(next, position, price, kind, now)
    actions.push(closed.action)
    next = closed.book
  }
  return next
}

/**
 * Mark the book, paper-sell take-profit and stop hits, then flatten if day P&L
 * is through the kill switch. Stop exits start a 24h cooldown. Take-profit does not.
 * This never sends an exchange order.
 */
export function applyRules(
  book: PaperBook,
  quotes: Quotes,
  now = new Date(),
): { book: PaperBook; actions: CloseAction[] } {
  const before = equityOf(book, quotes)
  let next = withDayRoll(book, before.complete ? before.equity : null, now)
  const actions: CloseAction[] = []

  next = closeWhere(next, quotes, now, actions, (position, price) => {
    if (price <= position.stopLossUsd) return 'stop_loss'
    if (price >= position.takeProfitUsd) return 'take_profit'
    return null
  })

  const after = equityOf(next, quotes)
  const tripped =
    next.dayStartEquityUsd != null &&
    after.complete &&
    isDailyKill(next.dayStartEquityUsd, after.equity)

  if (tripped || next.killActive) {
    next = closeWhere(next, quotes, now, actions, () => 'daily_kill')
    if (tripped && !next.killActive) {
      next = { ...next, killActive: true, updatedAt: now.toISOString() }
    }
  }

  return { book: next, actions }
}

export function paperEntryBlock(
  book: PaperBook,
  symbolRaw: string,
  quotes: Quotes,
  now = new Date(),
): EntryBlock | null {
  if (DESK.liveEnabled) {
    return {
      code: 'live',
      message: 'Live routing is not implemented. Paper only — live stays off.',
    }
  }
  const symbol = symbolRaw.trim().toUpperCase()
  if (!WATCHLIST_SYMBOLS.includes(symbol)) {
    return { code: 'watchlist', message: `${symbol || 'That symbol'} is not on the watchlist.` }
  }
  if (book.killActive) {
    return {
      code: 'kill',
      message: 'Daily kill is on. New paper entries are paused until the next ET day.',
    }
  }
  if (book.positions.length >= DESK.maxOpenPositions) {
    return { code: 'seats', message: `Seat cap is ${DESK.maxOpenPositions}.` }
  }
  if (book.positions.some((position) => position.symbol === symbol)) {
    return { code: 'held', message: `${symbol} already has an open paper seat.` }
  }
  const until = cooldownUntil(book, symbol, now)
  if (until) {
    return {
      code: 'cooldown',
      message: `${symbol} is in a 24h cooldown after a stop.`,
    }
  }
  if (isMemeSymbol(symbol) && book.positions.some((position) => position.meme)) {
    return {
      code: 'meme',
      message: 'Meme cap is one seat among DOGE, PEPE, and SHIB.',
    }
  }
  if (book.cashUsd < DESK.maxRiskPerTradeUsd) {
    return { code: 'cash', message: 'Need at least $50 paper cash.' }
  }
  const price = quotes[symbol]?.priceUsd
  if (!(price > 0)) {
    return { code: 'price', message: `No Coinbase price for ${symbol}.` }
  }
  return null
}

function positionId(symbol: string, now: Date, existing: PaperPosition[]): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  const stamp = `${pick('year')}${pick('month')}${pick('day')}${pick('hour')}${pick('minute')}`
  const base = `paper-${symbol.toLowerCase()}-${stamp}`
  if (!existing.some((position) => position.id === base)) return base
  return `${base}-${pick('minute')}${now.getSeconds()}`
}

/**
 * Open one $50 paper long. Enforces seats, cash, cooldown-after-stop, and one meme.
 * Paper ledger only — this does not submit an exchange order.
 */
export function openPaperLong(
  book: PaperBook,
  symbolRaw: string,
  quotes: Quotes,
  now = new Date(),
  reason?: string,
): { book: PaperBook; position: PaperPosition | null; error: EntryBlock | null } {
  const block = paperEntryBlock(book, symbolRaw, quotes, now)
  if (block) return { book, position: null, error: block }

  const symbol = symbolRaw.trim().toUpperCase()
  const quote = quotes[symbol] as Quote
  const entryUsd = quote.priceUsd
  const notionalUsd = DESK.maxRiskPerTradeUsd
  const takeProfitPct = takeProfitPctFor(symbol)
  const meme = isMemeSymbol(symbol)
  const position: PaperPosition = {
    id: positionId(symbol, now, book.positions),
    symbol,
    side: 'long',
    qty: notionalUsd / entryUsd,
    notionalUsd,
    entryUsd,
    takeProfitUsd: roundPx(entryUsd * (1 + takeProfitPct / 100)),
    stopLossUsd: roundPx(entryUsd * (1 - DESK.stopLossPct / 100)),
    takeProfitPct,
    openedAt: now.toISOString(),
    reason: reason ?? `Paper long $${notionalUsd} ${symbol}`,
    mode: 'paper',
    meme,
  }
  const journal: JournalEntry = {
    id: nextId(`j-${symbol}-buy`),
    at: now.toISOString(),
    side: 'buy',
    symbol,
    qty: position.qty,
    priceUsd: entryUsd,
    notionalUsd,
    reason: position.reason,
    mode: 'paper',
  }
  return {
    position,
    error: null,
    book: {
      ...book,
      cashUsd: roundCash(book.cashUsd - notionalUsd),
      positions: [...book.positions, position],
      journal: [...book.journal, journal],
      updatedAt: now.toISOString(),
    },
  }
}

function calmScore(quote: Quote | undefined): number {
  const change = quote?.change24hPct
  if (change == null) return 0
  // Prefer a mild positive drift near +2%. Red days rank lower.
  let score = -Math.abs(change - 2)
  if (change < 0) score -= Math.abs(change) * 0.35
  return score
}

function isParabolic(quote: Quote | undefined): boolean {
  const change = quote?.change24hPct
  return change != null && change >= DESK.parabolicDayPct
}

/**
 * Up to two new seats after rules have already been applied.
 * Skips parabolic day spikes when any calmer watchlist name is eligible.
 * Opens nothing if every free name is parabolic. At most one meme in the pick,
 * and none if a meme seat is already open.
 */
export function pickCalmEntries(book: PaperBook, quotes: Quotes, now = new Date()): string[] {
  if (book.killActive) return []
  if (book.cashUsd < DESK.maxRiskPerTradeUsd) return []
  const freeSeats = DESK.maxOpenPositions - book.positions.length
  const freeCash = Math.floor(book.cashUsd / DESK.maxRiskPerTradeUsd)
  const limit = Math.min(DESK.maxNewSeatsPerAttack, freeSeats, freeCash)
  if (limit <= 0) return []

  const held = new Set(book.positions.map((position) => position.symbol))
  const memeHeld = book.positions.some((position) => position.meme)
  const eligible = WATCHLIST_SYMBOLS.filter((symbol) => {
    if (held.has(symbol)) return false
    if (!(quotes[symbol]?.priceUsd > 0)) return false
    if (cooldownUntil(book, symbol, now)) return false
    return true
  })

  const hasCalm = eligible.some((symbol) => !isParabolic(quotes[symbol]))
  const pool = hasCalm ? eligible.filter((symbol) => !isParabolic(quotes[symbol])) : []
  const byCalm = (a: string, b: string) => {
    const score = calmScore(quotes[b]) - calmScore(quotes[a])
    if (Math.abs(score) > 1e-9) return score
    return WATCHLIST_SYMBOLS.indexOf(a) - WATCHLIST_SYMBOLS.indexOf(b)
  }
  const liquid = pool.filter((symbol) => !isMemeSymbol(symbol)).sort(byCalm)
  const memes = pool.filter((symbol) => isMemeSymbol(symbol)).sort(byCalm)

  const picks: string[] = []
  for (const symbol of liquid) {
    if (picks.length >= limit) break
    picks.push(symbol)
  }
  if (picks.length < limit && !memeHeld && memes.length > 0) {
    picks.push(memes[0]!)
  }
  return picks
}

export function attackReason(symbol: string, quote: Quote | undefined): string {
  const change = quote?.change24hPct
  const day = change == null ? 'day change n/a' : `${formatPct(change)} 24h`
  if (isMemeSymbol(symbol)) {
    return `Paper attack: one meme seat (${symbol}) — ${day}, not a chase`
  }
  return `Paper attack: liquid ${symbol} — calm day structure, ${day}, not a chase`
}
