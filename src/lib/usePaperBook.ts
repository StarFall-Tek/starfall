import { useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { WATCHLIST_SYMBOLS } from '../data/watchlist'
import { useMarketWatch } from './liveWatch'
import {
  applyQuickRotates,
  applyRules,
  attackReason,
  bankEarlySeat,
  flattestSeat,
  listCooldowns,
  markBook,
  openPaperLong,
  paperEntryBlock,
  pickCalmEntries,
  pickQuickEntries,
  quickEntryReason,
  rotateFlatSeat,
  withDayRoll,
  type CloseAction,
  type PaperBook,
} from './paperEngine'
import { loadBook, saveBook } from './paperStorage'
import { quickScalpEnabled } from './quickMode'
import { refreshQuotes, useQuoteSnap } from './quoteStore'

function rulesNotice(actions: CloseAction[], missing: string[], killActive: boolean): string {
  const parts: string[] = []
  if (actions.length === 0) {
    parts.push('Rules checked on Coinbase prices. No take-profit, stop, or daily-kill sell.')
  } else {
    const bits = actions.map((action) => {
      return `${action.symbol} ${scalpLabel(action.kind)}`
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

function idleSeatNote(book: PaperBook, quick: boolean): string {
  if (book.killActive) return 'No new seat — daily kill is on.'
  if (book.positions.length >= 5) return 'No new seat — 5/5 seats are full.'
  if (book.cashUsd < 50) return 'No new seat — cash is under $50.'
  if (quick) {
    return 'No new seat — no liquid mover cleared the day filter, cooldown, and seat cap.'
  }
  return 'No new seat — no calm watchlist name cleared the spike filter, cooldown, and meme cap.'
}

function scalpLabel(kind: CloseAction['kind']): string {
  if (kind === 'take_profit') return 'take-profit'
  if (kind === 'stop_loss') return 'stop'
  if (kind === 'quick_scalp') return 'gut/quick-scalp'
  return 'daily kill'
}

export function usePaperBook() {
  const [book, setBook] = useState<PaperBook>(() => loadBook())
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [rolledStamp, setRolledStamp] = useState<string | null>(null)
  const quotes = useQuoteSnap()
  useMarketWatch(WATCHLIST_SYMBOLS)
  if (quotes.fetchedAt && quotes.fetchedAt !== rolledStamp) {
    setRolledStamp(quotes.fetchedAt)
    const summary = markBook(book, quotes.quotes).summary
    const equity =
      summary.marksComplete || book.positions.length === 0 ? summary.bookMarkUsd : null
    const rolled = withDayRoll(book, equity, new Date())
    if (rolled !== book) setBook(rolled)
  }
  useEffect(() => {
    saveBook(book)
  }, [book])

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
      const quick = quickScalpEnabled()
      const snap = await refreshQuotes(WATCHLIST_SYMBOLS)
      let actions: CloseAction[] = []
      let tail = ''
      let killActive = false
      flushSync(() => {
        setBook((prev) => {
          const ruled = applyRules(prev, snap.quotes, now)
          let current = ruled.book
          const scalpActions: CloseAction[] = []
          const rotatedInto: string[] = []
          if (quick) {
            const rotated = applyQuickRotates(current, snap.quotes, now)
            current = rotated.book
            scalpActions.push(...rotated.actions)
            rotatedInto.push(...rotated.opened)
          }
          const picks = quick
            ? pickQuickEntries(current, snap.quotes, now)
            : pickCalmEntries(current, snap.quotes, now)
          const filledSymbols: string[] = []
          let openError: string | null = null
          for (const symbol of picks) {
            const filled = openPaperLong(
              current,
              symbol,
              snap.quotes,
              now,
              quick
                ? quickEntryReason(symbol, snap.quotes[symbol])
                : attackReason(symbol, snap.quotes[symbol]),
            )
            if (filled.error || !filled.position) {
              openError = filled.error?.message ?? 'Could not open a paper seat.'
              break
            }
            current = filled.book
            filledSymbols.push(symbol)
          }
          actions = [...ruled.actions, ...scalpActions]
          killActive = current.killActive
          const rotatedLine =
            rotatedInto.length > 0
              ? `Gut/quick-scalp rotated into ${rotatedInto.join(', ')}.`
              : ''
          const fillLine =
            filledSymbols.length > 0
              ? `${quick ? 'Gut/quick-scalp in' : 'Opened paper'} ${filledSymbols
                  .map((symbol) => `${symbol} $50`)
                  .join(', ')}.`
              : (openError ?? idleSeatNote(current, quick))
          tail = [rotatedLine, fillLine].filter(Boolean).join(' ')
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

  async function bankEarly(positionId: string) {
    if (busy) return
    if (!quickScalpEnabled()) {
      setNotice('Turn on quick in/out to bank early. Full take-profit still runs from Run rules.')
      return
    }
    setBusy(true)
    try {
      const now = new Date()
      const snap = await refreshQuotes(WATCHLIST_SYMBOLS)
      let message = ''
      flushSync(() => {
        setBook((prev) => {
          const ruled = applyRules(prev, snap.quotes, now)
          const still = ruled.book.positions.find((position) => position.id === positionId)
          if (!still) {
            message = `${rulesNotice(ruled.actions, snap.missing, ruled.book.killActive)} That seat was already closed by the hard rules.`
            return ruled.book
          }
          const banked = bankEarlySeat(ruled.book, positionId, snap.quotes, now)
          message = banked.error
            ? `${rulesNotice(ruled.actions, snap.missing, ruled.book.killActive)} Bank early: ${banked.error}`
            : `${rulesNotice(ruled.actions, snap.missing, banked.book.killActive)} Gut/quick-scalp banked ${still.symbol} early. The full take-profit was not the reason.`
          return banked.book
        })
      })
      setNotice(message)
    } catch {
      setNotice('Could not reach Coinbase. The paper book was not changed.')
    } finally {
      setBusy(false)
    }
  }

  async function rotateSeat(positionId: string) {
    if (busy) return
    if (!quickScalpEnabled()) {
      setNotice('Turn on quick in/out to rotate a flat seat. Stops and take-profit still run from Run rules.')
      return
    }
    setBusy(true)
    try {
      const now = new Date()
      const snap = await refreshQuotes(WATCHLIST_SYMBOLS)
      let message = ''
      flushSync(() => {
        setBook((prev) => {
          const ruled = applyRules(prev, snap.quotes, now)
          const still = ruled.book.positions.find((position) => position.id === positionId)
          if (!still) {
            message = `${rulesNotice(ruled.actions, snap.missing, ruled.book.killActive)} That seat was already closed by the hard rules.`
            return ruled.book
          }
          const rotated = rotateFlatSeat(ruled.book, positionId, null, snap.quotes, now)
          const lead = rulesNotice(
            [...ruled.actions, ...rotated.extra],
            snap.missing,
            rotated.book.killActive,
          )
          message = rotated.error
            ? `${lead} Rotate: ${rotated.error}`
            : `${lead} Gut/quick-scalp rotated ${still.symbol} into ${rotated.opened}.`
          return rotated.book
        })
      })
      setNotice(message)
    } catch {
      setNotice('Could not reach Coinbase. The paper book was not changed.')
    } finally {
      setBusy(false)
    }
  }

  async function quickSeat(symbol: string) {
    if (busy) return
    if (!quickScalpEnabled()) {
      setNotice('Turn on quick in/out to seat a mover from the tape. Manual $50 buy still works.')
      return
    }
    setBusy(true)
    try {
      const now = new Date()
      const snap = await refreshQuotes(WATCHLIST_SYMBOLS)
      const name = symbol.trim().toUpperCase()
      let message = ''
      flushSync(() => {
        setBook((prev) => {
          const ruled = applyRules(prev, snap.quotes, now)
          const lead = (bookNow: PaperBook, extra: CloseAction[] = []) =>
            rulesNotice([...ruled.actions, ...extra], snap.missing, bookNow.killActive)
          const block = paperEntryBlock(ruled.book, name, snap.quotes, now)
          if (!block) {
            const filled = openPaperLong(
              ruled.book,
              name,
              snap.quotes,
              now,
              quickEntryReason(name, snap.quotes[name]),
            )
            message = filled.error
              ? `${lead(ruled.book)} Quick seat: ${filled.error.message}`
              : `${lead(filled.book)} Gut/quick-scalp in ${name} $50.`
            return filled.book
          }
          if (block.code === 'seats') {
            const flat = flattestSeat(ruled.book, snap.quotes)
            if (!flat) {
              message = `${lead(ruled.book)} ${block.message} No flat or dead seat to rotate — working seats stay on their take-profit.`
              return ruled.book
            }
            const rotated = rotateFlatSeat(ruled.book, flat.id, name, snap.quotes, now)
            message = rotated.opened
              ? `${lead(rotated.book, rotated.extra)} Gut/quick-scalp rotated ${flat.symbol} into ${rotated.opened}.`
              : `${lead(rotated.book, rotated.extra)} Rotate: ${rotated.error ?? 'Could not rotate.'}`
            return rotated.book
          }
          message = `${lead(ruled.book)} Quick seat: ${block.message}`
          return ruled.book
        })
      })
      setNotice(message)
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
    bankEarly,
    rotateSeat,
    quickSeat,
  }
}
