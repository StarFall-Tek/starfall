import { useSyncExternalStore } from 'react'

const KEY = 'starfall.quickScalp.v1'

function readEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

let enabled = readEnabled()
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

export function quickScalpEnabled(): boolean {
  return enabled
}

export function setQuickScalpEnabled(next: boolean): void {
  enabled = next
  try {
    localStorage.setItem(KEY, next ? 'on' : 'off')
  } catch {
    // Private mode should not crash the desk.
  }
  emit()
}

export function subscribeQuickScalp(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useQuickScalp(): boolean {
  return useSyncExternalStore(subscribeQuickScalp, quickScalpEnabled, () => false)
}
