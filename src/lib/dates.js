// Dates are stored as local "YYYY-MM-DD" strings so a day never shifts with time zones.
// Weeks run Monday → Sunday. Weekday numbers: 0 = Monday … 6 = Sunday.

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function toKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const todayKey = () => toKey(new Date())

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key, n) {
  const date = fromKey(key)
  date.setDate(date.getDate() + n)
  return toKey(date)
}

export const weekday = (key) => (fromKey(key).getDay() + 6) % 7
export const weekStart = (key) => addDays(key, -weekday(key))
export const monthKey = (key) => key.slice(0, 7)

export function monthStart(mKey) {
  return `${mKey}-01`
}

export function monthEnd(mKey) {
  const [y, m] = mKey.split('-').map(Number)
  return toKey(new Date(y, m, 0))
}

export function addMonths(mKey, n) {
  const [y, m] = mKey.split('-').map(Number)
  return toKey(new Date(y, m - 1 + n, 1)).slice(0, 7)
}

// All day keys from a to b inclusive
export function range(a, b) {
  const out = []
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d)
  return out
}

// Last `n` day keys, oldest first, ending at `end` (default today)
export function lastDays(n, end = todayKey()) {
  return range(addDays(end, -(n - 1)), end)
}

export function prettyDate(key, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return fromKey(key).toLocaleDateString('en-GB', opts)
}

export const shortDate = (key) => prettyDate(key, { day: 'numeric', month: 'short' })

export function daysBetween(a, b) {
  return Math.round((fromKey(b) - fromKey(a)) / 86400000)
}

export const daysUntil = (key) => daysBetween(todayKey(), key)

// 25 -> "25m", 135 -> "2h 15m"
export const fmtMinutes = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`)
