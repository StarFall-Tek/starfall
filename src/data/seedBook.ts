import type { JournalEntry, PaperBook, PaperPosition } from '../lib/paperEngine'
import { etDayKey } from '../lib/format'

/** Cash and open seats from the 2026-09-21 desk snapshot. */
export const SEED_CASH_USD = 774.18

export const SEED_POSITIONS: PaperPosition[] = [
  {
    id: 'paper-btc-202609141222',
    symbol: 'BTC',
    side: 'long',
    qty: 0.0006350399821172741,
    notionalUsd: 50,
    entryUsd: 78735.2,
    takeProfitUsd: 86608.72,
    stopLossUsd: 74798.44,
    openedAt: '2026-09-14T12:22:09.199983-04:00',
    reason: 'Core ballast on green tape; not chasing hottest alts',
    mode: 'paper',
    meme: false,
    takeProfitPct: 10,
  },
  {
    id: 'paper-eth-202609192047',
    symbol: 'ETH',
    side: 'long',
    qty: 0.019028843921616384,
    notionalUsd: 50,
    entryUsd: 2627.59,
    takeProfitUsd: 2890.349,
    stopLossUsd: 2496.2105,
    openedAt: '2026-09-19T20:47:57.300656-04:00',
    reason: 'Paper redeploy: core ETH after cash build',
    mode: 'paper',
    meme: false,
    takeProfitPct: 10,
  },
  {
    id: 'paper-sol-202609192047',
    symbol: 'SOL',
    side: 'long',
    qty: 0.4505722267279445,
    notionalUsd: 50,
    entryUsd: 110.97,
    takeProfitUsd: 119.8476,
    stopLossUsd: 105.4215,
    openedAt: '2026-09-19T20:47:57.300656-04:00',
    reason: 'Paper redeploy: re-enter SOL after prior TP',
    mode: 'paper',
    meme: false,
    takeProfitPct: 8,
  },
  {
    id: 'paper-link-202609192047',
    symbol: 'LINK',
    side: 'long',
    qty: 4.029356278099724,
    notionalUsd: 50,
    entryUsd: 12.40893,
    takeProfitUsd: 13.401644,
    stopLossUsd: 11.788483,
    openedAt: '2026-09-19T20:47:57.300656-04:00',
    reason: 'Paper redeploy: LINK cooldown done; liquid mid-cap',
    mode: 'paper',
    meme: false,
    takeProfitPct: 8,
  },
  {
    id: 'paper-avax-202609212224',
    symbol: 'AVAX',
    side: 'long',
    qty: 4.493170381020848,
    notionalUsd: 50,
    entryUsd: 11.128,
    takeProfitUsd: 12.01824,
    stopLossUsd: 10.5716,
    openedAt: '2026-09-21T22:24:02.365593-04:00',
    reason: 'Paper refill: liquid AVAX — calm day structure, not a chase',
    mode: 'paper',
    meme: false,
    takeProfitPct: 8,
  },
]

function trade(
  n: number,
  at: string,
  side: 'buy' | 'sell',
  symbol: string,
  qty: number,
  priceUsd: number,
  reason: string,
): JournalEntry {
  return {
    id: `seed-${String(n).padStart(2, '0')}`,
    at,
    side,
    symbol,
    qty,
    priceUsd,
    notionalUsd: Math.round(qty * priceUsd * 100) / 100,
    reason,
    mode: 'paper',
  }
}

