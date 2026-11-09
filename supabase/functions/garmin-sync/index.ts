// Grow ↔ Garmin bridge (Supabase Edge Function).
//
// Keeps your Garmin Personal API key secret (stored as the GARMIN_API_KEY secret),
// swaps it for a 24-hour access token, and fetches the Garmin data the app asks for.
// It only allows read requests to known Garmin data paths, and only for logged-in users
// of this Supabase project (optionally only the email in GARMIN_ALLOWED_EMAIL).
// All interpretation of the data happens in the app, so this file rarely needs changing.

import { createClient } from 'npm:@supabase/supabase-js@2'

const BASE = 'https://personal.connectapi.garmin.com'
const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token'
const ALLOWED_PREFIXES = [
  '/activitylist-service/',
  '/activity-service/activity/',
  '/usersummary-service/',
  '/sleep-service/',
  '/wellness-service/',
  '/hrv-service/',
  '/userprofile-service/userprofile/settings',
]

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Token is reused while this function instance stays warm
let cached: { token: string; exp: number } | null = null

function jwtExp(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return (payload.exp || 0) * 1000
  } catch {
    return Date.now() + 60 * 60 * 1000
  }
}

async function getToken(key: string): Promise<string> {
  if (cached && cached.exp - Date.now() > 60 * 60 * 1000) return cached.token
  const res = await fetch(BASE + TOKEN_PATH, { method: 'POST', headers: { Accept: '*/*', Authorization: `ApiKey ${key}` } })
  const text = (await res.text()).trim()
  if (!res.ok) throw new Error(`Garmin did not accept the API key (HTTP ${res.status}). ${text.slice(0, 200)}`)
  cached = { token: text, exp: jwtExp(text) }
  return text
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  try {
    // Who is asking?
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return json({ error: 'Not logged in' }, 401)
    const allowed = Deno.env.get('GARMIN_ALLOWED_EMAIL')
    if (allowed && user.email?.toLowerCase() !== allowed.toLowerCase()) return json({ error: 'This account may not use Garmin sync' }, 403)

    const key = Deno.env.get('GARMIN_API_KEY')
    if (!key) return json({ error: 'The GARMIN_API_KEY secret is not set in Supabase' }, 500)

    const body = await req.json().catch(() => ({}))
    const paths: string[] = Array.isArray(body.paths) ? body.paths.slice(0, 30) : []
    if (!paths.length) return json({ error: 'No paths requested' }, 400)

    const token = await getToken(key)
    const results: Record<string, unknown> = {}
    await Promise.all(
      paths.map(async (path) => {
        if (typeof path !== 'string' || !ALLOWED_PREFIXES.some((p) => path.startsWith(p)) || path.includes('..')) {
          results[path] = { error: 'path not allowed' }
          return
        }
        const res = await fetch(BASE + path, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })
        if (res.status === 401) cached = null
        const text = await res.text()
        if (!res.ok) {
          results[path] = { error: `HTTP ${res.status}`, body: text.slice(0, 300) }
          return
        }
        try {
          results[path] = text ? JSON.parse(text) : null
        } catch {
          results[path] = { error: 'not JSON', body: text.slice(0, 300) }
        }
      }),
    )
    return json({ ok: true, results })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502)
  }
})
