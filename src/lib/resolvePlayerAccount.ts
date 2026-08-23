import { supabase } from './supabase'
import { normalizePhone, phonesEqual } from './phoneUtils'

export type ResolvedPlayerAccount = {
  id: string
  user_id: string | null
  name: string | null
  phone_number: string | null
}

const ACCOUNT_FIELDS = 'id, user_id, name, phone_number'

function pickBestAccount(
  rows: ResolvedPlayerAccount[],
  opts?: { accountId?: string | null; preferredName?: string | null; phoneNumber?: string | null },
): ResolvedPlayerAccount | null {
  if (!rows.length) return null
  if (opts?.accountId) {
    const byId = rows.find((r) => r.id === opts.accountId)
    if (byId) return byId
  }
  if (opts?.phoneNumber) {
    const byPhone = rows.find((r) => phonesEqual(r.phone_number, opts.phoneNumber))
    if (byPhone) return byPhone
  }
  if (opts?.preferredName) {
    const preferred = opts.preferredName.trim().toLowerCase()
    const exact = rows.find((r) => (r.name || '').trim().toLowerCase() === preferred)
    if (exact) return exact
    const prefix = preferred.split(/\s*\/\s*/)[0]
    const partial = rows.find((r) => (r.name || '').trim().toLowerCase().startsWith(prefix))
    if (partial) return partial
  }
  if (rows.length === 1) return rows[0]
  // Never guess between multiple real accounts without phone/id/name hint
  return null
}

/** Find player_accounts by phone (+351…, 351…, or local digits). */
export async function fetchPlayerAccountByPhone(
  phone: string,
): Promise<ResolvedPlayerAccount | null> {
  const normalized = normalizePhone(phone)
  if (!normalized) return null

  const exactCandidates = [normalized, `+${normalized}`]
  for (const candidate of exactCandidates) {
    const { data } = await supabase
      .from('player_accounts')
      .select(ACCOUNT_FIELDS)
      .eq('phone_number', candidate)
      .maybeSingle()
    if (data) return data as ResolvedPlayerAccount
  }

  const last9 = normalized.slice(-9)
  if (last9.length >= 9) {
    const { data: suffixMatches } = await supabase
      .from('player_accounts')
      .select(ACCOUNT_FIELDS)
      .ilike('phone_number', `%${last9}`)
      .limit(10)

    const matches = (suffixMatches || []).filter((r) =>
      phonesEqual(r.phone_number, phone),
    ) as ResolvedPlayerAccount[]

    if (matches.length === 1) return matches[0]
    if (matches.length > 1) {
      return pickBestAccount(matches, { phoneNumber: normalized }) || matches[0]
    }
  }

  return null
}

/** Resolve the correct player_accounts row when user_id may map to multiple accounts. */
export async function resolvePlayerAccountForUser(
  userId: string,
  opts?: { accountId?: string | null; preferredName?: string | null; phoneNumber?: string | null },
): Promise<ResolvedPlayerAccount | null> {
  if (opts?.accountId) {
    const { data } = await supabase
      .from('player_accounts')
      .select(ACCOUNT_FIELDS)
      .eq('id', opts.accountId)
      .maybeSingle()
    if (data) return data as ResolvedPlayerAccount
  }

  if (opts?.phoneNumber) {
    const byPhone = await fetchPlayerAccountByPhone(opts.phoneNumber)
    if (byPhone) return byPhone
  }

  const { data: byUser, error } = await supabase
    .from('player_accounts')
    .select(ACCOUNT_FIELDS)
    .eq('user_id', userId)

  if (error) {
    console.warn('[resolvePlayerAccount] query error:', error.message)
    return null
  }

  return pickBestAccount((byUser || []) as ResolvedPlayerAccount[], opts)
}