/** Historical paper fills through the AVAX refill. Cash already reflects these. */
export const SEED_JOURNAL: JournalEntry[] = [
  trade(1, '2026-09-14T12:22:00-04:00', 'buy', 'BTC', 0.00063504, 78735.2, 'Core ballast on green tape; not chasing hottest alts'),
  trade(2, '2026-09-14T12:22:00-04:00', 'buy', 'SOL', 0.48809059, 102.44, 'Strength with structure (+3% vs open); sized to $50 risk cap'),
  trade(3, '2026-09-14T12:25:00-04:00', 'buy', 'LINK', 4.34264889, 11.51371, 'Paper day-trade drill: liquid LINK, hard TP/SL, flatten-by-rules (not a new-coin chase)'),
  trade(4, '2026-09-14T12:37:00-04:00', 'buy', 'DOGE', 593.50632856, 0.0842451, 'Paper meme seat: liquid DOGE only (not a mystery new coin). Hard TP/SL. No profit guarantee.'),
  trade(5, '2026-09-15T00:54:00-04:00', 'buy', 'PEPE', 14484356.89455388, 0.000003452, 'Paper meme #2: liquid PEPE after max slots raised to 5. Hard TP/SL. No profit guarantee.'),
  trade(6, '2026-09-16T08:27:00-04:00', 'sell', 'LINK', 4.34264889, 10.79671, 'Paper STOP −5% rule @ 10.79671 (entry 11.51371)'),
  trade(7, '2026-09-16T08:27:00-04:00', 'sell', 'DOGE', 593.50632856, 0.0796989, 'Paper STOP −5% rule @ 0.0796989 (entry 0.0842451)'),
  trade(8, '2026-09-16T12:40:00-04:00', 'buy', 'XRP', 39.51944357, 1.2652, 'Paper XRP $50 bounce attempt after risk-off dump — NOT a certainty. Hard TP/SL.'),
  trade(9, '2026-09-16T12:40:00-04:00', 'buy', 'SHIB', 10484378.28, 0.000004769, 'Paper RISK mode: high-beta SHIB $50. Stops still bind. Not a live trade. No profit guarantee.'),
  trade(10, '2026-09-18T08:26:00-04:00', 'sell', 'SHIB', 10484378.28, 0.00000537, 'Paper TAKE-PROFIT +8% rule @ 5.37e-06 (entry 4.769e-06; +12.60%)'),
  trade(11, '2026-09-18T16:22:00-04:00', 'sell', 'SOL', 0.48809058961343227, 113.825, 'Paper TAKE-PROFIT +8% rule @ 113.825 (entry 102.44; +11.11%)'),
  trade(12, '2026-09-18T16:22:00-04:00', 'sell', 'PEPE', 14484356.894553881, 0.000003835, 'Paper TAKE-PROFIT +8% rule @ 3.835e-06 (entry 3.452e-06; +11.10%)'),
  trade(13, '2026-09-18T16:22:00-04:00', 'sell', 'XRP', 39.519443566234585, 1.4093, 'Paper TAKE-PROFIT +8% rule @ 1.4093 (entry 1.2652; +11.39%)'),
  trade(14, '2026-09-19T20:47:00-04:00', 'buy', 'ETH', 0.01902884, 2627.59, 'Paper redeploy: core ETH after cash build'),
  trade(15, '2026-09-19T20:47:00-04:00', 'buy', 'SOL', 0.45057223, 110.97, 'Paper redeploy: re-enter SOL after prior TP'),
  trade(16, '2026-09-19T20:47:00-04:00', 'buy', 'LINK', 4.02935628, 12.40893, 'Paper redeploy: LINK cooldown done; liquid mid-cap'),
  trade(17, '2026-09-19T20:47:00-04:00', 'buy', 'DOGE', 570.65704311, 0.0876183, 'Paper redeploy: one meme seat only (DOGE)'),
  trade(18, '2026-09-21T22:24:00-04:00', 'sell', 'DOGE', 570.6570431062918, 0.09969, 'Paper TAKE-PROFIT +8% rule @ 0.09969 (entry 0.0876183; +13.78%)'),
  trade(19, '2026-09-21T22:24:00-04:00', 'buy', 'AVAX', 4.49317038, 11.128, 'Paper refill: liquid AVAX — calm day structure, not a chase'),
]

export function createSeedBook(now = new Date()): PaperBook {
  return {
    version: 1,
    cashUsd: SEED_CASH_USD,
    positions: SEED_POSITIONS.map((position) => ({ ...position })),
    journal: SEED_JOURNAL.map((entry) => ({ ...entry })),
    cooldowns: {},
    dayKey: etDayKey(now),
    dayStartEquityUsd: null,
    killActive: false,
    updatedAt: now.toISOString(),
  }
}
