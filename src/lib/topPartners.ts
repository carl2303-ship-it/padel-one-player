/**
 * ID-based "jogadores com quem mais joga" — shared by own + public profile.
 * Prefer account/player IDs over fragile name matching.
 */
import { supabase } from './supabase'
import {
  cleanPlayerDisplayName,
  getPartnerNamesFromMatch,
  isLikelyTeamLabel,
  namesMatch,
  partnerNameKey,
} from './matchPlayerNames'
import { resolveIndividualPlayerNames, resolveTeamPlayerNamesMap } from './resolveTeamPlayerNames'

export type TopPartner = {
  name: string
  count: number
  accountId?: string | null
  avatar_url?: string | null
}

function bump(
  agg: Map<string, TopPartner>,
  opts: {
    selfAccountId: string
    selfName?: string | null
    rawName?: string | null
    accountId?: string | null
    avatar_url?: string | null
  },
) {
  const { selfAccountId, selfName, rawName, accountId, avatar_url } = opts
  if (accountId && accountId === selfAccountId) return
  const name = cleanPlayerDisplayName(rawName) || (rawName || '').trim()
  if (!name || name === '?' || isLikelyTeamLabel(name)) return
  if (selfName && namesMatch(name, selfName)) return
  const key = accountId ? `id:${accountId}` : `n:${partnerNameKey(name)}`
  if (selfName && key === `n:${partnerNameKey(selfName)}`) return
  const prev = agg.get(key)
  if (prev) {
    prev.count += 1
    if (name.length > prev.name.length) prev.name = name
    if (!prev.avatar_url && avatar_url) prev.avatar_url = avatar_url
    if (!prev.accountId && accountId) prev.accountId = accountId
  } else {
    agg.set(key, { name, count: 1, accountId: accountId ?? null, avatar_url: avatar_url ?? null })
  }
}

/**
 * Count true partners (same team) for a player_accounts row.
 */
