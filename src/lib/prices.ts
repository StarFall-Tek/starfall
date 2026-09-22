export type Quote = {
  symbol: string
  priceUsd: number
  /** Percent change versus the Coinbase 24h open. Null when stats are missing. */
  change24hPct: number | null
  asOf: string
  source: 'coinbase-exchange' | 'coinbase-spot'
}

export type Quotes = Record<string, Quote>

const EXCHANGE = 'https://api.exchange.coinbase.com/products'
const SPOT = 'https://api.coinbase.com/v2/prices'

function productSymbol(symbol: string): string | null {
  const upper = symbol.trim().toUpperCase()
  if (!/^[A-Z0-9]{2,10}$/.test(upper)) return null
  return upper
}

let paceChain: Promise<void> = Promise.resolve()

/** Keep public Coinbase calls under the anonymous rate limit. */
function pace(): Promise<void> {
  const slot = paceChain.then(
    () => new Promise<void>((resolve) => setTimeout(resolve, 140)),
  )
  paceChain = slot
  return slot
}

async function readJson(url: string): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await pace()
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (response.status === 429 && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1200))
      continue
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }
  throw new Error('HTTP 429')
}

async function fetchOne(symbol: string): Promise<Quote | null> {
  const upper = productSymbol(symbol)
  if (!upper) return null
  try {
    const [ticker, stats] = await Promise.all([
      readJson(`${EXCHANGE}/${upper}-USD/ticker`),
      readJson(`${EXCHANGE}/${upper}-USD/stats`).catch(() => null),
    ])
    const price = Number((ticker as { price?: string }).price)
    if (!(price > 0)) throw new Error('bad ticker')
    let change24hPct: number | null = null
    const open = Number((stats as { open?: string } | null)?.open)
    if (open > 0) change24hPct = ((price - open) / open) * 100
    const time = (ticker as { time?: string }).time
    return {
      symbol: upper,
      priceUsd: price,
      change24hPct,
      asOf: time || new Date().toISOString(),
      source: 'coinbase-exchange',
    }
  } catch {
    try {
      const body = await readJson(`${SPOT}/${upper}-USD/spot`)
      const price = Number((body as { data?: { amount?: string } }).data?.amount)
      if (!(price > 0)) return null
      return {
        symbol: upper,
        priceUsd: price,
        change24hPct: null,
        asOf: new Date().toISOString(),
        source: 'coinbase-spot',
      }
    } catch {
      return null
    }
  }
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      out[index] = await fn(items[index]!)
    }
  })
  await Promise.all(workers)
  return out
}

/** Public Coinbase prices. No API key. Missing symbols are omitted. */
export async function fetchCoinbaseQuotes(
  symbols: readonly string[],
): Promise<{ quotes: Quotes; missing: string[] }> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))]
  const rows = await mapPool(unique, 4, (symbol) => fetchOne(symbol))
  const quotes: Quotes = {}
  const missing: string[] = []
  unique.forEach((symbol, index) => {
    const quote = rows[index]
    if (quote) quotes[symbol] = quote
    else missing.push(symbol)
  })
  return { quotes, missing }
}
