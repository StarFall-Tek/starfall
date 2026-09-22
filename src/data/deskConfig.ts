/** Locked desk rules from the paper config. Live trading stays off. */

export const DESK = {
  name: 'STARFALL',
  mode: 'paper' as const,
  timezone: 'America/New_York',
  paperBalanceUsd: 1000,
  maxRiskPerTradeUsd: 50,
  maxOpenPositions: 5,
  takeProfitPct: 8,
  stopLossPct: 5,
  dailyLossKillPct: 10,
  cooldownHoursAfterStop: 24,
  liveEnabled: false,
  exchange: 'coinbase' as const,
  exchangeLabel: 'Coinbase (NY)',
  memeSymbols: ['DOGE', 'PEPE', 'SHIB'] as const,
  takeProfitPctByAsset: {
    BTC: 10,
    ETH: 10,
  } as Record<string, number>,
  /** Day change at or above this is a parabolic spike for attack selection. */
  parabolicDayPct: 8,
  maxNewSeatsPerAttack: 2,
  /**
   * Quick in/out is an optional paper bias. It does not move the hard caps:
   * $50, 5 seats, −5% stop, −10% daily kill, or live_enabled.
   */
  quickScalp: {
    /** At or above this unrealized gain, Analyze leaves the seat on its full TP. */
    holdAbovePct: 1,
    /** Manual bank-early needs at least this unrealized gain. */
    bankEarlyMinPct: 0.75,
    /** Auto-rotate only when the replacement day change leads by this many points. */
    moverGapPct: 1.5,
    /** Auto entries want a liquid name that is actually up on the day. */
    moverMinDayPct: 1,
  },
  notFinancialAdvice: true,
}

export const RULE_ROWS: { id: string; label: string; value: string }[] = [
  { id: 'mode', label: 'Mode', value: 'Paper' },
  { id: 'live', label: 'Live trading', value: 'Off (live_enabled false)' },
  { id: 'exchange', label: 'Exchange', value: 'Coinbase (NY)' },
  { id: 'tz', label: 'Clock', value: 'America/New_York' },
  { id: 'risk', label: 'Max risk per trade', value: '$50' },
  { id: 'positions', label: 'Max open positions', value: '5' },
  { id: 'tp', label: 'Take-profit', value: '+8% (+10% BTC/ETH)' },
  { id: 'sl', label: 'Stop-loss', value: '−5%' },
  { id: 'kill', label: 'Daily kill', value: '−10% day P&L' },
  { id: 'cooldown', label: 'Cooldown', value: '24h after STOP only' },
  { id: 'meme', label: 'Meme seats', value: '1 of DOGE / PEPE / SHIB' },
]

export function takeProfitPctFor(symbol: string): number {
  return DESK.takeProfitPctByAsset[symbol] ?? DESK.takeProfitPct
}

export function isMemeSymbol(symbol: string): boolean {
  return (DESK.memeSymbols as readonly string[]).includes(symbol)
}
