import { useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { WATCHLIST_SYMBOLS } from '../data/watchlist'
import {
  applyRules,
  attackReason,
  listCooldowns,
  markBook,
  openPaperLong,
  paperEntryBlock,
  pickCalmEntries,
  withDayRoll,
  type CloseAction,
  type PaperBook,
} from './paperEngine'
import { loadBook, saveBook } from './paperStorage'
import { refreshQuotes, useQuoteSnap } from './quoteStore'

function rulesNotice(actions: CloseAction[], missing: string[], killActive: boolean): string {
  const parts: string[] = []
  if (actions.length === 0) {
    parts.push('Rules checked on Coinbase prices. No take-profit, stop, or daily-kill sell.')
  } else {
    const bits = actions.map((action) => {
      const label =
        action.kind === 'take_profit'
          ? 'take-profit'
          : action.kind === 'stop_loss'
            ? 'stop'
            : 'daily kill'
      return `${action.symbol} ${label}`
    })
    parts.push(`Paper sells: ${bits.join(', ')}.`)
  }
  if (killActive) {
    parts.push('Daily kill is on — no new paper entries until the next ET day.')
  }
  if (missing.length > 0) {
    parts.push(`No price for ${missing.join(', ')} — those names were left alone.`)
  }
  return parts.join(' ')
}

function idleSeatNote(book: PaperBook): string {
  if (book.killActive) return 'No new seat — daily kill is on.'
  if (book.positions.length >= 5) return 'No new seat — 5/5 seats are full.'
  if (book.cashUsd < 50) return 'No new seat — cash is under $50.'
  return 'No new seat — no calm watchlist name cleared the spike filter, cooldown, and meme cap.'
}

export function usePaperBook() {
  const [book, setBook] = useState<PaperBook>(() => loadBook())
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const quotes = useQuoteSnap()
  useEffect(() => {
    saveBook(book)
  }, [book])

  useEffect(() => {
    let cancel = false
    void refreshQuotes(WATCHLIST_SYMBOLS).then((snap) => {
      if (cancel) return
      setBook((prev) => {
        const summary = markBook(prev, snap.quotes).summary
        const equity =
          summary.marksComplete || prev.positions.length === 0 ? summary.bookMarkUsd : null
        return withDayRoll(prev, equity, new Date())
      })
    })
    return () => {
      cancel = true
    }
  }, [])

  const marked = useMemo(
    () => markBook(book, quotes.quotes),
    [book, quotes.quotes],
  )

  async function runRules() {
    if (busy) return
    setBusy(true)
    try {
      const snap = await refreshQuotes(WATCHLIST_SYMBOLS)
      let actions: CloseAction[] = []
      let killActive = false
      flushSync(() => {
        setBook((prev) => {
          const result = applyRules(prev, snap.quotes, new Date())
          actions = result.actions
          killActive = result.book.killActive
          return result.book
        })
      })
      setNotice(rulesNotice(actions, snap.missing, killActive))
    } catch {
      setNotice('Could not reach Coinbase. The paper book was not changed.')
    } finally {
      setBusy(false)
    }
  }

  async function analyzeAndAttack() {
    if (busy) return
    setBusy(true)
    try {
      const now = new Date()
      const snap = await refreshQuotes(WATCHLIST_SYMBOLS)
      let actions: CloseAction[] = []
      let tail = ''
      let killActive = false
      flushSync(() => {
        setBook((prev) => {
          const ruled = applyRules(prev, snap.quotes, now)
          let current = ruled.book
          const picks = pickCalmEntries(current, snap.quotes, now)
          const filledSymbols: string[] = []
          let openError: string | null = null
          for (const symbol of picks) {
            const filled = openPaperLong(
              current,
              symbol,
              snap.quotes,
              now,
              attackReason(symbol, snap.quotes[symbol]),
            )
            if (filled.error || !filled.position) {
              openError = filled.error?.message ?? 'Could not open a paper seat.'
              break
            }
            current = filled.book
            filledSymbols.push(symbol)
          }
          actions = ruled.actions
          killActive = current.killActive
          tail =
            filledSymbols.length > 0
              ? `Opened paper ${filledSymbols.map((symbol) => `${symbol} $50`).join(', ')}.`
              : (openError ?? idleSeatNote(ruled.book))
          return current
        })
      })
      setNotice(`${rulesNotice(actions, snap.missing, killActive)} ${tail}`)
    } catch {
      setNotice('Could not reach Coinbase. The paper book was not changed.')
    } finally {
      setBusy(false)
    }
  }

  async function buyManual(symbol: string) {
    if (busy) return
    setBusy(true)
    try {
      const now = new Date()
      const snap = await refreshQuotes(WATCHLIST_SYMBOLS)
      const name = symbol.trim().toUpperCase()
      let actions: CloseAction[] = []
      let message = ''
      let killActive = false
      flushSync(() => {
        setBook((prev) => {
          const ruled = applyRules(prev, snap.quotes, now)
          const filled = openPaperLong(
            ruled.book,
            name,
            snap.quotes,
            now,
            `Manual paper buy $50 ${name} — watchlist`,
          )
          actions = ruled.actions
          killActive = filled.book.killActive
          message = filled.error
            ? `Manual buy: ${filled.error.message}`
            : `Manual paper buy filled: ${name} $50.`
          return filled.book
        })
      })
      setNotice(`${rulesNotice(actions, snap.missing, killActive)} ${message}`)
    } catch {
      setNotice('Could not reach Coinbase. The paper book was not changed.')
    } finally {
      setBusy(false)
    }
  }

  return {
    book,
    marked,
    quotes,
    busy,
    notice,
    cooldowns: listCooldowns(book),
    entryBlock: (symbol: string) => paperEntryBlock(book, symbol, quotes.quotes),
    runRules,
    analyzeAndAttack,
    buyManual,
  }
}
