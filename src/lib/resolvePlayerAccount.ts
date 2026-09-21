import { supabase, PlayerAccount } from './supabase'
import { normalizePhone, phonesEqual, phoneLookupCandidates, normalizePhoneKey } from './phoneUtils'

// Linha completa de player_accounts (não só id/user_id/name/phone_number).
// Evita uma segunda ida à BD (round-trip extra) só para buscar o resto dos
// campos depois de resolver a conta — impacto direto no tempo de arranque da app.
export type ResolvedPlayerAccount = PlayerAccount

const ACCOUNT_FIELDS = '*'

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
  const candidates = phoneLookupCandidates(phone)
  if (!normalized && candidates.length === 0) return null

  for (const candidate of candidates) {
    const { data } = await supabase
      .from('player_accounts')
      .select(ACCOUNT_FIELDS)
      .eq('phone_number', candidate)
      .maybeSingle()
    if (data) return data as ResolvedPlayerAccount
  }

  const key = normalizePhoneKey(phone)
  const last9 = (key || normalized).slice(-9)
  if (last9.length >= 9) {
    const { data: suffixMatches } = await supabase
      .from('player_accounts')
      .select(ACCOUNT_FIELDS)
      .ilike('phone_number', `%${last9}`)
      .limit(20)

    const rows = (suffixMatches || []) as ResolvedPlayerAccount[]
    const exact = rows.filter((r) => phonesEqual(r.phone_number, phone))
    if (exact.length === 1) return exact[0]
    if (exact.length > 1) {
      return pickBestAccount(exact, { phoneNumber: normalized || phone }) || exact[0]
    }

    // FR/ES dial mix-up: same national body, different country code
    const byNational = rows.filter((r) => normalizePhoneKey(r.phone_number) === key)
    if (byNational.length === 1) return byNational[0]
    if (byNational.length > 1) {
      return pickBestAccount(byNational, { phoneNumber: normalized || phone }) || byNational[0]
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
