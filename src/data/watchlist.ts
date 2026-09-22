export type WatchItem = {
  symbol: string
  name: string
}

/** Settings watchlist — paper mode; live trading remains locked. */
export const WATCHLIST: WatchItem[] = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'LINK', name: 'Chainlink' },
  { symbol: 'BNB', name: 'BNB' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'DOT', name: 'Polkadot' },
  { symbol: 'NEAR', name: 'NEAR' },
  { symbol: 'UNI', name: 'Uniswap' },
  { symbol: 'SUI', name: 'Sui' },
  { symbol: 'ATOM', name: 'Cosmos' },
  { symbol: 'AAVE', name: 'Aave' },
  { symbol: 'PEPE', name: 'Pepe' },
  { symbol: 'SHIB', name: 'Shiba Inu' },
]

export const WATCHLIST_SYMBOLS = WATCHLIST.map((item) => item.symbol)