export async function fetchTopPartnersForAccount(
  accountId: string,
  playerName?: string | null,
  limit = 10,
): Promise<TopPartner[]> {
  if (!accountId) return []
  const agg = new Map<string, TopPartner>()

  // --- Open games (most reliable: positions + account ids) ---
  const { data: ogPlayers } = await supabase
    .from('open_game_players')
    .select('game_id')
    .eq('player_account_id', accountId)
    .eq('status', 'confirmed')

  if (ogPlayers?.length) {
    const ogGameIds = ogPlayers.map((p: any) => p.game_id)
    const { data: ogResults } = await supabase
      .from('open_game_results')
      .select('game_id')
      .in('game_id', ogGameIds)
      .eq('status', 'confirmed')

    if (ogResults?.length) {
      const resultIds = ogResults.map((r: any) => r.game_id)
      const { data: ogAllPlayers } = await supabase
        .from('open_game_players')
        .select('game_id, player_account_id, position, status')
        .in('game_id', resultIds)
        .eq('status', 'confirmed')

      const paIds = [...new Set((ogAllPlayers || []).map((p: any) => p.player_account_id).filter(Boolean))]
      const { data: accounts } = paIds.length
        ? await supabase.from('player_accounts').select('id, name, avatar_url').in('id', paIds)
        : { data: [] as any[] }
      const byId = new Map((accounts || []).map((a: any) => [a.id, a]))

      const byGame = new Map<string, any[]>()
      for (const p of ogAllPlayers || []) {
        const list = byGame.get(p.game_id) || []
        list.push(p)
        byGame.set(p.game_id, list)
      }

      for (const gameId of resultIds) {
        const slots = (byGame.get(gameId) || []).sort((a, b) => (a.position || 0) - (b.position || 0))
        if (slots.length < 4) continue
        const myIdx = slots.findIndex((p) => p.player_account_id === accountId)
        if (myIdx < 0) continue
        const partnerIdx = myIdx ^ 1
        const partnerPaId = slots[partnerIdx]?.player_account_id as string | undefined
        const info = partnerPaId ? byId.get(partnerPaId) : null
        bump(agg, {
          selfAccountId: accountId,
          selfName: playerName,
          rawName: info?.name,
          accountId: partnerPaId,
          avatar_url: info?.avatar_url,
        })
      }
    }
  }

  // --- Tournament matches via players linked to this account ---
  const { data: playerRows } = await supabase
    .from('players')
    .select('id, tournament_id')
    .eq('player_account_id', accountId)

  const playerIds = (playerRows || []).map((p: any) => p.id as string)
  if (playerIds.length > 0) {
    const playerIdSet = new Set(playerIds)
    const playerConditions = playerIds.map((id) => `player1_id.eq.${id},player2_id.eq.${id}`).join(',')
    const { data: teamsData } = await supabase.from('teams').select('id').or(playerConditions)
    const teamIds = (teamsData || []).map((t: any) => t.id as string)
    const teamIdSet = new Set(teamIds)

    const teamMatchConditions =
      teamIds.length > 0 ? `team1_id.in.(${teamIds.join(',')}),team2_id.in.(${teamIds.join(',')})` : ''
    const pids = playerIds.join(',')
    const individualMatchConditions = `player1_individual_id.in.(${pids}),player2_individual_id.in.(${pids}),player3_individual_id.in.(${pids}),player4_individual_id.in.(${pids})`
    const allConditions = [teamMatchConditions, individualMatchConditions].filter((c) => c.length > 0).join(',')

    if (allConditions) {
      const { data: matchesData } = await supabase
        .from('matches')
        .select(
          `
          id, status, team1_id, team2_id,
          player1_individual_id, player2_individual_id, player3_individual_id, player4_individual_id,
          p1:players!matches_player1_individual_id_fkey(id, name),
          p2:players!matches_player2_individual_id_fkey(id, name),
          p3:players!matches_player3_individual_id_fkey(id, name),
          p4:players!matches_player4_individual_id_fkey(id, name)
        `,
        )
        .or(allConditions)
        .eq('status', 'completed')
        .order('scheduled_time', { ascending: false })
        .limit(200)

      if (matchesData?.length) {
        const teamIdsFromMatches = new Set<string>()
        const individualPlayers: Array<{ id?: string | null; name?: string | null }> = []
        for (const m of matchesData as any[]) {
          if (m.team1_id) teamIdsFromMatches.add(m.team1_id)
          if (m.team2_id) teamIdsFromMatches.add(m.team2_id)
          if (m.p1) individualPlayers.push(m.p1)
          if (m.p2) individualPlayers.push(m.p2)
          if (m.p3) individualPlayers.push(m.p3)
          if (m.p4) individualPlayers.push(m.p4)
        }
        const [teamMap, indivMap] = await Promise.all([
          resolveTeamPlayerNamesMap(teamIdsFromMatches),
          resolveIndividualPlayerNames(individualPlayers),
        ])

        for (const m of matchesData as any[]) {
          const isIndividual = !!(m.p1 || m.p2 || m.p3 || m.p4)
          if (isIndividual) {
            const slots = [
              { id: m.p1?.id as string | undefined, name: indivMap.get(m.p1?.id)?.name || m.p1?.name, accountId: indivMap.get(m.p1?.id)?.account_id, avatar: indivMap.get(m.p1?.id)?.avatar_url },
              { id: m.p2?.id as string | undefined, name: indivMap.get(m.p2?.id)?.name || m.p2?.name, accountId: indivMap.get(m.p2?.id)?.account_id, avatar: indivMap.get(m.p2?.id)?.avatar_url },
              { id: m.p3?.id as string | undefined, name: indivMap.get(m.p3?.id)?.name || m.p3?.name, accountId: indivMap.get(m.p3?.id)?.account_id, avatar: indivMap.get(m.p3?.id)?.avatar_url },
              { id: m.p4?.id as string | undefined, name: indivMap.get(m.p4?.id)?.name || m.p4?.name, accountId: indivMap.get(m.p4?.id)?.account_id, avatar: indivMap.get(m.p4?.id)?.avatar_url },
            ]
            const myIdx = slots.findIndex((s) => s.id && playerIdSet.has(s.id))
            if (myIdx >= 0) {
              const partner = slots[myIdx ^ 1]
              bump(agg, {
                selfAccountId: accountId,
                selfName: playerName,
                rawName: partner?.name,
                accountId: partner?.accountId,
                avatar_url: partner?.avatar,
              })
            }
          } else {
            const inTeam1 = teamIdSet.has(m.team1_id)
            const meta = teamMap.get(inTeam1 ? m.team1_id : m.team2_id)
            if (!meta) continue
            if (meta.player1_account_id === accountId) {
              bump(agg, {
                selfAccountId: accountId,
                selfName: playerName,
                rawName: meta.player2_name,
                accountId: meta.player2_account_id,
                avatar_url: meta.player2_avatar,
              })
            } else if (meta.player2_account_id === accountId) {
              bump(agg, {
                selfAccountId: accountId,
                selfName: playerName,
                rawName: meta.player1_name,
                accountId: meta.player1_account_id,
                avatar_url: meta.player1_avatar,
              })
            } else {
              getPartnerNamesFromMatch(
                {
                  player1_name: meta.player1_name,
                  player2_name: meta.player2_name,
                  my_side: 1,
                },
                playerName,
              ).forEach((n) =>
                bump(agg, { selfAccountId: accountId, selfName: playerName, rawName: n }),
              )
            }
          }
        }
      }
    }
  }

  return Array.from(agg.values())
    .filter((p) => p.name && !isLikelyTeamLabel(p.name))
    .filter((p) => !(playerName && namesMatch(p.name, playerName)))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}
