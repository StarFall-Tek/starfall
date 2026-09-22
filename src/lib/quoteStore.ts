import { useSyncExternalStore } from 'react'
import { fetchCoinbaseQuotes, type Quotes } from './prices'

export type QuoteSnap = {
  quotes: Quotes
  missing: string[]
  fetchedAt: string | null
  error: string | null
  loading: boolean
}

const listeners = new Set<() => void>()

let snap: QuoteSnap = {
  quotes: {},
  missing: [],
  fetchedAt: null,
  error: null,
  loading: false,
}

let requestId = 0

function publish(next: QuoteSnap) {
  snap = next
  listeners.forEach((listener) => listener())
}

export function getQuoteSnap(): QuoteSnap {
  return snap
}

export function subscribeQuotes(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useQuoteSnap(): QuoteSnap {
  return useSyncExternalStore(subscribeQuotes, getQuoteSnap, getQuoteSnap)
}

/** Fetch public Coinbase quotes and merge them into the shared cache. */
export async function refreshQuotes(symbols: readonly string[]): Promise<QuoteSnap> {
  const id = ++requestId
  publish({ ...snap, loading: true, error: null })
  try {
    const { quotes } = await fetchCoinbaseQuotes(symbols)
    if (id !== requestId) return snap
    const merged = { ...snap.quotes, ...quotes }
    const stillMissing = symbols
      .map((symbol) => symbol.trim().toUpperCase())
      .filter((symbol) => symbol && merged[symbol] == null)
    const failedAll = stillMissing.length > 0 && Object.keys(quotes).length === 0
    publish({
      quotes: merged,
      missing: stillMissing,
      fetchedAt: new Date().toISOString(),
      error: failedAll ? 'Coinbase prices are unavailable right now.' : null,
      loading: false,
    })
  } catch {
    if (id !== requestId) return snap
    publish({
      ...snap,
      loading: false,
      fetchedAt: new Date().toISOString(),
      error: 'Coinbase prices are unavailable right now.',
    })
  }
  return snap
}
