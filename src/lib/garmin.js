// Garmin Connect (Personal API) integration.
// The app asks the "garmin-sync" bridge on Supabase for raw Garmin data and interprets it here.
// Garmin's response formats aren't fully documented, so the parsers search flexibly for the
// values we need. If something can't be read, the sync keeps a small debug summary.
import { useCallback, useState } from 'react'
import { supabase } from './supabase.js'
import { addDays, daysBetween, todayKey } from './dates.js'

export const ACTIVITY_KINDS = {
  any: 'Any workout',
  ride: 'Ride',
  run: 'Run',
  strength: 'Strength / gym',
  walk: 'Walk / hike',
  swim: 'Swim',
}

export function kindOf(typeKey = '') {
  const t = String(typeKey).toLowerCase()
  if (/cycl|bik|ride|gravel|mtb|virtual_ride/.test(t)) return 'ride'
  if (/run|treadmill/.test(t)) return 'run'
  if (/strength|weight|gym|hiit|cardio|fitness_equipment|crossfit|yoga|pilates/.test(t)) return 'strength'
  if (/walk|hik/.test(t)) return 'walk'
  if (/swim/.test(t)) return 'swim'
  return 'other'
}

export const KIND_ICON = { ride: '🚴', run: '🏃', strength: '🏋️', walk: '🥾', swim: '🏊', other: '⌚' }

// ── Requests ────────────────────────────────────────────────────────────────

function windows(start, end, max) {
  const out = []
  for (let a = start; a <= end; a = addDays(a, max)) {
    const b = addDays(a, max - 1)
    out.push([a, b < end ? b : end])
  }
  return out
}

export function buildPaths(start, end) {
  const paths = []
  for (const [a, b] of windows(start, end, 31)) paths.push(`/activitylist-service/activities/search/activities?start=0&limit=100&startDate=${a}&endDate=${b}`)
  for (const [a, b] of windows(start, end, 28)) paths.push(`/usersummary-service/stats/steps/daily/${a}/${b}`)
  for (const [a, b] of windows(start, end, 31)) paths.push(`/sleep-service/sleep/dailySleepSummariesByDate?startDate=${a}&endDate=${b}`)
  for (const [a, b] of windows(start, end, 31)) paths.push(`/wellness-service/wellness/bodyBattery/reports/daily?startDate=${a}&endDate=${b}`)
  paths.push(`/usersummary-service/v2/dailysummaries?startDate=${start}&endDate=${end}`)
  return paths
}

// ── Flexible parsing helpers ────────────────────────────────────────────────

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)

// Find the list of records in a response: the response itself, or the first array of objects inside it
export function records(value, depth = 0) {
  if (Array.isArray(value)) return value.filter(isObj)
  if (!isObj(value) || depth > 2) return []
  for (const key of ['data', 'values', 'activities', 'activityList', 'dailySleepSummaries', 'summaries', 'items', 'results', 'entries']) {
    if (Array.isArray(value[key])) return value[key].filter(isObj)
  }
  for (const v of Object.values(value)) {
    const r = records(v, depth + 1)
    if (r.length) return r
  }
  return []
}

// Breadth-first search for the first key (from `keys`) whose value passes `test`
export function deepFind(obj, keys, test = () => true, maxDepth = 3) {
  let level = [obj]
  for (let d = 0; d <= maxDepth && level.length; d++) {
    const next = []
    for (const o of level) {
      if (!isObj(o)) continue
      for (const k of keys) if (k in o && o[k] !== null && test(o[k])) return o[k]
      for (const v of Object.values(o)) if (isObj(v)) next.push(v)
    }
    level = next
  }
  return undefined
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)
const dateOf = (r) => deepFind(r, ['calendarDate', 'date', 'summaryDate', 'sleepDate', 'startTimeLocal', 'startDate'], isDate)?.slice(0, 10)

