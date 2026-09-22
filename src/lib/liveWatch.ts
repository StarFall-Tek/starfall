import { useEffect, useSyncExternalStore } from 'react'
import { getQuoteSnap, refreshQuotes } from './quoteStore'

/** Public Coinbase pull while Digest or Paper is on screen. */
export const LIVE_WATCH_MS = 20_000

const KEY = 'starfall.liveWatch.v1'

function readEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

let enabled = readEnabled()
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

export function getLiveWatchEnabled(): boolean {
  return enabled
}

export function setLiveWatchEnabled(next: boolean): void {
  enabled = next
  try {
    localStorage.setItem(KEY, next ? 'on' : 'off')
  } catch {
    // Private mode should not crash the desk.
  }
  emit()
}

export function subscribeLiveWatch(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLiveWatchEnabled(): boolean {
  return useSyncExternalStore(subscribeLiveWatch, getLiveWatchEnabled, () => true)
}

/**
 * One immediate public-price pull, then every 20s while Live watch is on
 * and the browser tab is visible. Pause stops the interval.
 */
export function useMarketWatch(symbols: readonly string[]): void {
  const on = useLiveWatchEnabled()
  const key = symbols.join(',')
  useEffect(() => {
    const list = key.split(',').filter(Boolean)
    if (list.length === 0) return
    let stopped = false
    const tick = (force: boolean) => {
      if (stopped) return
      if (!force && typeof document !== 'undefined' && document.hidden) return
      if (getQuoteSnap().loading) return
      void refreshQuotes(list)
    }
    const haveMarks = getQuoteSnap().fetchedAt != null
    if (on || !haveMarks) tick(true)
    if (!on) {
      return () => {
        stopped = true
      }
    }
    const timer = window.setInterval(() => tick(false), LIVE_WATCH_MS)
    const onVisible = () => {
      if (!document.hidden) tick(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [on, key])
}
