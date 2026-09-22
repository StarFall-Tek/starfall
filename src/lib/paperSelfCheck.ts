import { DESK } from '../data/deskConfig'
import { createSeedBook } from '../data/seedBook'
import { parseStoredBook } from './paperStorage'
import {
  applyQuickRotates,
  applyRules,
  bankEarlySeat,
  isFlatOrDead,
  liquidTape,
  openPaperLong,
  pickCalmEntries,
  pickQuickEntries,
  rotateFlatSeat,
  type PaperBook,
  type PaperPosition,
} from './paperEngine'
import type { Quote, Quotes } from './prices'

const NOW = new Date('2026-09-22T16:00:00.000Z')

function quote(symbol: string, priceUsd: number, change24hPct: number | null = 1): Quote {
  return {
    symbol,
    priceUsd,
    change24hPct,
    asOf: NOW.toISOString(),
    source: 'coinbase-exchange',
  }
}

function book(over: Partial<PaperBook> = {}): PaperBook {
  return {
    version: 1,
    cashUsd: 1000,
    positions: [],
    journal: [],
    cooldowns: {},
    dayKey: '2026-09-22',
    dayStartEquityUsd: 1000,
    killActive: false,
    updatedAt: NOW.toISOString(),
    ...over,
  }
}

function pos(symbol: string, entry: number, over: Partial<PaperPosition> = {}): PaperPosition {
  const meme = symbol === 'DOGE' || symbol === 'PEPE' || symbol === 'SHIB'
  const takeProfitPct = over.takeProfitPct ?? (symbol === 'BTC' || symbol === 'ETH' ? 10 : 8)
  return {
    id: `t-${symbol}`,
    symbol,
    side: 'long',
    qty: 50 / entry,
    notionalUsd: 50,
    entryUsd: entry,
    takeProfitUsd: entry * (1 + takeProfitPct / 100),
    stopLossUsd: entry * (1 - 0.05),
    takeProfitPct,
    openedAt: NOW.toISOString(),
    reason: 'test',
    mode: 'paper',
    meme,
    ...over,
  }
}

function quotes(rows: Quote[]): Quotes {
  return Object.fromEntries(rows.map((row) => [row.symbol, row]))
}

function frozen(value: unknown): string {
  return JSON.stringify(value)
}


function check(cond: unknown, label = 'expected condition'): void {
  if (!cond) throw new Error(label)
}

function checkMatch(value: string, pattern: RegExp): void {
  if (!pattern.test(value)) throw new Error(`expected ${pattern} to match ${value}`)
}

function same(actual: unknown, expected: unknown, label = 'mismatch'): void {
  const left = JSON.stringify(actual)
  const right = JSON.stringify(expected)
  if (left !== right) {
    throw new Error(`${label}\n  actual: ${left}\n  expected: ${right}`)
  }
}