function parseSleep(r) {
  let seconds = deepFind(r, ['sleepTimeSeconds', 'totalSleepSeconds', 'sleepTimeInSeconds', 'totalSleepTimeSeconds', 'sleepDurationInSeconds', 'durationInSeconds'], isNum)
  if (seconds === undefined) {
    const min = deepFind(r, ['totalSleepMinutes', 'sleepMinutes'], isNum)
    if (min !== undefined) seconds = min * 60
  }
  let score = deepFind(r, ['overallSleepScore', 'sleepScore', 'overall', 'overallScore'], (v) => isNum(v) || (isObj(v) && isNum(v.value)))
  if (isObj(score)) score = score.value
  return { sleepMin: seconds !== undefined ? Math.round(seconds / 60) : undefined, sleepScore: isNum(score) && score <= 100 ? score : undefined }
}

export function parseActivity(r) {
  const type = deepFind(r, ['typeKey'], (v) => typeof v === 'string') || deepFind(r, ['activityType', 'type'], (v) => typeof v === 'string') || ''
  const seconds = deepFind(r, ['duration', 'movingDuration', 'elapsedDuration', 'durationInSeconds'], isNum)
  const meters = deepFind(r, ['distance', 'distanceInMeters'], isNum)
  return {
    id: String(deepFind(r, ['activityId', 'id', 'summaryId'], (v) => isNum(v) || typeof v === 'string') ?? `${dateOf(r)}-${type}-${seconds}`),
    date: dateOf(r),
    name: deepFind(r, ['activityName', 'name', 'title'], (v) => typeof v === 'string') || type || 'Activity',
    kind: kindOf(type),
    type,
    minutes: seconds !== undefined ? Math.round(seconds / 60) : 0,
    km: meters !== undefined ? Math.round(meters / 100) / 10 : 0,
    avgHr: deepFind(r, ['averageHR', 'averageHeartRate', 'avgHr'], isNum),
    calories: deepFind(r, ['calories', 'activeKilocalories'], isNum),
  }
}

export function parseAll(results) {
  const days = {}
  const activities = []
  const debug = {}
  const day = (d) => (days[d] ??= {})

  for (const [path, value] of Object.entries(results || {})) {
    const name = path.split('?')[0].split('/').slice(1, 4).join('/')
    if (isObj(value) && value.error) {
      debug[name] = { error: value.error, body: value.body }
      continue
    }
    const recs = records(value)
    debug[name] = { count: recs.length, keys: recs[0] ? Object.keys(recs[0]).slice(0, 25) : isObj(value) ? Object.keys(value).slice(0, 15) : typeof value }

    for (const r of recs) {
      if (path.startsWith('/activitylist-service/')) {
        const a = parseActivity(r)
        if (a.date) activities.push(a)
        continue
      }
      const d = dateOf(r)
      if (!d) continue
      if (path.includes('/steps/')) {
        const steps = deepFind(r, ['totalSteps', 'steps', 'stepCount', 'value'], isNum)
        if (steps !== undefined) day(d).steps = steps
      } else if (path.startsWith('/sleep-service/')) {
        const s = parseSleep(r)
        if (s.sleepMin) day(d).sleepMin = s.sleepMin
        if (s.sleepScore) day(d).sleepScore = s.sleepScore
      } else if (path.includes('bodyBattery')) {
        const hi = deepFind(r, ['bodyBatteryHighestValue', 'highestValue', 'maxValue', 'max'], isNum)
        const lo = deepFind(r, ['bodyBatteryLowestValue', 'lowestValue', 'minValue', 'min'], isNum)
        if (hi !== undefined && hi <= 100) day(d).bbHigh = hi
        if (lo !== undefined && lo <= 100) day(d).bbLow = lo
      } else if (path.includes('dailysummaries')) {
        const steps = deepFind(r, ['totalSteps', 'steps'], isNum)
        const rhr = deepFind(r, ['restingHeartRate', 'restingHeartRateValue', 'restingHR', 'restingHr'], isNum)
        const stress = deepFind(r, ['averageStressLevel', 'avgStressLevel', 'overallStressLevel', 'averageStress'], isNum)
        if (steps !== undefined && day(d).steps === undefined) day(d).steps = steps
        if (rhr !== undefined) day(d).restingHr = rhr
        if (stress !== undefined && stress >= 0) day(d).stress = stress
        const s = parseSleep(r)
        if (s.sleepMin && !day(d).sleepMin) day(d).sleepMin = s.sleepMin
      }
    }
  }
  return { days, activities, debug }
}

