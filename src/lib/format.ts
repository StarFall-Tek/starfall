const ET = 'America/New_York'

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  let max = 2
  const min = 2
  if (abs > 0 && abs < 0.0001) max = 10
  else if (abs > 0 && abs < 1) max = 5
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  })
}

export function formatPct(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

export function formatQty(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 8
  return value.toLocaleString('en-US', { maximumFractionDigits: digits })
}

export function formatEt(date: Date): string {
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: ET,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date) + ' ET'
  )
}

/** Calendar day in New York, YYYY-MM-DD. */
export function etDayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ET,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function roundCash(value: number): number {
  return Math.round(value * 100) / 100
}