export function runPaperSelfCheck(): void {
const sol = pos('SOL', 100)
const solBook = book({ cashUsd: 950, positions: [sol] })

const beforeTp = frozen(solBook)
const tp = applyRules(solBook, quotes([quote('SOL', 108, 1)]), NOW)
same(tp.actions.length, 1)
same(tp.actions[0]?.kind, 'take_profit')
same(tp.book.positions.length, 0)
same(tp.book.cashUsd, 1004)
same(tp.book.cooldowns, {})
same(frozen(solBook), beforeTp)
same(tp.book.journal.at(-1)?.side, 'sell')

const justUnder = applyRules(solBook, quotes([quote('SOL', 107.99, 1)]), NOW)
same(justUnder.actions.length, 0)
same(justUnder.book.positions.length, 1)

const reopened = openPaperLong(tp.book, 'SOL', quotes([quote('SOL', 108, 1)]), NOW)
same(reopened.error, null)
same(reopened.position?.symbol, 'SOL')
same(reopened.book.cashUsd, 954)

const sl = applyRules(solBook, quotes([quote('SOL', 90, -4)]), NOW)
same(sl.actions[0]?.kind, 'stop_loss')
same(sl.book.cashUsd, 995)
check(sl.book.cooldowns.SOL)
same(sl.actions[0]?.exitUsd, 90)
const blockedStop = openPaperLong(sl.book, 'SOL', quotes([quote('SOL', 90, 0)]), NOW)
same(blockedStop.error?.code, 'cooldown')
const afterCooldown = openPaperLong(
  sl.book,
  'SOL',
  quotes([quote('SOL', 90, 0)]),
  new Date(NOW.getTime() + 25 * 60 * 60 * 1000),
)
same(afterCooldown.error, null)

const atStop = applyRules(solBook, quotes([quote('SOL', 95, -5)]), NOW)
same(atStop.actions[0]?.kind, 'stop_loss')
const aboveStop = applyRules(solBook, quotes([quote('SOL', 95.01, -4)]), NOW)
same(aboveStop.actions.length, 0)

const gap = applyRules(solBook, quotes([quote('SOL', 80, -20)]), NOW)
same(gap.actions[0]?.kind, 'stop_loss')
same(gap.actions[0]?.proceedsUsd, 40)
same(gap.book.cashUsd, 990)
checkMatch(gap.actions[0]?.reason ?? '', /STOP/)

const ada = {
  ...pos('ADA', 100),
  qty: 1,
  notionalUsd: 100,
  takeProfitUsd: 150,
  stopLossUsd: 50,
}
const killBook = book({
  cashUsd: 900,
  dayStartEquityUsd: 1100,
  positions: [ada],
})
const notYet = applyRules(killBook, quotes([quote('ADA', 100, 0)]), NOW)
same(notYet.actions.length, 0)
same(notYet.book.killActive, false)

const killed = applyRules(killBook, quotes([quote('ADA', 90, -10)]), NOW)
same(killed.actions.length, 1)
same(killed.actions[0]?.kind, 'daily_kill')
same(killed.book.positions.length, 0)
same(killed.book.killActive, true)
same(killed.book.cashUsd, 990)
same(killed.book.cooldowns.ADA, undefined)
const killedBuy = openPaperLong(killed.book, 'BTC', quotes([quote('BTC', 100, 1)]), NOW)
same(killedBuy.error?.code, 'kill')

const nextDay = new Date('2026-09-23T16:00:00.000Z')
const rolled = applyRules(killed.book, {}, nextDay)
same(rolled.book.killActive, false)
same(rolled.book.dayKey, '2026-09-23')
const afterKill = openPaperLong(rolled.book, 'BTC', quotes([quote('BTC', 100, 1)]), nextDay)
same(afterKill.error, null)
same(afterKill.position?.takeProfitPct, 10)
same(afterKill.position?.takeProfitUsd, 110)
same(afterKill.position?.stopLossUsd, 95)

const solOpen = openPaperLong(book(), 'SOL', quotes([quote('SOL', 100, 1)]), NOW)
same(solOpen.position?.takeProfitPct, 8)
same(solOpen.position?.takeProfitUsd, 108)
same(solOpen.book.cashUsd, 950)
same(solOpen.book.journal.at(-1)?.mode, 'paper')

const memeBook = book({ cashUsd: 950, positions: [pos('DOGE', 0.1)] })
same(
  openPaperLong(memeBook, 'SHIB', quotes([quote('SHIB', 0.00001, 1)]), NOW).error?.code,
  'meme',
)
same(
  openPaperLong(memeBook, 'ADA', quotes([quote('ADA', 1, 1)]), NOW).position?.symbol,
  'ADA',
)

const full = book({
  cashUsd: 750,
  positions: ['BTC', 'ETH', 'SOL', 'LINK', 'AVAX'].map((symbol) => pos(symbol, 10)),
})
same(pickCalmEntries(full, quotes([quote('XRP', 1, 1)]), NOW).length, 0)
same(openPaperLong(full, 'XRP', quotes([quote('XRP', 1, 1)]), NOW).error?.code, 'seats')
same(openPaperLong(book({ cashUsd: 49.99 }), 'BTC', quotes([quote('BTC', 100, 1)]), NOW).error?.code, 'cash')
same(openPaperLong(book(), 'FOO', quotes([quote('FOO', 1, 1)]), NOW).error?.code, 'watchlist')

const calm = pickCalmEntries(
  book(),
  quotes([
    quote('ADA', 1, 1.5),
    quote('DOT', 1, 3),
    quote('XRP', 1, 12),
    quote('DOGE', 1, 1),
  ]),
  NOW,
)
same(calm, ['ADA', 'DOT'])

const oneMeme = pickCalmEntries(
  book(),
  quotes([quote('DOGE', 1, 1), quote('PEPE', 1, 1.2), quote('XRP', 1, 12)]),
  NOW,
)
same(oneMeme, ['PEPE'])

const noChase = pickCalmEntries(
  book(),
  quotes([quote('XRP', 1, 12), quote('DOGE', 1, 15)]),
  NOW,
)
same(noChase, [])

const cooling = book({
  cooldowns: { LINK: new Date(NOW.getTime() + 60_000).toISOString() },
})
same(
  pickCalmEntries(cooling, quotes([quote('LINK', 1, 2), quote('ADA', 1, 4)]), NOW),
  ['ADA'],
)

const seed = createSeedBook(NOW)
same(seed.cashUsd, 774.18)
same(
  seed.positions.map((position) => position.symbol),
  ['BTC', 'ETH', 'SOL', 'LINK', 'AVAX'],
)
same(seed.positions[0]?.takeProfitPct, 10)
same(seed.positions[2]?.takeProfitPct, 8)
same(seed.journal.length, 19)
same(seed.killActive, false)
same(parseStoredBook(null, NOW).cashUsd, 774.18)
same(parseStoredBook('{', NOW).positions.length, 5)
same(parseStoredBook(JSON.stringify(seed), NOW).positions[4]?.symbol, 'AVAX')

same(DESK.liveEnabled, false)
same(DESK.mode, 'paper')
same(DESK.maxRiskPerTradeUsd, 50)
same(DESK.maxOpenPositions, 5)
same(DESK.stopLossPct, 5)
same(DESK.dailyLossKillPct, 10)

const stillWorking = applyRules(solBook, quotes([quote('SOL', 102, 2)]), NOW)
same(stillWorking.actions.length, 0)
same(stillWorking.book.positions.length, 1)
same(isFlatOrDead(sol, 100), true)
same(isFlatOrDead(sol, 103), false)
same(isFlatOrDead(sol, 95), false)

const earlyDust = bankEarlySeat(solBook, sol.id, quotes([quote('SOL', 100.5, 1)]), NOW)
check(earlyDust.error)
same(earlyDust.action, null)
same(earlyDust.book.positions.length, 1)

const banked = bankEarlySeat(solBook, sol.id, quotes([quote('SOL', 101, 1)]), NOW)
same(banked.error, null)
same(banked.action?.kind, 'quick_scalp')
same(banked.book.positions.length, 0)
same(banked.book.cashUsd, 1000.5)
same(banked.book.cooldowns, {})
checkMatch(banked.action?.reason ?? '', /gut\/quick-scalp BANK EARLY/)
checkMatch(banked.action?.reason ?? '', /Full TP/)
same(openPaperLong(banked.book, 'SOL', quotes([quote('SOL', 101, 1)]), NOW).error, null)

const flatBook = book({ cashUsd: 950, positions: [sol] })
const rotated = rotateFlatSeat(
  flatBook,
  sol.id,
  null,
  quotes([quote('SOL', 100, 0), quote('LINK', 10, 4)]),
  NOW,
)
same(rotated.error, null)
same(rotated.opened, 'LINK')
same(rotated.action?.kind, 'quick_scalp')
same(rotated.book.positions.length, 1)
same(rotated.book.positions[0]?.symbol, 'LINK')
same(rotated.book.positions[0]?.notionalUsd, 50)
same(rotated.book.positions[0]?.takeProfitPct, 8)
same(rotated.book.positions[0]?.stopLossUsd, 9.5)
same(rotated.book.cooldowns, {})
same(rotated.book.cashUsd, 950)
checkMatch(rotated.action?.reason ?? '', /gut\/quick-scalp ROTATE SOL → LINK/)
checkMatch(rotated.book.journal.at(-1)?.reason ?? '', /gut\/quick-scalp IN LINK/)

const heldWinner = rotateFlatSeat(
  flatBook,
  sol.id,
  null,
  quotes([quote('SOL', 103, 1), quote('LINK', 10, 6)]),
  NOW,
)
same(heldWinner.opened, null)
same(heldWinner.book.positions.length, 1)
same(heldWinner.book.positions[0]?.symbol, 'SOL')
check(heldWinner.error)

const throughStop = rotateFlatSeat(
  flatBook,
  sol.id,
  'LINK',
  quotes([quote('SOL', 95, -5), quote('LINK', 10, 4)]),
  NOW,
)
same(throughStop.action, null)
same(throughStop.book.positions[0]?.symbol, 'SOL')
checkMatch(throughStop.error ?? '', /stop/i)

const memeRotate = rotateFlatSeat(
  flatBook,
  sol.id,
  'DOGE',
  quotes([quote('SOL', 100, 0), quote('DOGE', 1, 8)]),
  NOW,
)
same(memeRotate.action, null)
same(memeRotate.book.positions.length, 1)
checkMatch(memeRotate.error ?? '', /liquid/)

const movers = pickQuickEntries(
  book(),
  quotes([
    quote('SOL', 1, 6),
    quote('ADA', 1, 2),
    quote('XRP', 1, 0.2),
    quote('DOGE', 1, 20),
  ]),
  NOW,
)
same(movers, ['SOL', 'ADA'])
same(
  pickQuickEntries(
    book({ positions: ['BTC', 'ETH', 'SOL', 'LINK', 'AVAX'].map((symbol) => pos(symbol, 10)) }),
    quotes([quote('XRP', 1, 5)]),
    NOW,
  ),
  [],
)

const linkCooling = book({
  cooldowns: { LINK: new Date(NOW.getTime() + 60_000).toISOString() },
})
same(
  pickQuickEntries(linkCooling, quotes([quote('LINK', 1, 6), quote('SOL', 1, 4)]), NOW),
  ['SOL'],
)

const winner = pos('ETH', 100, { takeProfitPct: 10, takeProfitUsd: 110 })
const dead = pos('AVAX', 100)
const quiet = pos('ADA', 100)
const batch = applyQuickRotates(
  book({
    cashUsd: 850,
    positions: [winner, dead, quiet],
  }),
  quotes([
    quote('ETH', 104, 3),
    quote('AVAX', 99, -1),
    quote('ADA', 100.2, 0.2),
    quote('SOL', 1, 5),
    quote('LINK', 1, 3),
  ]),
  NOW,
)
same(batch.opened, ['SOL', 'LINK'])
same(
  batch.book.positions.map((position) => position.symbol).sort(),
  ['ETH', 'LINK', 'SOL'],
)
same(batch.book.positions.length, 3)
same(batch.actions.length, 2)
same(batch.book.cooldowns, {})

const crowded = ['BTC', 'ETH', 'SOL', 'LINK', 'AVAX'].map((symbol) => pos(symbol, 100))
const crowdedBook = book({ cashUsd: 750, positions: crowded })
const swapped = rotateFlatSeat(
  crowdedBook,
  't-AVAX',
  'XRP',
  quotes([
    quote('BTC', 100, 0),
    quote('ETH', 100, 0),
    quote('SOL', 100, 0),
    quote('LINK', 100, 0),
    quote('AVAX', 100, 0),
    quote('XRP', 1, 4),
  ]),
  NOW,
)
same(swapped.error, null)
same(swapped.book.positions.length, 5)
same(swapped.book.positions.some((position) => position.symbol === 'AVAX'), false)
same(swapped.book.positions.some((position) => position.symbol === 'XRP'), true)
same(swapped.book.positions.every((position) => position.notionalUsd === 50), true)

const tape = liquidTape(
  quotes([
    quote('SOL', 100, 4),
    quote('ADA', 1, -2),
    quote('DOGE', 1, 30),
    quote('LINK', 10, 1.5),
    quote('AVAX', 10, -0.5),
    quote('DOT', 5, 0.2),
  ]),
)
same(
  tape.strongest.map((row) => row.symbol),
  ['SOL', 'LINK', 'DOT'],
)
same(
  tape.weakest.map((row) => row.symbol),
  ['ADA', 'AVAX'],
)
same(tape.strongest.some((row) => row.symbol === 'DOGE'), false)

}