// ── Habit rules ─────────────────────────────────────────────────────────────
// habit.garmin = { type: 'activity', kind, minMinutes } | { type: 'steps', min } | { type: 'sleep', minHours }

export function describeRule(rule) {
  if (!rule) return ''
  if (rule.type === 'activity') return `${ACTIVITY_KINDS[rule.kind] || 'Workout'} ≥ ${rule.minMinutes} min`
  if (rule.type === 'steps') return `${Number(rule.min).toLocaleString()}+ steps`
  if (rule.type === 'sleep') return `${rule.minHours}+ h sleep`
  return ''
}

export function ruleMet(garmin, rule, day) {
  if (!garmin || !rule) return false
  if (rule.type === 'activity') {
    // 'any' counts every workout except walks
    const mins = garmin.activities.filter((a) => a.date === day && (rule.kind === 'any' ? a.kind !== 'walk' : a.kind === rule.kind)).reduce((n, a) => n + a.minutes, 0)
    return mins >= (rule.minMinutes || 1)
  }
  if (rule.type === 'steps') return (garmin.days[day]?.steps || 0) >= rule.min
  if (rule.type === 'sleep') return (garmin.days[day]?.sleepMin || 0) >= rule.minHours * 60
  return false
}

// ── Summaries for the UI ────────────────────────────────────────────────────

export function garminRange(garmin, start, end) {
  if (!garmin?.enabled) return null
  const acts = garmin.activities.filter((a) => a.date >= start && a.date <= end)
  const ds = Object.entries(garmin.days).filter(([d]) => d >= start && d <= end).map(([, v]) => v)
  const avg = (k) => {
    const v = ds.map((x) => x[k]).filter((x) => x !== undefined)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
  }
  const byKind = {}
  acts.forEach((a) => {
    byKind[a.kind] ??= { count: 0, minutes: 0, km: 0 }
    byKind[a.kind].count++
    byKind[a.kind].minutes += a.minutes
    byKind[a.kind].km += a.km
  })
  return {
    activities: acts.length,
    trainingMin: acts.reduce((n, a) => n + a.minutes, 0),
    km: Math.round(acts.reduce((n, a) => n + a.km, 0)),
    byKind,
    avgSteps: avg('steps'),
    avgSleepMin: avg('sleepMin'),
    avgSleepScore: avg('sleepScore'),
    avgRestingHr: avg('restingHr'),
  }
}

// ── Sync ────────────────────────────────────────────────────────────────────

async function readError(error) {
  let msg = error?.message || 'Unknown error'
  try {
    const body = await error.context?.json?.()
    if (body?.error) msg = body.error
  } catch {
    /* not JSON */
  }
  if (/not found|404/i.test(msg) || error?.context?.status === 404) msg = 'The Garmin bridge is not set up on Supabase yet (function "garmin-sync" not found).'
  if (/Failed to send a request|fetch/i.test(msg)) msg = 'Could not reach the Garmin bridge. Check that a function named exactly "garmin-sync" is deployed in Supabase and that "Verify JWT" is switched off for it.'
  return msg
}

export async function fetchGarmin(start, end) {
  const { data, error } = await supabase.functions.invoke('garmin-sync', { body: { paths: buildPaths(start, end) } })
  if (error) throw new Error(await readError(error))
  if (data?.error) throw new Error(data.error)
  return parseAll(data?.results)
}

export function useGarminSync(data, actions) {
  const [syncing, setSyncing] = useState(false)
  const sync = useCallback(
    async (days) => {
      const end = todayKey()
      const last = data.garmin?.lastSync?.slice(0, 10)
      const n = days || (last ? Math.min(60, Math.max(3, daysBetween(last, end) + 2)) : 60)
      const start = addDays(end, -(n - 1))
      setSyncing(true)
      try {
        const parsed = await fetchGarmin(start, end)
        actions.applyGarmin(parsed, start, end)
        return { ok: true, parsed }
      } catch (e) {
        actions.garminError(e.message)
        return { ok: false, error: e.message }
      } finally {
        setSyncing(false)
      }
    },
    [data.garmin?.lastSync] // eslint-disable-line react-hooks/exhaustive-deps
  )
  return { syncing, sync }
}
