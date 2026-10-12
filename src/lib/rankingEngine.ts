/**
 * Padel ONE / APC — Motor de Pontos do Ranking Deslizante (12 meses)
 *
 * Pontos são gravados em `ranking_point_transactions` e agregados pela vista
 * `rolling_12m_rankings` (expiram automaticamente após 12 meses).
 */

import { supabase } from './supabase'

// ============================================
// Tiers & tabelas de pontos
// ============================================

export type TournamentTier = 'master' | 'regular' | 'social'

export type PlacementBucket = 'first' | 'second' | 'third_fourth' | 'quarters' | 'participation'

/** Pontos por posição em cada tier de torneio. */
export const TOURNAMENT_TIER_POINTS: Record<TournamentTier, Record<PlacementBucket, number>> = {
  master: {
    first: 1000,
    second: 600,
    third_fourth: 360,
    quarters: 180,
    participation: 50,
  },
  regular: {
    first: 500,
    second: 300,
    third_fourth: 180,
    quarters: 90,
    participation: 25,
  },
  social: {
    first: 250,
    second: 150,
    third_fourth: 90,
    quarters: 45,
    participation: 15,
  },
}

export const CASUAL_WIN_POINTS = 15
export const CASUAL_LOSS_POINTS = 5

export type RankingReason =
  | 'tournament_winner'
  | 'tournament_finalist'
  | 'tournament_semifinal'
  | 'tournament_quarters'
  | 'tournament_participation'
  | 'casual_win'
  | 'casual_loss'
  | 'friendly_win'

export interface RankingPointRow {
  user_id: string
  organization_id: string
  points_awarded: number
  reason: RankingReason | string
  reference_id: string | null
  created_at?: string
}

export interface Rolling12mEntry {
  user_id: string
  organization_id: string | null
  total_points: number
  total_events: number
  last_activity: string | null
  position: number
  name: string
  avatar_url: string | null
  level: number
}

// ============================================
// Resolução de tier / posição
// ============================================

/**
 * Infere o tier do torneio a partir do nome/formato.
 * MASTER/OFICIAL APC → master | Americano/Social → social | resto → regular
 */
export function resolveTournamentTier(tournament: {
  name?: string | null
  format?: string | null
  round_robin_type?: string | null
  ranking_tier?: string | null
}): TournamentTier {
  const explicit = String(tournament.ranking_tier || '').toLowerCase().trim()
  if (explicit === 'master' || explicit === 'oficial' || explicit === 'oficial_apc') return 'master'
  if (explicit === 'regular' || explicit === 'open') return 'regular'
  if (explicit === 'social' || explicit === 'americano' || explicit === 'american') return 'social'

  const name = String(tournament.name || '').toUpperCase()
  const format = String(tournament.format || '').toLowerCase()
  const rr = String(tournament.round_robin_type || '').toLowerCase()

  if (/\bMASTER\b/.test(name) || /\bOFICIAL\b/.test(name)) return 'master'
  // Torneios APC oficiais (N-S / ranking) — não sociais
  if (/\bAPC\b/.test(name) && !/SOCIAL|AMERICANO/.test(name)) return 'master'

  if (
    format === 'mixed_american' ||
    rr === 'individual' ||
    /SOCIAL|AMERICANO|AMERICAN/.test(name)
  ) {
    return 'social'
  }

  return 'regular'
}

/** Mapeia posição final (1,2,3…) para o bucket de pontos. */
export function placementBucketFromPosition(position: number): PlacementBucket {
  if (position <= 1) return 'first'
  if (position === 2) return 'second'
  if (position === 3 || position === 4) return 'third_fourth'
  if (position >= 5 && position <= 8) return 'quarters'
  return 'participation'
}

export function pointsForPlacement(tier: TournamentTier, position: number): number {
  const bucket = placementBucketFromPosition(position)
  return TOURNAMENT_TIER_POINTS[tier][bucket]
}

export function reasonForPlacement(position: number): RankingReason {
  const bucket = placementBucketFromPosition(position)
  switch (bucket) {
    case 'first':
      return 'tournament_winner'
    case 'second':
      return 'tournament_finalist'
    case 'third_fourth':
      return 'tournament_semifinal'
    case 'quarters':
      return 'tournament_quarters'
    default:
      return 'tournament_participation'
  }
}

// ============================================
// Persistência
// ============================================

