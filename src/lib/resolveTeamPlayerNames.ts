/**
 * Resolve real person names for match teams / individual players.
 * Uses get_tournament_player_names (SECURITY DEFINER, bypasses RLS) + player_accounts.
 * Nested players joins often fail for cross-tournament team refs — never rely on them alone.
 */
import { supabase } from './supabase'
import { isLikelyTeamLabel, parsePersonNamesFromTeamLabel } from './matchPlayerNames'

export type TeamPlayerNames = {
  player1_name?: string
  player2_name?: string
  player1_avatar?: string | null
  player2_avatar?: string | null
}

export type ResolvedPerson = {
  name?: string
  avatar_url?: string | null
}

function cleanPersonName(name: string | null | undefined, teamName?: string | null): string | undefined {
  if (!name?.trim()) return undefined
  let n = name.trim()
  // Account names sometimes embed club paths: "Carlos/Padel1/BoostPadel" → "Carlos"
  if ((n.match(/\//g) || []).length >= 2) {
    const primary = n.split(/\s*\/\s*/)[0]?.trim()
    if (primary && !isLikelyTeamLabel(primary, teamName)) return primary
  }
  if (isLikelyTeamLabel(n, teamName)) return undefined
  return n
}

/**
 * Build a map team_id → { player1_name, player2_name, avatars }
 * for all teams in `teamIds`.
 */
export async function resolveTeamPlayerNamesMap(
  teamIds: Iterable<string>,
): Promise<Map<string, TeamPlayerNames>> {
  const result = new Map<string, TeamPlayerNames>()
  const ids = [...new Set([...teamIds].filter(Boolean))]
  if (ids.length === 0) return result

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, tournament_id, player1_id, player2_id')
    .in('id', ids)

  if (!teams?.length) return result

  const playerIds = new Set<string>()
  const tournamentIds = new Set<string>()
  for (const t of teams as any[]) {
    if (t.player1_id) playerIds.add(t.player1_id)
    if (t.player2_id) playerIds.add(t.player2_id)
    if (t.tournament_id) tournamentIds.add(t.tournament_id)
  }

  // 1) RPC per tournament — bypasses RLS, returns player_accounts names when linked
  const namesByPlayerId = new Map<string, string>()
  await Promise.all(
    [...tournamentIds].map(async (tid) => {
      try {
        const { data } = await supabase.rpc('get_tournament_player_names', { tournament_uuid: tid })
        ;(data || []).forEach((p: any) => {
          if (p?.player_id && p?.player_name) namesByPlayerId.set(p.player_id, String(p.player_name))
        })
      } catch (err) {
        console.warn('[resolveTeamPlayerNames] RPC failed for tournament', tid, err)
      }
    }),
  )

  // 2) Direct players fetch (account link + fallback name; may be partial under RLS)
  const playerMeta = new Map<string, { name?: string; player_account_id?: string | null }>()
  const accountIds = new Set<string>()
  if (playerIds.size > 0) {
    const { data: players } = await supabase
      .from('players')
      .select('id, name, player_account_id')
      .in('id', Array.from(playerIds))
    ;(players || []).forEach((p: any) => {
      playerMeta.set(p.id, p)
      if (p.player_account_id) accountIds.add(p.player_account_id)
      if (p.name && !namesByPlayerId.has(p.id)) namesByPlayerId.set(p.id, p.name)
    })
  }

  // 3) player_accounts — authoritative display name + avatar
  const accountById = new Map<string, { name: string; avatar_url: string | null }>()
  if (accountIds.size > 0) {
    const { data: accounts } = await supabase
      .from('player_accounts')
      .select('id, name, avatar_url')
      .in('id', Array.from(accountIds))
    ;(accounts || []).forEach((a: any) => {
      if (a?.id && a?.name) accountById.set(a.id, { name: a.name, avatar_url: a.avatar_url ?? null })
    })
  }

  for (const t of teams as any[]) {
    const pick = (playerId: string | null | undefined): ResolvedPerson => {
      if (!playerId) return {}
      const meta = playerMeta.get(playerId)
      const acc = meta?.player_account_id ? accountById.get(meta.player_account_id) : null
      if (acc?.name) return { name: acc.name, avatar_url: acc.avatar_url }
      const raw = namesByPlayerId.get(playerId)
      const cleaned = cleanPersonName(raw, t.name)
      if (cleaned) return { name: cleaned, avatar_url: null }
      return {}
    }

    let p1 = pick(t.player1_id)
    let p2 = pick(t.player2_id)

    // Last resort: parse "Ana / Pedro" or "Dinis-Carlos" style team labels into people
    if (!p1.name || !p2.name) {
      const [a, b] = parsePersonNamesFromTeamLabel(t.name)
      if (!p1.name && a) p1 = { ...p1, name: a }
      if (!p2.name && b) p2 = { ...p2, name: b }
    }

    result.set(t.id, {
      player1_name: cleanPersonName(p1.name, t.name),
      player2_name: cleanPersonName(p2.name, t.name),
      player1_avatar: p1.avatar_url ?? null,
      player2_avatar: p2.avatar_url ?? null,
    })
  }

  return result
}

/**
 * Resolve display names for individual (non-team) match players via player_accounts.
 */
export async function resolveIndividualPlayerNames(
  players: Array<{ id?: string | null; name?: string | null }>,
): Promise<Map<string, ResolvedPerson>> {
  const result = new Map<string, ResolvedPerson>()
  const ids = [...new Set(players.map((p) => p.id).filter(Boolean))] as string[]
  if (ids.length === 0) return result

  const { data: rows } = await supabase
    .from('players')
    .select('id, name, player_account_id')
    .in('id', ids)

  const accountIds = new Set<string>()
  const byId = new Map<string, { name?: string; player_account_id?: string | null }>()
  ;(rows || []).forEach((p: any) => {
    byId.set(p.id, p)
    if (p.player_account_id) accountIds.add(p.player_account_id)
  })

  const accountById = new Map<string, { name: string; avatar_url: string | null }>()
  if (accountIds.size > 0) {
    const { data: accounts } = await supabase
      .from('player_accounts')
      .select('id, name, avatar_url')
      .in('id', Array.from(accountIds))
    ;(accounts || []).forEach((a: any) => {
      if (a?.id && a?.name) accountById.set(a.id, { name: a.name, avatar_url: a.avatar_url ?? null })
    })
  }

  for (const id of ids) {
    const meta = byId.get(id)
    const acc = meta?.player_account_id ? accountById.get(meta.player_account_id) : null
    const fallback = players.find((p) => p.id === id)?.name || meta?.name
    const name = cleanPersonName(acc?.name || fallback)
    if (name) result.set(id, { name, avatar_url: acc?.avatar_url ?? null })
  }

  return result
}

/** True if a display name is usable on a match ball (real person, not team/placeholder). */
export function isUsablePlayerDisplayName(name: string | null | undefined, teamName?: string | null): boolean {
  return Boolean(cleanPersonName(name, teamName))
}

/**
 * Prefer client-resolved names (RPC + player_accounts) over edge/raw names when the latter
 * are missing or look like team labels. Keeps all other fallback fields intact.
 */
export function preferResolvedMatchNames<T extends {
  id: string
  team1_name?: string | null
  team2_name?: string | null
  player1_name?: string
  player2_name?: string
  player3_name?: string
  player4_name?: string
  player1_avatar?: string | null
  player2_avatar?: string | null
  player3_avatar?: string | null
  player4_avatar?: string | null
}>(preferred: T | undefined, fallback: T): T {
  if (!preferred) return fallback

  const team1 = preferred.team1_name || fallback.team1_name
  const team2 = preferred.team2_name || fallback.team2_name

  const pickName = (pref?: string, fal?: string, team?: string | null) => {
    if (isUsablePlayerDisplayName(pref, team)) return pref
    if (isUsablePlayerDisplayName(fal, team)) return fal
    return pref || fal
  }
  const pickAvatar = (
    prefAvatar?: string | null,
    falAvatar?: string | null,
    prefName?: string,
    team?: string | null,
  ) => {
    if (isUsablePlayerDisplayName(prefName, team) && prefAvatar) return prefAvatar
    return prefAvatar || falAvatar
  }

  const p1 = pickName(preferred.player1_name, fallback.player1_name, team1)
  const p2 = pickName(preferred.player2_name, fallback.player2_name, team1)
  const p3 = pickName(preferred.player3_name, fallback.player3_name, team2)
  const p4 = pickName(preferred.player4_name, fallback.player4_name, team2)

  return {
    ...fallback,
    player1_name: p1,
    player2_name: p2,
    player3_name: p3,
    player4_name: p4,
    player1_avatar: pickAvatar(preferred.player1_avatar, fallback.player1_avatar, preferred.player1_name, team1),
    player2_avatar: pickAvatar(preferred.player2_avatar, fallback.player2_avatar, preferred.player2_name, team1),
    player3_avatar: pickAvatar(preferred.player3_avatar, fallback.player3_avatar, preferred.player3_name, team2),
    player4_avatar: pickAvatar(preferred.player4_avatar, fallback.player4_avatar, preferred.player4_name, team2),
  }
}
