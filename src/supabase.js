import { createClient } from '@supabase/supabase-js'

// Both values are public by design: the database itself only lets a logged-in
// user read and write their own row (see the "Own data only" policy).
const SUPABASE_URL = 'https://paktxzahmgtexnqxeaok.supabase.co'
const SUPABASE_KEY = 'sb_publishable_dEBcjwsf--43aIM_WwIL4w_rWd-tARH'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Usernames are turned into the account email behind the scenes.
const USERNAMES = {
  vugie: 'vugiestudios@gmail.com',
}

export function usernameToEmail(username) {
  const u = username.trim().toLowerCase()
  if (u.includes('@')) return u
  return USERNAMES[u] || `${u}@grow.app`
}