export async function insertRankingPointTransactions(
  rows: RankingPointRow[],
): Promise<{ inserted: number; error?: string }> {
  if (rows.length === 0) return { inserted: 0 }

  const payload = rows.map((r) => ({
    user_id: r.user_id,
    organization_id: r.organization_id,
    points_awarded: r.points_awarded,
    reason: r.reason,
    reference_id: r.reference_id,
    ...(r.created_at ? { created_at: r.created_at } : {}),
  }))

  // Inserir em lotes para evitar limites do PostgREST
  const chunkSize = 200
  let inserted = 0
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize)
    const { error } = await supabase.from('ranking_point_transactions').insert(chunk)
    if (error) {
      console.error('[RankingEngine] insert failed:', error)
      return { inserted, error: error.message }
    }
    inserted += chunk.length
  }
  return { inserted }
}

/**
 * Atribui pontos de torneio a um jogador (uma posição).
 * Idempotente por (user_id, reference_id=tournamentId, reason) quando `skipIfExists`.
 */
export async function awardTournamentPlacementPoints(params: {
  userId: string
  organizationId: string
  tournamentId: string
  position: number
  tier: TournamentTier
  createdAt?: string
  skipIfExists?: boolean
}): Promise<{ awarded: number; reason: RankingReason } | null> {
  const { userId, organizationId, tournamentId, position, tier, createdAt } = params
  const points = pointsForPlacement(tier, position)
  const reason = reasonForPlacement(position)

  if (params.skipIfExists !== false) {
    const { data: existing } = await supabase
      .from('ranking_point_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('reference_id', tournamentId)
      .eq('reason', reason)
      .limit(1)
    if (existing && existing.length > 0) return null
  }

  const { error } = await supabase.from('ranking_point_transactions').insert({
    user_id: userId,
    organization_id: organizationId,
    points_awarded: points,
    reason,
    reference_id: tournamentId,
    ...(createdAt ? { created_at: createdAt } : {}),
  })

  if (error) {
    console.error('[RankingEngine] awardTournamentPlacementPoints failed:', error)
    return null
  }
  return { awarded: points, reason }
}

/**
 * Jogos diários / validados (open games): +15 vencedores, +5 derrotados.
 * `matchId` = open_games.id
 */
export async function awardCasualMatchPoints(
  matchId: string,
): Promise<{ awarded: number; skipped?: string }> {
  // Idempotência
  const { data: existing } = await supabase
    .from('ranking_point_transactions')
    .select('id')
    .eq('reference_id', matchId)
    .in('reason', ['casual_win', 'casual_loss'])
    .limit(1)

  if (existing && existing.length > 0) {
    return { awarded: 0, skipped: 'already_awarded' }
  }

  const { data: game, error: gameErr } = await supabase
    .from('open_games')
    .select('id, club_id, status')
    .eq('id', matchId)
    .maybeSingle()

  if (gameErr || !game) {
    return { awarded: 0, skipped: 'game_not_found' }
  }

  const organizationId = game.club_id as string | null
  if (!organizationId) {
    return { awarded: 0, skipped: 'no_club' }
  }

  // Resultado confirmado (= validado na app)
  const { data: result } = await supabase
    .from('open_game_results')
    .select('*')
    .eq('game_id', matchId)
    .eq('status', 'confirmed')
    .maybeSingle()

  if (!result) {
    return { awarded: 0, skipped: 'no_confirmed_result' }
  }

  // Roster via RPC (SECURITY DEFINER) — evita falhas de RLS em open_game_players
  let players: Array<{ position: number; user_id: string | null }> = []
  const { data: roster, error: rosterErr } = await supabase.rpc('list_open_game_roster', {
    p_game_id: matchId,
  })
  if (!rosterErr && roster && roster.length >= 4) {
    players = roster.map((p: any) => ({
      position: Number(p.player_position ?? p.position),
      user_id: p.user_id || null,
    }))
  } else {
    const { data: direct } = await supabase
      .from('open_game_players')
      .select('position, player_account_id, user_id')
      .eq('game_id', matchId)
      .order('position', { ascending: true })
    for (const p of direct || []) {
      let userId = p.user_id as string | null
      if (!userId && p.player_account_id) {
        const { data: acct } = await supabase
          .from('player_accounts')
          .select('user_id')
          .eq('id', p.player_account_id)
          .maybeSingle()
        userId = acct?.user_id || null
      }
      players.push({ position: Number(p.position), user_id: userId })
    }
  }

  if (players.length < 4) {
    return { awarded: 0, skipped: 'incomplete_roster' }
  }

  // Determinar vencedor: sets (team1 = pos 1,2)
  const s1 = [
    result.team1_score_set1 ?? 0,
    result.team2_score_set1 ?? 0,
  ] as [number, number]
  const s2 = [
    result.team1_score_set2 ?? 0,
    result.team2_score_set2 ?? 0,
  ] as [number, number]
  const s3 = [
    result.team1_score_set3 ?? 0,
    result.team2_score_set3 ?? 0,
  ] as [number, number]
  const sets1 =
    (s1[0] > s1[1] ? 1 : 0) + (s2[0] > s2[1] ? 1 : 0) + (s3[0] > s3[1] ? 1 : 0)
  const sets2 =
    (s1[1] > s1[0] ? 1 : 0) + (s2[1] > s2[0] ? 1 : 0) + (s3[1] > s3[0] ? 1 : 0)

  if (sets1 === sets2) {
    // Empate: assiduidade para todos (+5)
    const rows: RankingPointRow[] = []
    for (const p of players) {
      if (!p.user_id) continue
      rows.push({
        user_id: p.user_id,
        organization_id: organizationId,
        points_awarded: CASUAL_LOSS_POINTS,
        reason: 'casual_loss',
        reference_id: matchId,
        created_at: result.created_at || result.updated_at || undefined,
      })
    }
    const { inserted } = await insertRankingPointTransactions(rows)
    return { awarded: inserted }
  }

  const team1Won = sets1 > sets2
  const rows: RankingPointRow[] = []

  for (const p of players) {
    if (!p.user_id) continue
    const onTeam1 = p.position === 1 || p.position === 2
    const won = team1Won ? onTeam1 : !onTeam1
    rows.push({
      user_id: p.user_id,
      organization_id: organizationId,
      points_awarded: won ? CASUAL_WIN_POINTS : CASUAL_LOSS_POINTS,
      reason: won ? 'casual_win' : 'casual_loss',
      reference_id: matchId,
      created_at: result.created_at || result.updated_at || undefined,
    })
  }

  const { inserted } = await insertRankingPointTransactions(rows)
  return { awarded: inserted }
}

/**
 * Atribui pontos a todos os participantes de um torneio com final_position.
 */
export async function awardTournamentPointsForTournament(
  tournamentId: string,
  options?: { skipIfExists?: boolean },
): Promise<{ awarded: number; participants: number; tier: TournamentTier }> {
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, format, round_robin_type, club_id, created_at, end_date, status')
    .eq('id', tournamentId)
    .maybeSingle()

  if (!tournament?.club_id) {
    return { awarded: 0, participants: 0, tier: 'regular' }
  }

  const tier = resolveTournamentTier(tournament)
  const organizationId = tournament.club_id as string
  const eventAt =
    (tournament.end_date ? `${tournament.end_date}T12:00:00.000Z` : null) ||
    tournament.created_at ||
    undefined

  // Preferir jogadores individuais com final_position; senão expandir teams
  const { data: placedPlayers } = await supabase
    .from('players')
    .select('id, user_id, player_account_id, final_position')
    .eq('tournament_id', tournamentId)
    .not('final_position', 'is', null)

  type Placement = { userId: string; position: number }
  const placements: Placement[] = []

  if (placedPlayers && placedPlayers.length > 0) {
    for (const p of placedPlayers) {
      let userId = p.user_id as string | null
      if (!userId && p.player_account_id) {
        const { data: acct } = await supabase
          .from('player_accounts')
          .select('user_id')
          .eq('id', p.player_account_id)
          .maybeSingle()
        userId = acct?.user_id || null
      }
      if (!userId || p.final_position == null) continue
      placements.push({ userId, position: Number(p.final_position) })
    }
  } else {
    const { data: teams } = await supabase
      .from('teams')
      .select('player1_id, player2_id, final_position')
      .eq('tournament_id', tournamentId)
      .not('final_position', 'is', null)

    const playerIds = new Set<string>()
    const teamPlacements: Array<{ playerIds: string[]; position: number }> = []
    for (const t of teams || []) {
      const ids = [t.player1_id, t.player2_id].filter(Boolean) as string[]
      ids.forEach((id) => playerIds.add(id))
      teamPlacements.push({ playerIds: ids, position: Number(t.final_position) })
    }

    if (playerIds.size > 0) {
      const { data: plist } = await supabase
        .from('players')
        .select('id, user_id, player_account_id')
        .in('id', [...playerIds])

      const byId = new Map((plist || []).map((p) => [p.id, p]))
      for (const tp of teamPlacements) {
        for (const pid of tp.playerIds) {
          const p = byId.get(pid)
          if (!p) continue
          let userId = p.user_id as string | null
          if (!userId && p.player_account_id) {
            const { data: acct } = await supabase
              .from('player_accounts')
              .select('user_id')
              .eq('id', p.player_account_id)
              .maybeSingle()
            userId = acct?.user_id || null
          }
          if (!userId) continue
          placements.push({ userId, position: tp.position })
        }
      }
    }
  }

  // Deduplicar por user (melhor posição)
  const bestByUser = new Map<string, number>()
  for (const pl of placements) {
    const prev = bestByUser.get(pl.userId)
    if (prev == null || pl.position < prev) bestByUser.set(pl.userId, pl.position)
  }

  let awarded = 0
  const rows: RankingPointRow[] = []

  for (const [userId, position] of bestByUser) {
    if (options?.skipIfExists !== false) {
      const { data: existing } = await supabase
        .from('ranking_point_transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('reference_id', tournamentId)
        .limit(1)
      if (existing && existing.length > 0) continue
    }

    rows.push({
      user_id: userId,
      organization_id: organizationId,
      points_awarded: pointsForPlacement(tier, position),
      reason: reasonForPlacement(position),
      reference_id: tournamentId,
      created_at: eventAt,
    })
  }

  const result = await insertRankingPointTransactions(rows)
  awarded = result.inserted
  return { awarded, participants: bestByUser.size, tier }
}

// ============================================
// Leitura da vista rolling_12m_rankings
// ============================================

export async function fetchRolling12mRankings(options?: {
  organizationId?: string | null
  /** Se true e sem organizationId, agrega todos os clubes (Ranking Global). */
  global?: boolean
  search?: string
  limit?: number
}): Promise<Rolling12mEntry[]> {
  const limit = options?.limit ?? 200

  let query = supabase
    .from('rolling_12m_rankings')
    .select('user_id, organization_id, total_points, total_events, last_activity')
    .order('total_points', { ascending: false })
    .limit(Math.min(limit * 3, 1000))

  if (options?.organizationId && !options.global) {
    query = query.eq('organization_id', options.organizationId)
  }

  const { data: rows, error } = await query
  if (error) {
    console.error('[RankingEngine] fetchRolling12mRankings:', error)
    return []
  }

  if (!rows || rows.length === 0) return []

  // Agregar globalmente se pedido
  type Agg = {
    user_id: string
    organization_id: string | null
    total_points: number
    total_events: number
    last_activity: string | null
  }

  let aggregated: Agg[]
  if (options?.global || !options?.organizationId) {
    const map = new Map<string, Agg>()
    for (const r of rows) {
      const prev = map.get(r.user_id)
      if (!prev) {
        map.set(r.user_id, {
          user_id: r.user_id,
          organization_id: options?.organizationId || null,
          total_points: Number(r.total_points) || 0,
          total_events: Number(r.total_events) || 0,
          last_activity: r.last_activity,
        })
      } else {
        prev.total_points += Number(r.total_points) || 0
        prev.total_events += Number(r.total_events) || 0
        if (r.last_activity && (!prev.last_activity || r.last_activity > prev.last_activity)) {
          prev.last_activity = r.last_activity
        }
      }
    }
    aggregated = [...map.values()].sort((a, b) => b.total_points - a.total_points)
  } else {
    aggregated = rows.map((r) => ({
      user_id: r.user_id,
      organization_id: r.organization_id,
      total_points: Number(r.total_points) || 0,
      total_events: Number(r.total_events) || 0,
      last_activity: r.last_activity,
    }))
  }

  const userIds = aggregated.slice(0, limit).map((r) => r.user_id)
  const { data: accounts } = await supabase
    .from('player_accounts')
    .select('id, user_id, name, avatar_url, level')
    .in('user_id', userIds)

  const byUser = new Map((accounts || []).map((a) => [a.user_id, a]))
  const search = (options?.search || '').trim().toLowerCase()

  const entries: Rolling12mEntry[] = []
  let position = 0
  for (const row of aggregated) {
    const acct = byUser.get(row.user_id)
    const name = acct?.name || 'Jogador'
    if (search && !name.toLowerCase().includes(search)) continue
    position += 1
    entries.push({
      user_id: row.user_id,
      organization_id: row.organization_id,
      total_points: row.total_points,
      total_events: row.total_events,
      last_activity: row.last_activity,
      position,
      name,
      avatar_url: acct?.avatar_url || null,
      level: Number(acct?.level ?? 0),
    })
    if (entries.length >= limit) break
  }

  // Re-numerar após filtro de pesquisa
  if (search) {
    entries.forEach((e, i) => {
      e.position = i + 1
    })
  }

  return entries
}
