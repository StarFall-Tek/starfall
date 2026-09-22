import { createSeedBook } from '../data/seedBook'
import type { PaperBook } from './paperEngine'

export const PAPER_BOOK_KEY = 'starfall.paperBook.v1'

export function parseStoredBook(raw: string | null, now = new Date()): PaperBook {
  if (!raw) return createSeedBook(now)
  try {
    const parsed = JSON.parse(raw) as Partial<PaperBook>
    if (
      parsed.version !== 1 ||
      typeof parsed.cashUsd !== 'number' ||
      !Array.isArray(parsed.positions) ||
      !Array.isArray(parsed.journal) ||
      parsed.cooldowns == null ||
      typeof parsed.cooldowns !== 'object'
    ) {
      return createSeedBook(now)
    }
    return parsed as PaperBook
  } catch {
    return createSeedBook(now)
  }
}

export function loadBook(now = new Date()): PaperBook {
  if (typeof localStorage === 'undefined') return createSeedBook(now)
  try {
    return parseStoredBook(localStorage.getItem(PAPER_BOOK_KEY), now)
  } catch {
    return createSeedBook(now)
  }
}

export function saveBook(book: PaperBook): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PAPER_BOOK_KEY, JSON.stringify(book))
  } catch {
    // Private mode or a full disk should not crash the desk.
  }
}
