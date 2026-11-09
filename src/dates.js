// Dates are stored as local "YYYY-MM-DD" strings so a day never shifts with time zones.

export function toKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayKey() {
  return toKey(new Date())
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key, n) {
  const date = fromKey(key)
  date.setDate(date.getDate() + n)
  return toKey(date)
}

// Last `n` day keys, oldest first, ending today.
export function lastDays(n) {
  const today = todayKey()
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)))
}

export function prettyDate(key, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return fromKey(key).toLocaleDateString('en-GB', opts)
}

export function daysUntil(key) {
  const ms = fromKey(key) - fromKey(todayKey())
  return Math.round(ms / 86400000)
}
