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

export type CloseKind = 'take_profit' | 'stop_loss' | 'daily_kill' | 'quick_scalp'

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
  if (kind === 'quick_scalp') {
    return `Paper gut/quick-scalp @ ${at} (entry ${entry}; ${chg}). Full TP stays +${position.takeProfitPct}% at ${formatUsd(position.takeProfitUsd)}.`
  }
  return `Paper daily kill −${DESK.dailyLossKillPct}% day P&L @ ${at} (entry ${entry}; ${chg})`
}

function closePosition(
  book: PaperBook,
  position: PaperPosition,
  exitUsd: number,
  kind: CloseKind,
  now: Date,
  reasonOverride?: string,
): { book: PaperBook; action: CloseAction } {
  const proceedsUsd = roundCash(position.qty * exitUsd)
  const chgPct = ((exitUsd - position.entryUsd) / position.entryUsd) * 100
  const reason = reasonOverride ?? closeReason(kind, position, exitUsd, chgPct)
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

export type TapeRow = {
  symbol: string
  priceUsd: number
  change24hPct: number
}

function unrealizedPct(entryUsd: number, price: number): number {
  return ((price - entryUsd) / entryUsd) * 100
}

/** Above the stop, short of the full TP, and not green enough to leave alone. */
export function isFlatOrDead(position: PaperPosition, price: number): boolean {
  if (!(price > 0)) return false
  if (price <= position.stopLossUsd) return false
  if (price >= position.takeProfitUsd) return false
  return unrealizedPct(position.entryUsd, price) < DESK.quickScalp.holdAbovePct
}

export function bankEarlyBlock(position: PaperPosition, quotes: Quotes): string | null {
  const price = quotes[position.symbol]?.priceUsd
  if (!(price > 0)) return `No Coinbase price for ${position.symbol}.`
  if (price <= position.stopLossUsd) {
    return `Price is through the −${DESK.stopLossPct}% stop. Run rules so the stop papers out.`
  }
  const pnl = unrealizedPct(position.entryUsd, price)
  if (pnl < DESK.quickScalp.bankEarlyMinPct) {
    return `Bank early waits for at least +${DESK.quickScalp.bankEarlyMinPct}%. Full TP is still +${position.takeProfitPct}% at ${formatUsd(position.takeProfitUsd)}.`
  }
  return null
}

function bankEarlyReason(position: PaperPosition, exitUsd: number, chgPct: number): string {
  return `Paper gut/quick-scalp BANK EARLY @ ${formatUsd(exitUsd)} (entry ${formatUsd(position.entryUsd)}; ${formatPct(chgPct)}). Full TP stays +${position.takeProfitPct}% at ${formatUsd(position.takeProfitUsd)}.`
}

function rotateOutReason(
  position: PaperPosition,
  exitUsd: number,
  chgPct: number,
  into: string,
): string {
  return `Paper gut/quick-scalp ROTATE ${position.symbol} → ${into} @ ${formatUsd(exitUsd)} (entry ${formatUsd(position.entryUsd)}; ${formatPct(chgPct)}). Flat/dead seat, not a stop. Full TP was +${position.takeProfitPct}%.`
}

export function quickEntryReason(symbol: string, quote: Quote | undefined): string {
  const change = quote?.change24hPct
  const day = change == null ? 'day change n/a' : `${formatPct(change)} 24h`
  return `Paper gut/quick-scalp IN ${symbol} — liquid mover, ${day}. $${DESK.maxRiskPerTradeUsd} paper seat. Full TP still +${takeProfitPctFor(symbol)}%.`
}

/**
 * Day's strongest and weakest liquid watchlist names. Memes stay off this tape.
 * Public Coinbase change vs the 24h open. No key.
 */
export function liquidTape(quotes: Quotes): { strongest: TapeRow[]; weakest: TapeRow[] } {
  const rows: TapeRow[] = []
  for (const symbol of WATCHLIST_SYMBOLS) {
    if (isMemeSymbol(symbol)) continue
    const quote = quotes[symbol]
    if (!(quote?.priceUsd > 0) || quote.change24hPct == null) continue
    rows.push({
      symbol,
      priceUsd: quote.priceUsd,
      change24hPct: quote.change24hPct,
    })
  }
  const strongest = [...rows]
    .sort((a, b) => b.change24hPct - a.change24hPct || a.symbol.localeCompare(b.symbol))
    .slice(0, 3)
  const shown = new Set(strongest.map((row) => row.symbol))
  const weakest = [...rows]
    .sort((a, b) => a.change24hPct - b.change24hPct || a.symbol.localeCompare(b.symbol))
    .filter((row) => !shown.has(row.symbol))
    .slice(0, 3)
  return { strongest, weakest }
}

/** Best liquid name that is up on the day, not held, and not cooling down. */
export function bestQuickMover(
  book: PaperBook,
  quotes: Quotes,
  now: Date,
  exclude: ReadonlySet<string> = new Set(),
): string | null {
  let best: { symbol: string; change: number } | null = null
  for (const symbol of WATCHLIST_SYMBOLS) {
    if (isMemeSymbol(symbol) || exclude.has(symbol)) continue
    if (book.positions.some((position) => position.symbol === symbol)) continue
    if (cooldownUntil(book, symbol, now)) continue
    const quote = quotes[symbol]
    if (!(quote?.priceUsd > 0) || quote.change24hPct == null) continue
    if (quote.change24hPct < DESK.quickScalp.moverMinDayPct) continue
    if (
      !best ||
      quote.change24hPct > best.change ||
      (quote.change24hPct === best.change && symbol.localeCompare(best.symbol) < 0)
    ) {
      best = { symbol, change: quote.change24hPct }
    }
  }
  return best?.symbol ?? null
}

export function flattestSeat(book: PaperBook, quotes: Quotes): PaperPosition | null {
  let best: { position: PaperPosition; pnl: number } | null = null
  for (const position of book.positions) {
    const price = quotes[position.symbol]?.priceUsd
    if (!(price > 0) || !isFlatOrDead(position, price)) continue
    const pnl = unrealizedPct(position.entryUsd, price)
    if (!best || pnl < best.pnl) best = { position, pnl }
  }
  return best?.position ?? null
}

/** Where Analyze would send this flat/dead seat. Null when it should keep the full TP. */
export function autoRotateTarget(
  book: PaperBook,
  position: PaperPosition,
  quotes: Quotes,
  now: Date,
): string | null {
  const price = quotes[position.symbol]?.priceUsd
  if (!(price > 0) || !isFlatOrDead(position, price)) return null
  if (book.cashUsd + position.qty * price < DESK.maxRiskPerTradeUsd) return null
  const into = bestQuickMover(book, quotes, now)
  if (!into) return null
  const intoDay = quotes[into]?.change24hPct
  const heldDay = quotes[position.symbol]?.change24hPct
  if (intoDay == null) return null
  if (heldDay != null && intoDay < heldDay + DESK.quickScalp.moverGapPct) return null
  return into
}

/**
 * Paper-sell a green seat before the full +8%/+10% target.
 * Does not start a cooldown and does not override a −5% stop.
 */
export function bankEarlySeat(
  book: PaperBook,
  positionId: string,
  quotes: Quotes,
  now = new Date(),
): { book: PaperBook; action: CloseAction | null; error: string | null } {
  const position = book.positions.find((row) => row.id === positionId)
  if (!position) return { book, action: null, error: 'That seat is already closed.' }
  const block = bankEarlyBlock(position, quotes)
  if (block) return { book, action: null, error: block }
  const price = quotes[position.symbol]?.priceUsd
  if (!(price > 0)) return { book, action: null, error: block }
  const chgPct = unrealizedPct(position.entryUsd, price)
  const closed = closePosition(
    book,
    position,
    price,
    'quick_scalp',
    now,
    bankEarlyReason(position, price, chgPct),
  )
  return { book: closed.book, action: closed.action, error: null }
}

export type RotateResult = {
  book: PaperBook
  action: CloseAction | null
  extra: CloseAction[]
  opened: string | null
  error: string | null
}

/**
 * Paper-sell one flat or dead seat and open the replacement at $50.
 * A named target is an explicit gut pick. A null target uses the auto mover.
 * Stops, the seat cap, and the daily kill still win.
 */
export function rotateFlatSeat(
  book: PaperBook,
  positionId: string,
  intoSymbol: string | null,
  quotes: Quotes,
  now = new Date(),
): RotateResult {
  const empty: RotateResult = { book, action: null, extra: [], opened: null, error: null }
  if (book.killActive) {
    return {
      ...empty,
      error: 'Daily kill is on. New paper entries are paused until the next ET day.',
    }
  }
  const position = book.positions.find((row) => row.id === positionId)
  if (!position) return { ...empty, error: 'That seat is already closed.' }
  const price = quotes[position.symbol]?.priceUsd
  if (!(price > 0)) return { ...empty, error: `No Coinbase price for ${position.symbol}.` }
  if (price <= position.stopLossUsd) {
    return {
      ...empty,
      error: `Price is through the −${DESK.stopLossPct}% stop. Run rules so the stop papers out.`,
    }
  }
  if (!isFlatOrDead(position, price)) {
    return {
      ...empty,
      error: `${position.symbol} is working toward its +${position.takeProfitPct}% target. Bank early if you want out, or leave it.`,
    }
  }
  const into = (intoSymbol ?? autoRotateTarget(book, position, quotes, now) ?? '')
    .trim()
    .toUpperCase()
  if (!into) {
    return { ...empty, error: 'No liquid mover is up enough to rotate into.' }
  }
  if (into === position.symbol) {
    return { ...empty, error: `${into} is already this seat.` }
  }
  if (isMemeSymbol(into)) {
    return {
      ...empty,
      error: 'Quick rotates stay on liquid names. DOGE, PEPE, and SHIB stay on the one-meme cap.',
    }
  }
  if (book.cashUsd + position.qty * price < DESK.maxRiskPerTradeUsd) {
    return {
      ...empty,
      error: 'Rotating out would leave less than $50 paper cash for the new seat.',
    }
  }
  const chgPct = unrealizedPct(position.entryUsd, price)
  const closed = closePosition(
    book,
    position,
    price,
    'quick_scalp',
    now,
    rotateOutReason(position, price, chgPct, into),
  )
  let next = closed.book
  const marked = equityOf(next, quotes)
  if (
    next.dayStartEquityUsd != null &&
    marked.complete &&
    isDailyKill(next.dayStartEquityUsd, marked.equity)
  ) {
    const killed = applyRules(next, quotes, now)
    return {
      book: killed.book,
      action: closed.action,
      extra: killed.actions,
      opened: null,
      error: 'That rotate realized a loss through the −10% daily kill. No new seat.',
    }
  }
  const filled = openPaperLong(next, into, quotes, now, quickEntryReason(into, quotes[into]))
  if (filled.error || !filled.position) {
    return {
      book: next,
      action: closed.action,
      extra: [],
      opened: null,
      error: filled.error?.message ?? 'Closed the flat seat, but the new paper seat was blocked.',
    }
  }
  return { book: filled.book, action: closed.action, extra: [], opened: into, error: null }
}

function flatSeats(book: PaperBook, quotes: Quotes): PaperPosition[] {
  return book.positions
    .filter((position) => {
      const price = quotes[position.symbol]?.priceUsd
      return price > 0 && isFlatOrDead(position, price)
    })
    .sort((a, b) => {
      const left = unrealizedPct(a.entryUsd, quotes[a.symbol]?.priceUsd ?? a.entryUsd)
      const right = unrealizedPct(b.entryUsd, quotes[b.symbol]?.priceUsd ?? b.entryUsd)
      return left - right
    })
}

/** Up to two flat/dead seats, weakest first, into stronger liquid names. */
export function applyQuickRotates(
  book: PaperBook,
  quotes: Quotes,
  now = new Date(),
): { book: PaperBook; actions: CloseAction[]; opened: string[] } {
  let next = book
  const actions: CloseAction[] = []
  const opened: string[] = []
  if (book.killActive) return { book, actions, opened }
  for (let n = 0; n < DESK.maxNewSeatsPerAttack; n += 1) {
    const seat = flatSeats(next, quotes).find((position) =>
      autoRotateTarget(next, position, quotes, now),
    )
    if (!seat) break
    const rotated = rotateFlatSeat(next, seat.id, null, quotes, now)
    if (!rotated.action || !rotated.opened) break
    next = rotated.book
    actions.push(rotated.action, ...rotated.extra)
    opened.push(rotated.opened)
  }
  return { book: next, actions, opened }
}

/**
 * Up to two new seats in the strongest liquid movers.
 * Skips memes. Still respects cash, seats, cooldown, and the daily kill.
 */
export function pickQuickEntries(book: PaperBook, quotes: Quotes, now = new Date()): string[] {
  if (book.killActive) return []
  if (book.cashUsd < DESK.maxRiskPerTradeUsd) return []
  const freeSeats = DESK.maxOpenPositions - book.positions.length
  const freeCash = Math.floor(book.cashUsd / DESK.maxRiskPerTradeUsd)
  const limit = Math.min(DESK.maxNewSeatsPerAttack, freeSeats, freeCash)
  if (limit <= 0) return []

  const ranked: { symbol: string; change: number }[] = []
  for (const symbol of WATCHLIST_SYMBOLS) {
    if (isMemeSymbol(symbol)) continue
    if (book.positions.some((position) => position.symbol === symbol)) continue
    if (cooldownUntil(book, symbol, now)) continue
    const quote = quotes[symbol]
    if (!(quote?.priceUsd > 0) || quote.change24hPct == null) continue
    if (quote.change24hPct < DESK.quickScalp.moverMinDayPct) continue
    ranked.push({ symbol, change: quote.change24hPct })
  }
  ranked.sort((a, b) => b.change - a.change || a.symbol.localeCompare(b.symbol))
  return ranked.slice(0, limit).map((row) => row.symbol)
}
