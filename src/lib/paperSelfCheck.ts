import { createSeedBook } from '../data/seedBook'
import { parseStoredBook } from './paperStorage'
import {
  applyRules,
  openPaperLong,
  pickCalmEntries,
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

}
