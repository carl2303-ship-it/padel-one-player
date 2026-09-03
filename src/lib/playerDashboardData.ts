/**
 * Dados do dashboard do jogador – mesma lógica que Padel One Tour (PlayerDashboard).
 * Lê da mesma base Supabase; os dados ficam nos dois lados (Tour e Player).
 */
import { supabase } from './supabase'
import {
  resolveTeamPlayerNamesMap,
  resolveIndividualPlayerNames,
  preferResolvedMatchNames,
} from './resolveTeamPlayerNames'
import { resolvePlayerAccountForUser } from './resolvePlayerAccount'

export interface TournamentSummary {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string
  enrolled_count?: number
}

export interface PlayerMatch {
  id: string
  tournament_id: string
  tournament_name: string
  court: string
  start_time: string
  team1_name: string
  team2_name: string
  /** Nomes dos 4 jogadores (equipa 1: 1,2; equipa 2: 3,4). Preenchido quando o jogo é individual. */
  player1_name?: string
  player2_name?: string
  player3_name?: string
  player4_name?: string
  player1_avatar?: string | null
  player2_avatar?: string | null
  player3_avatar?: string | null
  player4_avatar?: string | null
  /** 1 = jogador atual na equipa 1; 2 = na equipa 2 */
  my_side?: 1 | 2
  score1: number | null
  score2: number | null
  status: string
  round: string
  /** true = vitória, false = derrota, null = empate */
  is_winner?: boolean | null
  set1?: string
  set2?: string
  set3?: string
  is_open_game?: boolean // Indica se é um jogo aberto
  open_game_id?: string // ID do jogo aberto
  club_name?: string // Nome do clube (para jogos abertos)
}

/** Count sets won; equal games in a set (e.g. American 5-5) count as played but neither side wins the set. */
export function computeSetCounts(scores: {
  team1_score_set1?: number | null
  team2_score_set1?: number | null
  team1_score_set2?: number | null
  team2_score_set2?: number | null
  team1_score_set3?: number | null
  team2_score_set3?: number | null
}): { team1Sets: number; team2Sets: number; hasPlayedSets: boolean } {
  const pairs: Array<[number, number]> = [
    [scores.team1_score_set1 ?? 0, scores.team2_score_set1 ?? 0],
    [scores.team1_score_set2 ?? 0, scores.team2_score_set2 ?? 0],
    [scores.team1_score_set3 ?? 0, scores.team2_score_set3 ?? 0],
  ]
  let team1Sets = 0
  let team2Sets = 0
  let hasPlayedSets = false
  for (const [a, b] of pairs) {
    if (a === 0 && b === 0) continue
    hasPlayedSets = true
    if (a > b) team1Sets++
    else if (b > a) team2Sets++
  }
  return { team1Sets, team2Sets, hasPlayedSets }
}

/** Resolve outcome from set counts. null = draw (incl. American ties like 5-5 → 0-0 sets). */
export function matchOutcome(myTeamIs1: boolean, team1Sets: number, team2Sets: number): boolean | null {
  if (team1Sets === team2Sets) return null
  return myTeamIs1 ? team1Sets > team2Sets : team2Sets > team1Sets
}

/** Parse "5-5" style set strings into computeSetCounts input. */
export function scoresFromSetStrings(m: {
  set1?: string
  set2?: string
  set3?: string
}): {
  team1_score_set1: number
  team2_score_set1: number
  team1_score_set2: number
  team2_score_set2: number
  team1_score_set3: number
  team2_score_set3: number
} {
  const parse = (s?: string): [number, number] => {
    if (!s) return [0, 0]
    const [a, b] = s.split('-').map((n) => parseInt(n, 10) || 0)
    return [a, b]
  }
  const [a1, b1] = parse(m.set1)
  const [a2, b2] = parse(m.set2)
  const [a3, b3] = parse(m.set3)
  return {
    team1_score_set1: a1,
    team2_score_set1: b1,
    team1_score_set2: a2,
    team2_score_set2: b2,
    team1_score_set3: a3,
    team2_score_set3: b3,
  }
}

/**
 * Force draws when set games are equal (e.g. American 5-5), even if a stale
 * client/edge path marked the match as a loss (0-0 set wins → false).
 */
export function normalizeMatchWinner<T extends {
  is_winner?: boolean | null
  set1?: string
  set2?: string
  set3?: string
}>(m: T): T {
  const { team1Sets, team2Sets, hasPlayedSets } = computeSetCounts(scoresFromSetStrings(m))
  if (hasPlayedSets && team1Sets === team2Sets) {
    return { ...m, is_winner: null }
  }
  return m
}

export function computeStatsFromMatches(
  matches: Array<{ status?: string; is_winner?: boolean | null }>,
): Pick<PlayerStats, 'wins' | 'draws' | 'losses' | 'totalMatches' | 'winRate'> {
  let wins = 0
  let draws = 0
  let losses = 0
  for (const m of matches) {
    if (m.status && m.status !== 'completed') continue
    if (m.is_winner === true) wins++
    else if (m.is_winner === false) losses++
    else if (m.is_winner === null) draws++
  }
  const decided = wins + losses
  return {
    wins,
    draws,
    losses,
    totalMatches: wins + draws + losses,
    winRate: decided > 0 ? Math.round((wins / decided) * 100) : 0,
  }
}

export interface LeagueStanding {
  league_id: string
  league_name: string
  league_status?: string
  league_end_date?: string | null
  league_categories?: string[]
  player_category?: string | null
  position: number
  total_participants: number
  points: number
  tournaments_played: number
}

export interface LeagueFullStanding {
  position: number
  entity_name: string
  total_points: number
  tournaments_played: number
  best_position: number
  is_current_player: boolean
  avatar_url?: string | null
  player_account_id?: string | null
}

export interface PlayerStats {
  totalMatches: number
  wins: number
  draws: number
  losses: number
  winRate: number
  tournamentsPlayed: number
  bestFinish: string
}

export interface CategoryMatchResult {
  id: string
  team1_id?: string
  team2_id?: string
  team1_name: string
  team2_name: string
  set1?: string
  set2?: string
  set3?: string
  round: string
  status: string
}

export interface CategoryStandingDetail {
  categoryName: string
  standings: TournamentStandingRow[]
  myMatches: TournamentMyMatch[]
  allMatches: CategoryMatchResult[]
  playerPosition?: number
}

export interface PastTournamentDetail {
  standings: any[]
  myMatches: any[]
  playerPosition?: number
  tournamentName: string
  categoryStandings?: Record<string, CategoryStandingDetail>
}

export interface PlayerDashboardData {
  playerName: string
  playerAccountId: string | null
  upcomingTournaments: TournamentSummary[]
  pastTournaments: TournamentSummary[]
  upcomingMatches: PlayerMatch[]
  recentMatches: PlayerMatch[]
  leagueStandings: LeagueStanding[]
  pastTournamentDetails?: Record<string, PastTournamentDetail>
  stats: PlayerStats
}

const emptyStats: PlayerStats = {
  totalMatches: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  winRate: 0,
  tournamentsPlayed: 0,
  bestFinish: '-',
}

/**
 * Helper: Fetch open games where the player is enrolled (consolidated from duplicate code)
 */
async function fetchOpenGameMatches(playerAccountId: string, userId?: string): Promise<PlayerMatch[]> {
  if (!playerAccountId) return []

  try {
    // IMPORTANT: Update user_id for records that have player_account_id but missing user_id
    if (userId) {
      try {
        await supabase
          .from('open_game_players')
          .update({ user_id: userId })
          .eq('player_account_id', playerAccountId)
          .is('user_id', null)
          .eq('status', 'confirmed')
      } catch (err) {
        console.error('[PlayerDashboard] Error updating user_id for open_game_players:', err)
      }
    }

    // Get games by player_account_id OR user_id
    const queries = [
      supabase
        .from('open_game_players')
        .select('game_id')
        .eq('player_account_id', playerAccountId)
        .eq('status', 'confirmed'),
    ]

    if (userId) {
      queries.push(
        supabase
          .from('open_game_players')
          .select('game_id')
          .eq('user_id', userId)
          .eq('status', 'confirmed')
      )
    }

    const results = await Promise.all(queries)
    const gameIdSet = new Set<string>()
    results.forEach(r => {
      (r.data || []).forEach((g: any) => gameIdSet.add(g.game_id))
    })

    if (gameIdSet.size === 0) return []
    const playerGames = Array.from(gameIdSet).map(id => ({ game_id: id }))

    const gameIds = playerGames.map((pg: any) => pg.game_id).filter(Boolean)
    if (gameIds.length === 0) return []

    const { data: openGames, error: openGamesError } = await supabase
      .from('open_games')
      .select('id, scheduled_at, status, club_id, court_id, duration_minutes, max_players')
      .in('id', gameIds)
      .gte('scheduled_at', new Date().toISOString())

    if (openGamesError || !openGames) return []

    const filteredGames = openGames.filter((g: any) => g.status === 'open' || g.status === 'full')
    if (filteredGames.length === 0) return []

    // Fetch clubs, courts, and player counts in PARALLEL (was sequential)
    const clubIds = [...new Set(filteredGames.map((g: any) => g.club_id).filter(Boolean))]
    const courtIds = [...new Set(filteredGames.map((g: any) => g.court_id).filter(Boolean))]
    const gameIdsForCount = filteredGames.map((g: any) => g.id)

    const [clubsResult, courtsResult, playersCountResult] = await Promise.all([
      clubIds.length > 0
        ? supabase.from('clubs').select('id, name, city').in('id', clubIds)
        : { data: [] },
      courtIds.length > 0
        ? supabase.from('club_courts').select('id, name').in('id', courtIds)
        : { data: [] },
      supabase.from('open_game_players').select('game_id').in('game_id', gameIdsForCount),
    ])

    const clubsMap = new Map<string, { name: string; city: string | null }>()
    ;(clubsResult.data || []).forEach((club: any) => {
      clubsMap.set(club.id, { name: club.name, city: club.city })
    })

    const courtsMap = new Map<string, string>()
    ;(courtsResult.data || []).forEach((court: any) => {
      courtsMap.set(court.id, court.name)
    })

    const countMap = new Map<string, number>()
    ;(playersCountResult.data || []).forEach((p: any) => {
      countMap.set(p.game_id, (countMap.get(p.game_id) || 0) + 1)
    })

    return filteredGames.map((game: any) => {
      const count = countMap.get(game.id) || 0
      const club = clubsMap.get(game.club_id)
      const courtName = courtsMap.get(game.court_id) || 'Campo'
      return {
        id: `open_${game.id}`,
        tournament_id: '',
        tournament_name: 'Jogo Aberto',
        court: courtName,
        start_time: game.scheduled_at,
        team1_name: `${count}/${game.max_players} jogadores`,
        team2_name: club?.name || '',
        status: game.status,
        round: '',
        score1: null,
        score2: null,
        is_open_game: true,
        open_game_id: game.id,
        club_name: club?.name || '',
      }
    })
  } catch (err) {
    console.error('[PlayerDashboard] Error fetching open games:', err)
    return []
  }
}

export async function fetchPlayerDashboardData(
  userId: string,
  existingPlayerAccount?: { id: string; name: string | null; phone_number: string | null }
): Promise<PlayerDashboardData> {
  console.time('[Dashboard] Total load time')
  const result: PlayerDashboardData = {
    playerName: '',
    playerAccountId: null,
    upcomingTournaments: [],
    pastTournaments: [],
    upcomingMatches: [],
    recentMatches: [],
    leagueStandings: [],
    stats: { ...emptyStats },
  }

  // Use existing playerAccount if passed (avoids duplicate query)
  let playerAccount = existingPlayerAccount
  if (!playerAccount) {
    const savedPhone = typeof localStorage !== 'undefined'
      ? localStorage.getItem('padel_one_player_phone')
      : null
    const resolved = await resolvePlayerAccountForUser(userId, { phoneNumber: savedPhone || undefined })
    if (!resolved) { console.timeEnd('[Dashboard] Total load time'); return result }
    playerAccount = resolved
  }

  result.playerAccountId = playerAccount.id
  result.playerName = playerAccount.name || ''

  const phone = (playerAccount as any).phone_number
  const name = playerAccount.name

  // OPTIMIZED: Use player_account_id (direct FK) as primary, with fallbacks for unlinked records
  const [playersByAccountId, playersByPhone, playersByName] = await Promise.all([
    // Priority 1: Direct FK link (fastest, most reliable)
    playerAccount.id
      ? supabase.from('players').select('id, tournament_id').eq('player_account_id', playerAccount.id)
      : { data: [] },
    // Fallback: phone match (for records not yet linked by trigger)
    phone
      ? supabase.from('players').select('id, tournament_id').eq('phone_number', phone).is('player_account_id', null)
      : { data: [] },
    // Fallback: name match (for records without phone or account link)
    name
      ? supabase.from('players').select('id, tournament_id').ilike('name', name).is('player_account_id', null)
      : { data: [] },
  ])

  const allPlayersMap = new Map<string, { id: string; tournament_id: string | null }>()
  ;[...(playersByAccountId.data || []), ...(playersByPhone.data || []), ...(playersByName.data || [])].forEach((p: any) => {
    allPlayersMap.set(p.id, p)
  })
  const allPlayers = Array.from(allPlayersMap.values())
  const playerIds = allPlayers.map((p) => p.id)
  const tournamentIds = allPlayers.filter((p) => p.tournament_id).map((p) => p.tournament_id!)


  if (allPlayers.length === 0) {
    await fetchLeagueStandingsOnly(playerAccount.id, name || '', result)
    console.timeEnd('[Dashboard] Total load time')
    return result
  }

  const playerConditions = playerIds.map((id) => `player1_id.eq.${id},player2_id.eq.${id}`).join(',')

  const [individualTournamentsRes, teamsRes] = await Promise.all([
    tournamentIds.length > 0
      ? supabase
          .from('tournaments')
          .select('id, name, start_date, end_date, status')
          .in('id', tournamentIds)
      : { data: [] },
    playerIds.length > 0
      ? supabase
          .from('teams')
          .select('id, tournament_id, tournaments!inner(id, name, start_date, end_date, status)')
          .or(playerConditions)
      : { data: [] },
  ])

  const individualTournaments = individualTournamentsRes.data || []
  const teamsData = teamsRes.data || []
  const teamTournaments = (teamsData as any[]).map((t: any) => t.tournaments)
  const allTournamentData = [...individualTournaments, ...teamTournaments]
  const uniqueTournaments = allTournamentData.reduce((acc: any[], tournament: any) => {
    if (!acc.find((t) => t.id === tournament.id)) acc.push(tournament)
    return acc
  }, [])

  const uniqueTournamentIds = uniqueTournaments.map((t) => t.id)
  const [playersCountRes, teamsCountRes] = await Promise.all([
    supabase.from('players').select('tournament_id').in('tournament_id', uniqueTournamentIds),
    supabase.from('teams').select('tournament_id').in('tournament_id', uniqueTournamentIds),
  ])
  const playerCountMap = new Map<string, number>()
  const teamCountMap = new Map<string, number>()
  ;(playersCountRes.data || []).forEach((p: any) =>
    playerCountMap.set(p.tournament_id, (playerCountMap.get(p.tournament_id) || 0) + 1)
  )
  ;(teamsCountRes.data || []).forEach((t: any) =>
    teamCountMap.set(t.tournament_id, (teamCountMap.get(t.tournament_id) || 0) + 1)
  )

  const now = new Date()
  const upcoming: TournamentSummary[] = []
  const past: TournamentSummary[] = []

  uniqueTournaments.forEach((t: any) => {
    const enrolled_count = teamCountMap.get(t.id) || playerCountMap.get(t.id) || 0
    const row = { ...t, enrolled_count }
    const isOngoing = t.status === 'in_progress' || t.status === 'active'
    const isCompleted = t.status === 'completed' || t.status === 'finished'
    const isCanceled = t.status === 'canceled' || t.status === 'cancelled'
    // Apenas incluir concluídos, não cancelados
    if (isCompleted && !isCanceled) past.push(row)
    else if (isOngoing && !isCanceled) upcoming.push(row)
    else if (!isCanceled) {
      const endDate = new Date(t.end_date + 'T23:59:59')
      if (endDate >= now) upcoming.push(row)
      else past.push(row)
    }
  })

  upcoming.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
  past.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())

  result.upcomingTournaments = upcoming
  result.pastTournaments = past
  result.stats.tournamentsPlayed = past.length

  // Extract team IDs from teamsRes (avoids separate query)
  const teamIds = (teamsRes.data || []).map((t: any) => t.id)

  if (playerIds.length === 0 && teamIds.length === 0) {
    await fetchLeagueStandingsOnly(playerAccount.id, name || '', result, playerIds, teamIds)
    console.timeEnd('[Dashboard] Total load time')
    return result
  }

  const selectFields = `
    id, tournament_id, court, scheduled_time,
    team1_score_set1, team2_score_set1, team1_score_set2, team2_score_set2, team1_score_set3, team2_score_set3,
    status, round, team1_id, team2_id,
    player1_individual_id, player2_individual_id, player3_individual_id, player4_individual_id,
    tournaments!inner(name),
    team1:teams!matches_team1_id_fkey(id, name, t1p1:players!teams_player1_id_fkey(name), t1p2:players!teams_player2_id_fkey(name)),
    team2:teams!matches_team2_id_fkey(id, name, t2p1:players!teams_player1_id_fkey(name), t2p2:players!teams_player2_id_fkey(name)),
    p1:players!matches_player1_individual_id_fkey(id, name),
    p2:players!matches_player2_individual_id_fkey(id, name),
    p3:players!matches_player3_individual_id_fkey(id, name),
    p4:players!matches_player4_individual_id_fkey(id, name)
  `

  try {
    // OPTIMIZED: Single combined query instead of sequential loop (was 4*N queries!)
    console.time('[Dashboard] Fetch matches (single query)')
    const matchConditions: string[] = []
    if (teamIds.length > 0) {
      matchConditions.push(`team1_id.in.(${teamIds.join(',')})`)
      matchConditions.push(`team2_id.in.(${teamIds.join(',')})`)
    }
    if (playerIds.length > 0) {
      matchConditions.push(`player1_individual_id.in.(${playerIds.join(',')})`)
      matchConditions.push(`player2_individual_id.in.(${playerIds.join(',')})`)
      matchConditions.push(`player3_individual_id.in.(${playerIds.join(',')})`)
      matchConditions.push(`player4_individual_id.in.(${playerIds.join(',')})`)
    }

    let matchesData: any[] = []
    if (matchConditions.length > 0) {
      const { data: fetchedMatches, error: matchError } = await supabase
        .from('matches')
        .select(selectFields)
        .or(matchConditions.join(','))
        .order('scheduled_time', { ascending: true })
        .limit(500)

      if (matchError) {
        console.warn('[PlayerDashboard] Matches query error:', matchError)
      } else {
        matchesData = fetchedMatches || []
      }
    }
    console.timeEnd('[Dashboard] Fetch matches (single query)')

    if (matchesData.length === 0) {
      await fetchLeagueStandingsOnly(playerAccount.id, name || '', result, playerIds, teamIds)
      console.timeEnd('[Dashboard] Total load time')
      return result
    }

    // Resolve nomes reais via RPC (bypassa RLS) + player_accounts — joins aninhados falham em cross-tournament
    const teamIdsFromMatches = new Set<string>()
    const individualPlayersForNames: Array<{ id?: string | null; name?: string | null }> = []
    matchesData.forEach((m: any) => {
      if (m.team1_id) teamIdsFromMatches.add(m.team1_id)
      if (m.team2_id) teamIdsFromMatches.add(m.team2_id)
      if (m.p1) individualPlayersForNames.push(m.p1)
      if (m.p2) individualPlayersForNames.push(m.p2)
      if (m.p3) individualPlayersForNames.push(m.p3)
      if (m.p4) individualPlayersForNames.push(m.p4)
    })

    const [teamPlayerNamesMap, individualNamesMap] = await Promise.all([
      resolveTeamPlayerNamesMap(teamIdsFromMatches),
      resolveIndividualPlayerNames(individualPlayersForNames),
    ])

    // Process matchesData from the combined queries above
    let wins = 0
    let draws = 0
    let losses = 0
    const matches: PlayerMatch[] = (matchesData as any[]).map((m) => {
      const isIndividual = m.p1 || m.p2 || m.p3 || m.p4
      const team1Name = isIndividual
        ? `${m.p1?.name || 'TBD'}${m.p2 ? ' / ' + m.p2.name : ''}`
        : m.team1?.name || 'TBD'
      const team2Name = isIndividual
        ? `${m.p3?.name || 'TBD'}${m.p4 ? ' / ' + m.p4.name : ''}`
        : m.team2?.name || 'TBD'

      let p1Name: string | undefined
      let p2Name: string | undefined
      let p3Name: string | undefined
      let p4Name: string | undefined
      let p1Avatar: string | null | undefined
      let p2Avatar: string | null | undefined
      let p3Avatar: string | null | undefined
      let p4Avatar: string | null | undefined

      if (isIndividual) {
        const r1 = m.p1?.id ? individualNamesMap.get(m.p1.id) : null
        const r2 = m.p2?.id ? individualNamesMap.get(m.p2.id) : null
        const r3 = m.p3?.id ? individualNamesMap.get(m.p3.id) : null
        const r4 = m.p4?.id ? individualNamesMap.get(m.p4.id) : null
        p1Name = r1?.name || m.p1?.name
        p2Name = r2?.name || m.p2?.name
        p3Name = r3?.name || m.p3?.name
        p4Name = r4?.name || m.p4?.name
        p1Avatar = r1?.avatar_url
        p2Avatar = r2?.avatar_url
        p3Avatar = r3?.avatar_url
        p4Avatar = r4?.avatar_url
      } else {
        const team1Players = m.team1_id ? teamPlayerNamesMap.get(m.team1_id) : null
        const team2Players = m.team2_id ? teamPlayerNamesMap.get(m.team2_id) : null

        // Prefer resolved names (RPC + player_accounts); nested joins only as weak fallback
        p1Name = team1Players?.player1_name || (m.team1 as any)?.t1p1?.name
        p2Name = team1Players?.player2_name || (m.team1 as any)?.t1p2?.name
        p3Name = team2Players?.player1_name || (m.team2 as any)?.t2p1?.name
        p4Name = team2Players?.player2_name || (m.team2 as any)?.t2p2?.name
        p1Avatar = team1Players?.player1_avatar
        p2Avatar = team1Players?.player2_avatar
        p3Avatar = team2Players?.player1_avatar
        p4Avatar = team2Players?.player2_avatar
      }
      const { team1Sets, team2Sets, hasPlayedSets } = computeSetCounts(m)
      let is_winner: boolean | null | undefined
      let my_side: 1 | 2 | undefined
      const isPlayerInTeam1 = isIndividual
        ? playerIds.includes(m.p1?.id) || playerIds.includes(m.p2?.id)
        : teamIds.includes(m.team1?.id)
      my_side = isPlayerInTeam1 ? 1 : 2
      if (m.status === 'completed' && hasPlayedSets) {
        is_winner = matchOutcome(isPlayerInTeam1, team1Sets, team2Sets)
        if (is_winner === true) wins++
        else if (is_winner === false) losses++
        else draws++
      }
      const set1 =
        m.team1_score_set1 != null && m.team2_score_set1 != null
          ? `${m.team1_score_set1}-${m.team2_score_set1}`
          : undefined
      const set2 =
        m.team1_score_set2 != null && m.team2_score_set2 != null && (m.team1_score_set2 > 0 || m.team2_score_set2 > 0)
          ? `${m.team1_score_set2}-${m.team2_score_set2}`
          : undefined
      const set3 =
        m.team1_score_set3 != null && m.team2_score_set3 != null && (m.team1_score_set3 > 0 || m.team2_score_set3 > 0)
          ? `${m.team1_score_set3}-${m.team2_score_set3}`
          : undefined
      return {
        id: m.id,
        tournament_id: m.tournament_id,
        tournament_name: m.tournaments?.name || '',
        court: m.court || '',
        start_time: m.scheduled_time || '',
        team1_name: team1Name,
        team2_name: team2Name,
        player1_name: p1Name ?? undefined,
        player2_name: p2Name ?? undefined,
        player3_name: p3Name ?? undefined,
        player4_name: p4Name ?? undefined,
        player1_avatar: p1Avatar,
        player2_avatar: p2Avatar,
        player3_avatar: p3Avatar,
        player4_avatar: p4Avatar,
        my_side,
        score1: team1Sets,
        score2: team2Sets,
        status: m.status,
        round: m.round || '',
        is_winner,
        set1,
        set2,
        set3,
      }
    })
    const upcomingMatches = matches.filter((m) => new Date(m.start_time) >= now && m.status === 'scheduled')
    const recentMatches = matches.filter((m) => m.status === 'completed').reverse()
    
    // Fetch open games and combine with tournament matches (consolidated, was duplicated)
    const openGameMatches = await fetchOpenGameMatches(playerAccount.id, userId)
    result.upcomingMatches = [...upcomingMatches, ...openGameMatches].sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    )

    // Fetch confirmed open game results and merge with tournament recentMatches
    try {
      const { fetchConfirmedOpenGameResults } = await import('./openGames')
      const openGameResults = await fetchConfirmedOpenGameResults(userId, playerAccount.id)
      
      // Convert to PlayerMatch format and merge
      const openResultMatches: PlayerMatch[] = openGameResults.map(r => ({
        id: r.id,
        tournament_id: r.tournament_id,
        tournament_name: r.tournament_name,
        court: r.court,
        start_time: r.start_time,
        team1_name: r.team1_name,
        team2_name: r.team2_name,
        player1_name: r.player1_name,
        player2_name: r.player2_name,
        player3_name: r.player3_name,
        player4_name: r.player4_name,
        player1_avatar: (r as any).player1_avatar,
        player2_avatar: (r as any).player2_avatar,
        player3_avatar: (r as any).player3_avatar,
        player4_avatar: (r as any).player4_avatar,
        my_side: (r as any).my_side,
        score1: r.score1,
        score2: r.score2,
        status: r.status,
        round: r.round,
        is_winner: r.is_winner,
        set1: r.set1,
        set2: r.set2,
        set3: r.set3,
        is_open_game: true,
        open_game_id: r.open_game_id,
        club_name: r.club_name,
      }))
      
      // Merge and sort by date descending
      const allRecent = [...recentMatches, ...openResultMatches]
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
      
      result.recentMatches = allRecent
      
      // Count open game wins/draws/losses for stats
      openGameResults.forEach(r => {
        if (r.is_winner === true) wins++
        else if (r.is_winner === false) losses++
        else if (r.is_winner === null) draws++
      })
    } catch (err) {
      console.error('[PlayerDashboard] Error fetching open game results:', err)
      result.recentMatches = recentMatches
    }

    const totalMatches = wins + draws + losses
    result.stats.totalMatches = totalMatches
    result.stats.wins = wins
    result.stats.draws = draws
    result.stats.losses = losses
    result.stats.winRate = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 0

    // Do NOT persist wins/losses here — a stale client path used to write draws as
    // losses and overwrite the correct edge stats a moment later. Persistence happens
    // only after edge enrichment (authoritative).
  } catch (err) {
    console.error('[PlayerDashboard] Error fetching matches:', err)
    // Fallback: continue with empty matches but still fetch league standings
    await fetchLeagueStandingsOnly(playerAccount.id, name || '', result, playerIds, teamIds)
    console.timeEnd('[Dashboard] Total load time')
    return result
  }

  await fetchLeagueStandingsOnly(playerAccount.id, name || '', result, playerIds, teamIds)

  // Edge Function is now called separately via enrichDashboardWithEdgeFunction()
  // This allows the dashboard to render immediately with direct query data

  console.timeEnd('[Dashboard] Total load time')
  return result
}

/**
 * Enrich dashboard data with Edge Function (uses service role, bypasses RLS).
 * Call this AFTER the initial dashboard is displayed for progressive loading.
 * Returns partial data to merge, or null if failed.
 * @param currentDashboardData - Current dashboard data to merge with (preserves open games)
 */
export async function enrichDashboardWithEdgeFunction(currentDashboardData?: PlayerDashboardData | null): Promise<Partial<PlayerDashboardData> | null> {
  try {
    const t0 = performance.now()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return null

    // Usar fetch() direto em vez de supabase.functions.invoke() para evitar 401
    const supabaseUrl = 'https://rqiwnxcexsccguruiteq.supabase.co'
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxaXdueGNleHNjY2d1cnVpdGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3Njc5MzcsImV4cCI6MjA3NTM0MzkzN30.Dl05zPQDtPVpmvn_Y-JokT3wDq0Oh9uF3op5xcHZpkY'
    const response = await fetch(`${supabaseUrl}/functions/v1/get-player-dashboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        accountId: currentDashboardData?.playerAccountId ?? null,
      }),
    })

    if (!response.ok) {
      console.warn('[Dashboard] Edge Function error:', response.status, response.statusText)
      return null
    }
    const edgeData = await response.json()
    if (!edgeData || edgeData.error) return null

    const enriched: Partial<PlayerDashboardData> = {}
    if (edgeData.leagueStandings?.length) enriched.leagueStandings = edgeData.leagueStandings
    if (edgeData.pastTournaments?.length) enriched.pastTournaments = edgeData.pastTournaments
    if (edgeData.pastTournamentDetails && Object.keys(edgeData.pastTournamentDetails).length > 0) {
      enriched.pastTournamentDetails = edgeData.pastTournamentDetails
    }
    // Merge stats from edge function (bypasses RLS, always has correct data)
    // Edge Function now includes open game results in stats
    if (edgeData.stats) {
      // Check if Edge Function already includes open games (v2+)
      const edgeHasOpenGames = (edgeData.recentMatches || []).some((m: any) => m.is_open_game)
      
      if (edgeHasOpenGames) {
        // Edge Function v2+ already includes open games in stats
        enriched.stats = {
          totalMatches: edgeData.stats.totalMatches || 0,
          wins: edgeData.stats.wins || 0,
          draws: edgeData.stats.draws || 0,
          losses: edgeData.stats.losses || 0,
          winRate: edgeData.stats.winRate || 0,
          tournamentsPlayed: edgeData.pastTournaments?.length || 0,
          bestFinish: '-',
        }
      } else {
        // Edge Function v1 (doesn't include open games) - add open game stats from client
        let openGameWins = 0
        let openGameDraws = 0
        let openGameLosses = 0
        ;(currentDashboardData?.recentMatches || []).filter(m => m.is_open_game).forEach(m => {
          if (m.is_winner === true) openGameWins++
          else if (m.is_winner === false) openGameLosses++
          else if (m.is_winner === null) openGameDraws++
        })
        const totalWins = (edgeData.stats.wins || 0) + openGameWins
        const totalDraws = (edgeData.stats.draws || 0) + openGameDraws
        const totalLosses = (edgeData.stats.losses || 0) + openGameLosses
        const decided = totalWins + totalLosses
        enriched.stats = {
          totalMatches: (edgeData.stats.totalMatches || 0) + openGameWins + openGameDraws + openGameLosses,
          wins: totalWins,
          draws: totalDraws,
          losses: totalLosses,
          winRate: decided > 0 ? Math.round((totalWins / decided) * 100) : 0,
          tournamentsPlayed: edgeData.pastTournaments?.length || 0,
          bestFinish: '-',
        }
      }
    }
    // Merge recent matches from edge function (bypasses RLS for stats/visibility)
    // BUT prefer client-resolved player names (RPC + player_accounts) when edge still
    // returns team labels / placeholders — that was the persistent "bolinhas" bug.
    if (edgeData.recentMatches?.length) {
      const clientMatches = currentDashboardData?.recentMatches || []
      const clientById = new Map(clientMatches.map((m) => [m.id, m]))
      const clientByOpenId = new Map(
        clientMatches
          .filter((m) => m.open_game_id)
          .map((m) => [m.open_game_id as string, m]),
      )
      const findClient = (em: PlayerMatch) =>
        clientById.get(em.id) ||
        (em.open_game_id ? clientByOpenId.get(em.open_game_id) : undefined) ||
        (typeof em.id === 'string' && em.id.startsWith('open_result_')
          ? clientByOpenId.get(em.id.replace(/^open_result_/, ''))
          : undefined)

      const mergeNames = (edgeMatches: PlayerMatch[]) =>
        edgeMatches.map((em) => normalizeMatchWinner(preferResolvedMatchNames(findClient(em), em)))

      // Check if Edge Function already includes open games
      const edgeOpenGames = edgeData.recentMatches.filter((m: any) => m.is_open_game)
      
      if (edgeOpenGames.length > 0) {
        // Edge Function v2+ already includes open games - use directly (with name merge)
        enriched.recentMatches = mergeNames(edgeData.recentMatches)
          .sort((a: any, b: any) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
      } else {
        // Edge Function v1 - merge with client-side open games
        const currentOpenGames = (currentDashboardData?.recentMatches || [])
          .filter(m => m.is_open_game)
          .map(normalizeMatchWinner)
        const allMatches = [...mergeNames(edgeData.recentMatches), ...currentOpenGames]
          .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
        enriched.recentMatches = allMatches
      }

      // Patch stats if any American tie (5-5) was wrongly marked as loss before normalize
      if (enriched.stats && enriched.recentMatches) {
        let lossToDraw = 0
        for (let i = 0; i < edgeData.recentMatches.length; i++) {
          const raw = edgeData.recentMatches[i]
          const fixed = normalizeMatchWinner(raw)
          if (raw.is_winner === false && fixed.is_winner === null) lossToDraw++
        }
        if (lossToDraw > 0) {
          const draws = (enriched.stats.draws || 0) + lossToDraw
          const losses = Math.max(0, (enriched.stats.losses || 0) - lossToDraw)
          const wins = enriched.stats.wins || 0
          const decided = wins + losses
          enriched.stats = {
            ...enriched.stats,
            draws,
            losses,
            totalMatches: wins + draws + losses,
            winRate: decided > 0 ? Math.round((wins / decided) * 100) : 0,
          }
        }
      }
    } else if (currentDashboardData?.recentMatches) {
      // If edge function doesn't return matches, keep current ones (includes open games)
      enriched.recentMatches = currentDashboardData.recentMatches.map(normalizeMatchWinner)
    }

    // Persist authoritative stats (avoids client race that rewrote draws as losses)
    const accountId = currentDashboardData?.playerAccountId
    if (enriched.stats && accountId) {
      const { wins, losses } = enriched.stats
      supabase
        .from('player_accounts')
        .update({ wins, losses })
        .eq('id', accountId)
        .then(({ error }) => {
          if (error) console.warn('[Dashboard] Failed to persist edge stats:', error.message)
          else console.log('[Dashboard] Persisted edge stats: wins=', wins, 'losses=', losses, 'draws=', enriched.stats?.draws)
        })
    }

    return Object.keys(enriched).length > 0 ? enriched : null
  } catch (err) {
    console.error('[Dashboard] Edge Function error:', err)
    return null
  }
}

async function fetchLeagueStandingsOnly(
  playerAccountId: string,
  playerName: string,
  result: PlayerDashboardData,
  playerIds: string[] = [],
  teamIds: string[] = []
): Promise<void> {
  // Priority: player_account_id (most reliable) > entity_id > entity_name (fallback)
  const conditions: string[] = []
  
  // First priority: use player_account_id if available
  if (playerAccountId) {
    conditions.push(`player_account_id.eq.${playerAccountId}`)
  }
  
  // Second priority: use entity_id (player IDs from tournaments)
  if (playerIds.length > 0) {
    conditions.push(`entity_id.in.(${playerIds.join(',')})`)
  }
  
  // Third priority: use entity_name as fallback (only if no player_account_id or entity_id)
  if (playerName && (!playerAccountId || conditions.length === 0)) {
    conditions.push(`entity_name.ilike.%${(playerName || '').trim()}%`)
  }
  
  // Team IDs (for team-based leagues)
  if (teamIds.length > 0) {
    conditions.push(`entity_id.in.(${teamIds.join(',')})`)
  }
  
  if (conditions.length === 0) return
  
  const { data: standings, error: standingsError } = await supabase
    .from('league_standings')
    .select(
      `
      id, league_id, total_points, tournaments_played, entity_name, player_account_id, category,
      leagues!inner(id, name, status, end_date, categories)
    `
    )
    .or(conditions.join(','))
    .order('total_points', { ascending: false })
  if (standingsError) console.warn('[LeagueStandings] Error:', standingsError)
  if (!standings || standings.length === 0) return

  // OPTIMIZED: Batch fetch all league standings (was N+1 queries, now 1 query)
  const leagueIds = [...new Set((standings as any[]).map((s: any) => s.leagues?.id).filter(Boolean))]
  const { data: allLeagueStandings } = leagueIds.length > 0
    ? await supabase
        .from('league_standings')
        .select('id, league_id, total_points')
        .in('league_id', leagueIds)
        .order('total_points', { ascending: false })
    : { data: [] }

  // Group by league_id for fast lookup
  const standingsByLeague = new Map<string, any[]>()
  ;(allLeagueStandings || []).forEach((s: any) => {
    const list = standingsByLeague.get(s.league_id) || []
    list.push(s)
    standingsByLeague.set(s.league_id, list)
  })

  const leagueData = (standings as any[]).map((s: any) => {
    const leagueId = s.leagues?.id
    const leagueStandings = standingsByLeague.get(leagueId) || []
    const position = leagueStandings.findIndex((st: any) => st.id === s.id) + 1
    return {
      league_id: leagueId,
      league_name: s.leagues?.name || '',
      league_status: s.leagues?.status || 'active',
      league_end_date: s.leagues?.end_date || null,
      league_categories: s.leagues?.categories || [],
      player_category: s.category || null,
      position,
      total_participants: leagueStandings.length,
      points: s.total_points,
      tournaments_played: s.tournaments_played,
    }
  })
  result.leagueStandings = leagueData
}

export async function fetchLeagueFullStandings(
  leagueId: string,
  playerName: string
): Promise<LeagueFullStanding[]> {
  // Fetch standings with player_account info for consistent names and avatars
  const { data: allStandings } = await supabase
    .from('league_standings')
    .select(`
      entity_name, 
      total_points, 
      tournaments_played, 
      best_position,
      player_account_id,
      player_accounts:player_account_id(name, avatar_url)
    `)
    .eq('league_id', leagueId)
    .order('total_points', { ascending: false })

  if (!allStandings) return []
  
  // Use player_account name/avatar if available, otherwise fallback to entity_name
  return allStandings.map((s: any, index: number) => {
    const displayName = s.player_accounts?.name || s.entity_name || 'Desconhecido'
    const normalizedPlayerName = playerName?.toLowerCase().trim() || ''
    const normalizedDisplayName = displayName.toLowerCase().trim()
    const normalizedEntityName = s.entity_name?.toLowerCase().trim() || ''
    
    return {
      position: index + 1,
      entity_name: displayName,
      total_points: s.total_points,
      tournaments_played: s.tournaments_played,
      best_position: s.best_position ?? 0,
      is_current_player: normalizedPlayerName && (
        normalizedDisplayName === normalizedPlayerName || 
        normalizedEntityName === normalizedPlayerName
      ),
      avatar_url: s.player_accounts?.avatar_url || null,
      player_account_id: s.player_account_id || null,
    }
  })
}

export interface TournamentStandingRow {
  id: string
  name: string
  group_name?: string
  final_position?: number
  wins: number
  draws: number
  losses: number
  points_for: number
  points_against: number
  points: number
  player1_name?: string
  player2_name?: string
  category_id?: string
}

export interface TournamentMyMatch {
  id: string
  court: string
  scheduled_time: string
  team1_name: string
  team2_name: string
  team1_score: number
  team2_score: number
  set1?: string
  set2?: string
  set3?: string
  status: string
  round: string
  is_winner?: boolean
  category_id?: string
}

export async function fetchTournamentStandingsAndMatches(
  tournamentId: string,
  userId: string
): Promise<{ standings: TournamentStandingRow[]; myMatches: TournamentMyMatch[]; tournamentName: string; playerPosition?: number; categoryStandings?: Record<string, CategoryStandingDetail> }> {
  let tournamentName = ''

  const [{ data: tournament }, { data: matches }, { data: teams, error: teamsError }, { data: rpcPlayers }, { data: tournamentCategories }] = await Promise.all([
    supabase.from('tournaments').select('name, format').eq('id', tournamentId).maybeSingle(),
    supabase
      .from('matches')
      .select(
        'id, team1_id, team2_id, player1_individual_id, player2_individual_id, player3_individual_id, player4_individual_id, team1_score_set1, team2_score_set1, team1_score_set2, team2_score_set2, team1_score_set3, team2_score_set3, status, round, category_id'
      )
      .eq('tournament_id', tournamentId)
      .eq('status', 'completed'),
    supabase.from('teams').select('id, name, group_name, final_position, player1_id, player2_id, category_id').eq('tournament_id', tournamentId),
    supabase.rpc('get_tournament_player_names', { tournament_uuid: tournamentId }),
    supabase.from('tournament_categories').select('id, name').eq('tournament_id', tournamentId).order('name'),
  ])

  if (teamsError) {
    console.error('[fetchTournamentStandingsAndMatches] Error fetching teams:', teamsError)
  }

  // Mapa de nomes: RPC bypassa RLS, tem SEMPRE todos os nomes (usa player_accounts como fonte central)
  const playerNamesMap = new Map<string, string>()
  const players: any[] = [] // Para compatibilidade com lógica individual
  if (rpcPlayers && Array.isArray(rpcPlayers)) {
    rpcPlayers.forEach((p: any) => {
      playerNamesMap.set(p.player_id, p.player_name)
      // RPC v2 devolve group_name/final_position; v1 não — guardar o que existir
      players.push({ 
        id: p.player_id, 
        name: p.player_name,
        group_name: p.group_name || undefined,
        final_position: p.final_position || undefined,
      })
    })
  }

  // Complementar com dados da tabela players (group_name, final_position) se a RPC não os tem
  // Também serve como fallback completo se a RPC falhou
  const needsExtra = players.length === 0 || !players[0].group_name
  if (needsExtra) {
    const { data: directPlayers } = await supabase.from('players').select('id, name, group_name, final_position, category_id').eq('tournament_id', tournamentId)
    if (directPlayers && directPlayers.length > 0) {
      if (players.length === 0) {
        // RPC falhou — usar dados directos
        directPlayers.forEach((p: any) => {
          playerNamesMap.set(p.id, p.name)
          players.push(p)
        })
      } else {
        // RPC funcionou para nomes, enriquecer com group_name/final_position
        const extraMap = new Map<string, any>()
        directPlayers.forEach((p: any) => extraMap.set(p.id, p))
        players.forEach((p: any) => {
          const extra = extraMap.get(p.id)
          if (extra) {
            if (!p.group_name) p.group_name = extra.group_name
            if (!p.final_position) p.final_position = extra.final_position
            if (!p.category_id) p.category_id = extra.category_id
          }
        })
      }
    }
  }

  // FIX: Equipas podem referenciar jogadores de OUTROS torneios (ex: ligas com jornadas)
  // Buscar nomes dos jogadores que estão nas equipas mas NÃO foram devolvidos pelo RPC
  if (teams && teams.length > 0) {
    const missingTeamPlayerIds = new Set<string>()
    teams.forEach((t: any) => {
      if (t.player1_id && !playerNamesMap.has(t.player1_id)) missingTeamPlayerIds.add(t.player1_id)
      if (t.player2_id && !playerNamesMap.has(t.player2_id)) missingTeamPlayerIds.add(t.player2_id)
    })
    if (missingTeamPlayerIds.size > 0) {
      // Usar RPC com cada tournament_id dos jogadores em falta? Não — buscar directamente
      // Como a RPC faz SECURITY DEFINER, podemos chamar com os IDs directos
      const { data: crossPlayers } = await supabase
        .from('players')
        .select('id, name, player_account_id')
        .in('id', Array.from(missingTeamPlayerIds))
      if (crossPlayers && crossPlayers.length > 0) {
        // Tentar obter nome do player_accounts (centralizado) para os que têm player_account_id
        const paIds = crossPlayers.filter(p => p.player_account_id).map(p => p.player_account_id)
        let paMap = new Map<string, string>()
        if (paIds.length > 0) {
          const { data: paData } = await supabase
            .from('player_accounts')
            .select('id, name')
            .in('id', paIds)
          if (paData) {
            paData.forEach((pa: any) => paMap.set(pa.id, pa.name))
          }
        }
        crossPlayers.forEach((p: any) => {
          const paName = p.player_account_id ? paMap.get(p.player_account_id) : undefined
          playerNamesMap.set(p.id, paName || p.name)
        })
      }
      // Fallback final: parse do nome da equipa "Player1 / Player2" ou "Player1 - Player2"
      teams.forEach((t: any) => {
        if (t.player1_id && !playerNamesMap.has(t.player1_id) || t.player2_id && !playerNamesMap.has(t.player2_id)) {
          const parts = (t.name || '').split(/\s*[-\/\\&]\s*/)
          if (parts.length >= 2) {
            if (t.player1_id && !playerNamesMap.has(t.player1_id) && parts[0]?.trim()) {
              playerNamesMap.set(t.player1_id, parts[0].trim())
            }
            if (t.player2_id && !playerNamesMap.has(t.player2_id) && parts[1]?.trim()) {
              playerNamesMap.set(t.player2_id, parts[1].trim())
            }
          }
        }
      })
    }
  }


  if (tournament) tournamentName = tournament.name || ''

  const isIndividual = (players?.length || 0) > 0 && (teams?.length || 0) === 0
  const isMixedAmerican = tournament && (tournament as any).format === 'mixed_american'
  const standingsMap = new Map<string, any>()

  if (isIndividual && players) {
    players.forEach((p: any) => {
      standingsMap.set(p.id, {
        id: p.id,
        name: p.name,
        group_name: p.group_name || 'Geral',
        final_position: p.final_position || null,
        wins: 0,
        draws: 0,
        losses: 0,
        points_for: 0,
        points_against: 0,
        points: 0,
        category_id: p.category_id || null,
      })
    })
    ;(matches || []).forEach((m: any) => {
      const t1s = (m.team1_score_set1 || 0) + (m.team1_score_set2 || 0) + (m.team1_score_set3 || 0)
      const t2s = (m.team2_score_set1 || 0) + (m.team2_score_set2 || 0) + (m.team2_score_set3 || 0)
      ;[m.player1_individual_id, m.player2_individual_id].filter(Boolean).forEach((pid: string) => {
        const s = standingsMap.get(pid)
        if (s) {
          s.points_for += t1s
          s.points_against += t2s
          if (t1s > t2s) {
            s.wins++
            s.points += 2
          } else if (t1s === t2s) {
            s.draws++
            s.points += 1
          } else {
            s.losses++
          }
        }
      })
      ;[m.player3_individual_id, m.player4_individual_id].filter(Boolean).forEach((pid: string) => {
        const s = standingsMap.get(pid)
        if (s) {
          s.points_for += t2s
          s.points_against += t1s
          if (t2s > t1s) {
            s.wins++
            s.points += 2
          } else if (t2s === t1s) {
            s.draws++
            s.points += 1
          } else {
            s.losses++
          }
        }
      })
    })
  } else if (teams) {
    teams.forEach((t: any) => {
      // Nomes via RPC (bypassa RLS) → playerNamesMap
      let finalP1Name = t.player1_id ? playerNamesMap.get(t.player1_id) : undefined
      let finalP2Name = t.player2_id ? playerNamesMap.get(t.player2_id) : undefined
      
      // Fallback: parse do nome da equipa "Player1 / Player2"
      if (!finalP1Name || !finalP2Name) {
        const parts = (t.name || '').split(/\s*[\/\\]\s*/)
        if (!finalP1Name && parts[0]?.trim()) finalP1Name = parts[0].trim()
        if (!finalP2Name && parts[1]?.trim()) finalP2Name = parts[1].trim()
      }
      
      standingsMap.set(t.id, {
        id: t.id,
        name: t.name,
        group_name: t.group_name || 'Geral',
        final_position: t.final_position,
        wins: 0,
        draws: 0,
        losses: 0,
        points_for: 0,
        points_against: 0,
        points: 0,
        player1_name: finalP1Name,
        player2_name: finalP2Name,
        category_id: (t as any).category_id || null,
      })
    })
    ;(matches || []).forEach((m: any) => {
      if (!m.team1_id || !m.team2_id) return
      const t1s = (m.team1_score_set1 || 0) + (m.team1_score_set2 || 0) + (m.team1_score_set3 || 0)
      const t2s = (m.team2_score_set1 || 0) + (m.team2_score_set2 || 0) + (m.team2_score_set3 || 0)
      const s1 = standingsMap.get(m.team1_id)
      const s2 = standingsMap.get(m.team2_id)
      if (s1) {
        s1.points_for += t1s
        s1.points_against += t2s
        if (t1s > t2s) {
          s1.wins++
          s1.points += 2
        } else if (t1s === t2s) {
          s1.draws++
          s1.points += 1
        } else {
          s1.losses++
        }
      }
      if (s2) {
        s2.points_for += t2s
        s2.points_against += t1s
        if (t2s > t1s) {
          s2.wins++
          s2.points += 2
        } else if (t2s === t1s) {
          s2.draws++
          s2.points += 1
        } else {
          s2.losses++
        }
      }
    })
  }

  // Confronto direto: verifica quem ganhou o jogo entre duas entidades
  const getHeadToHead = (idA: string, idB: string): number => {
    const directMatches = (matches || []).filter((m: any) => {
      if (isIndividual) {
        const t1 = [m.player1_individual_id, m.player2_individual_id].filter(Boolean)
        const t2 = [m.player3_individual_id, m.player4_individual_id].filter(Boolean)
        return (t1.includes(idA) && t2.includes(idB)) || (t1.includes(idB) && t2.includes(idA))
      }
      return (m.team1_id === idA && m.team2_id === idB) || (m.team1_id === idB && m.team2_id === idA)
    })
    if (directMatches.length === 0) return 0
    let aWins = 0, bWins = 0
    for (const m of directMatches) {
      const t1s = (m.team1_score_set1 || 0) + (m.team1_score_set2 || 0) + (m.team1_score_set3 || 0)
      const t2s = (m.team2_score_set1 || 0) + (m.team2_score_set2 || 0) + (m.team2_score_set3 || 0)
      const team1IsA = isIndividual
        ? [m.player1_individual_id, m.player2_individual_id].filter(Boolean).includes(idA)
        : m.team1_id === idA
      if (t1s > t2s) { if (team1IsA) aWins++; else bWins++ }
      else if (t2s > t1s) { if (team1IsA) bWins++; else aWins++ }
    }
    if (aWins > bWins) return -1 // A fica à frente
    if (bWins > aWins) return 1  // B fica à frente
    return 0
  }

  // Para torneios MISTOS: se não tiver final_position na DB, calcular baseado nas fases finais
  if (isMixedAmerican && isIndividual) {
    const allMatches = matches || []
    const finalMatch = allMatches.find((m: any) => (m.round === 'final' || m.round === 'mixed_final') && m.status === 'completed')
    const thirdPlaceMatch = allMatches.find((m: any) => (m.round === '3rd_place' || m.round === 'mixed_3rd_place') && m.status === 'completed')
    
    // Se tiver final_position na DB, usar (já foi calculado pelo Standings.tsx)
    const hasFinalPositions = Array.from(standingsMap.values()).some((s: any) => s.final_position != null)
    
    if (!hasFinalPositions && (finalMatch || thirdPlaceMatch)) {
      // Calcular classificação final baseada nas fases finais (replicar lógica do Standings.tsx)
      const sortByGroupStats = (playerIds: string[]): string[] => {
        return [...playerIds].sort((a, b) => {
          const sa = standingsMap.get(a) || { wins: 0, points_for: 0, points_against: 0 }
          const sb = standingsMap.get(b) || { wins: 0, points_for: 0, points_against: 0 }
          if (sb.wins !== sa.wins) return sb.wins - sa.wins
          const diffA = sa.points_for - sa.points_against
          const diffB = sb.points_for - sb.points_against
          if (diffB !== diffA) return diffB - diffA
          return sb.points_for - sa.points_for
        })
      }

      const getMatchWL = (match: any) => {
        const t1 = (match.team1_score_set1 || 0) + (match.team1_score_set2 || 0) + (match.team1_score_set3 || 0)
        const t2 = (match.team2_score_set1 || 0) + (match.team2_score_set2 || 0) + (match.team2_score_set3 || 0)
        const team1 = [match.player1_individual_id, match.player2_individual_id].filter(Boolean)
        const team2 = [match.player3_individual_id, match.player4_individual_id].filter(Boolean)
        return { winners: t1 > t2 ? team1 : team2, losers: t1 > t2 ? team2 : team1 }
      }

      const rankedIds = new Set<string>()

      if (finalMatch) {
        const { winners, losers } = getMatchWL(finalMatch)
        // 1°, 2° — Vencedores da Final
        sortByGroupStats(winners).forEach((pid: string, idx: number) => {
          const s = standingsMap.get(pid)
          if (s) {
            s.final_position = idx + 1
            rankedIds.add(pid)
          }
        })
        // 3°, 4° — Vencidos da Final
        sortByGroupStats(losers).forEach((pid: string, idx: number) => {
          const s = standingsMap.get(pid)
          if (s) {
            s.final_position = 3 + idx
            rankedIds.add(pid)
          }
        })
      }

      if (thirdPlaceMatch) {
        const { winners, losers } = getMatchWL(thirdPlaceMatch)
        // 5°, 6° — Vencedores da Pequena Final
        sortByGroupStats(winners.filter((id: string) => !rankedIds.has(id))).forEach((pid: string, idx: number) => {
          const s = standingsMap.get(pid)
          if (s) {
            s.final_position = 5 + idx
            rankedIds.add(pid)
          }
        })
        // 7°, 8° — Vencidos da Pequena Final
        sortByGroupStats(losers.filter((id: string) => !rankedIds.has(id))).forEach((pid: string, idx: number) => {
          const s = standingsMap.get(pid)
          if (s) {
            s.final_position = 7 + idx
            rankedIds.add(pid)
          }
        })
      }

      // Restantes por performance de grupo
      const remaining = Array.from(standingsMap.keys()).filter(id => !rankedIds.has(id))
      if (remaining.length > 0) {
        const maxPos = Math.max(...Array.from(standingsMap.values()).map((s: any) => s.final_position || 0))
        sortByGroupStats(remaining).forEach((pid, idx) => {
          const s = standingsMap.get(pid)
          if (s) {
            s.final_position = maxPos + 1 + idx
          }
        })
      }
    }
  }

  // Contar quantas entidades (sem final_position) partilham o mesmo grupo + vitórias + pontos
  const unsortedStandings = Array.from(standingsMap.values())
  const groupPointsCount = new Map<string, number>()
  unsortedStandings.forEach(s => {
    if (!s.final_position) {
      const key = `${s.group_name || 'Geral'}__${s.wins}__${s.points}`
      groupPointsCount.set(key, (groupPointsCount.get(key) || 0) + 1)
    }
  })

  const standingsArray = unsortedStandings.sort((a, b) => {
    if (a.final_position && b.final_position) return a.final_position - b.final_position
    if (a.final_position) return -1
    if (b.final_position) return 1
    // 1. Número de vitórias
    if (b.wins !== a.wins) return b.wins - a.wins
    // 2. Pontos (V=2, E=1, D=0)
    if (b.points !== a.points) return b.points - a.points
    // 3. Confronto direto (apenas quando exatamente 2 empatadas no mesmo grupo)
    const gKey = `${a.group_name || 'Geral'}__${a.wins}__${a.points}`
    if ((groupPointsCount.get(gKey) || 0) === 2) {
      const h2h = getHeadToHead(a.id, b.id)
      if (h2h !== 0) return h2h
    }
    // 4. Diferença de jogos (games)
    const diffA = a.points_for - a.points_against
    const diffB = b.points_for - b.points_against
    if (diffB !== diffA) return diffB - diffA
    // 5. Jogos ganhos (mais jogos a favor)
    if (b.points_for !== a.points_for) return b.points_for - a.points_for
    return 0
  })

  let myMatches: TournamentMyMatch[] = []
  const entityIds = new Set<string>()
  const { data: playerAccount } = await supabase
    .from('player_accounts')
    .select('phone_number, name')
    .eq('user_id', userId)
    .maybeSingle()

  if (playerAccount) {
    const phone = (playerAccount as any).phone_number
    const name = playerAccount.name
    const [byPhone, byName] = await Promise.all([
      phone ? supabase.from('players').select('id').eq('phone_number', phone) : { data: [] },
      name ? supabase.from('players').select('id').ilike('name', name) : { data: [] },
    ])
    const pids = new Set<string>()
    ;[(byPhone.data || []), (byName.data || [])].flat().forEach((p: any) => pids.add(p.id))
    const playerIds = Array.from(pids)
    playerIds.forEach((id) => entityIds.add(id))
    if (playerIds.length > 0) {
      const cond = playerIds.map((id) => `player1_id.eq.${id},player2_id.eq.${id}`).join(',')
      const { data: myTeams } = await supabase.from('teams').select('id').or(cond)
      const teamIds = (myTeams || []).map((t: any) => t.id)
      teamIds.forEach((id) => entityIds.add(id))
      const teamMatchCond =
        teamIds.length > 0 ? `team1_id.in.(${teamIds.join(',')}),team2_id.in.(${teamIds.join(',')})` : ''
      const pidsJoined = playerIds.join(',')
      const indCond = `player1_individual_id.in.(${pidsJoined}),player2_individual_id.in.(${pidsJoined}),player3_individual_id.in.(${pidsJoined}),player4_individual_id.in.(${pidsJoined})`
      const allCond = [teamMatchCond, indCond].filter((c) => c.length > 0).join(',')
      if (allCond) {
        const { data: playerMatches } = await supabase
          .from('matches')
          .select(
            `
            id, court, scheduled_time, team1_score_set1, team2_score_set1, team1_score_set2, team2_score_set2, team1_score_set3, team2_score_set3, status, round, team1_id, team2_id, category_id,
            team1:teams!matches_team1_id_fkey(id, name), team2:teams!matches_team2_id_fkey(id, name),
            p1:players!matches_player1_individual_id_fkey(id, name), p2:players!matches_player2_individual_id_fkey(id, name),
            p3:players!matches_player3_individual_id_fkey(id, name), p4:players!matches_player4_individual_id_fkey(id, name)
          `
          )
          .eq('tournament_id', tournamentId)
          .or(allCond)
          .order('scheduled_time', { ascending: true })

        if (playerMatches) {
          myMatches = (playerMatches as any[]).map((m: any) => {
            const isInd = m.p1 || m.p2 || m.p3 || m.p4
            const team1Name = isInd
              ? `${m.p1?.name || 'TBD'}${m.p2 ? ' / ' + m.p2.name : ''}`
              : m.team1?.name || 'TBD'
            const team2Name = isInd
              ? `${m.p3?.name || 'TBD'}${m.p4 ? ' / ' + m.p4.name : ''}`
              : m.team2?.name || 'TBD'
            const { team1Sets: t1Sets, team2Sets: t2Sets, hasPlayedSets } = computeSetCounts(m)
            let is_winner: boolean | null | undefined
            if (m.status === 'completed' && hasPlayedSets) {
              const inTeam1 = isInd
                ? playerIds.includes(m.p1?.id) || playerIds.includes(m.p2?.id)
                : teamIds.includes(m.team1?.id)
              is_winner = matchOutcome(inTeam1, t1Sets, t2Sets)
            }
            const set1 = m.team1_score_set1 != null && m.team2_score_set1 != null
              ? `${m.team1_score_set1}-${m.team2_score_set1}` : undefined
            const set2 = m.team1_score_set2 != null && m.team2_score_set2 != null && (m.team1_score_set2 > 0 || m.team2_score_set2 > 0)
              ? `${m.team1_score_set2}-${m.team2_score_set2}` : undefined
            const set3 = m.team1_score_set3 != null && m.team2_score_set3 != null && (m.team1_score_set3 > 0 || m.team2_score_set3 > 0)
              ? `${m.team1_score_set3}-${m.team2_score_set3}` : undefined
            return {
              id: m.id,
              court: m.court || '',
              scheduled_time: m.scheduled_time || '',
              team1_name: team1Name,
              team2_name: team2Name,
              team1_score: t1Sets,
              team2_score: t2Sets,
              set1,
              set2,
              set3,
              status: m.status,
              round: m.round || '',
              is_winner,
              category_id: m.category_id || undefined,
            }
          })
        }
      }
    }
  }

  let playerPosition: number | undefined
  const posIdx = standingsArray.findIndex((row) => entityIds.has(row.id))
  if (posIdx >= 0) playerPosition = posIdx + 1

  let categoryStandings: Record<string, CategoryStandingDetail> | undefined
  if (tournamentCategories && tournamentCategories.length > 0) {
    categoryStandings = {}
    const resolveMatchNames = (m: any): CategoryMatchResult => {
      let team1Name: string, team2Name: string
      if (isIndividual) {
        const p1 = m.player1_individual_id ? (playerNamesMap.get(m.player1_individual_id) || 'TBD') : 'TBD'
        const p2 = m.player2_individual_id ? (playerNamesMap.get(m.player2_individual_id) || '') : ''
        const p3 = m.player3_individual_id ? (playerNamesMap.get(m.player3_individual_id) || 'TBD') : 'TBD'
        const p4 = m.player4_individual_id ? (playerNamesMap.get(m.player4_individual_id) || '') : ''
        team1Name = p2 ? `${p1} / ${p2}` : p1
        team2Name = p4 ? `${p3} / ${p4}` : p3
      } else {
        const s1 = standingsMap.get(m.team1_id)
        const s2 = standingsMap.get(m.team2_id)
        team1Name = s1?.name || 'TBD'
        team2Name = s2?.name || 'TBD'
      }
      const set1 = m.team1_score_set1 != null && m.team2_score_set1 != null
        ? `${m.team1_score_set1}-${m.team2_score_set1}` : undefined
      const set2 = m.team1_score_set2 != null && m.team2_score_set2 != null && (m.team1_score_set2 > 0 || m.team2_score_set2 > 0)
        ? `${m.team1_score_set2}-${m.team2_score_set2}` : undefined
      const set3 = m.team1_score_set3 != null && m.team2_score_set3 != null && (m.team1_score_set3 > 0 || m.team2_score_set3 > 0)
        ? `${m.team1_score_set3}-${m.team2_score_set3}` : undefined
      return {
        id: m.id,
        team1_id: m.team1_id || m.player1_individual_id || undefined,
        team2_id: m.team2_id || m.player3_individual_id || undefined,
        team1_name: team1Name,
        team2_name: team2Name,
        set1, set2, set3,
        round: m.round || '',
        status: m.status || '',
      }
    }

    for (const cat of tournamentCategories) {
      const catStandings = standingsArray.filter((s: any) => s.category_id === cat.id)
      const catMatches = myMatches.filter(m => m.category_id === cat.id)
      const catAllRaw = (matches || []).filter((m: any) => m.category_id === cat.id && m.status === 'completed')
      const catAllMatches = catAllRaw.map(resolveMatchNames)
      let catPosition: number | undefined
      const catPosIdx = catStandings.findIndex((row: any) => entityIds.has(row.id))
      if (catPosIdx >= 0) catPosition = catPosIdx + 1
      if (catStandings.length > 0 || catMatches.length > 0 || catAllMatches.length > 0) {
        categoryStandings[cat.id] = {
          categoryName: cat.name,
          standings: catStandings,
          myMatches: catMatches,
          allMatches: catAllMatches,
          playerPosition: catPosition,
        }
      }
    }
    if (Object.keys(categoryStandings).length === 0) categoryStandings = undefined
  }

  return { standings: standingsArray, myMatches, tournamentName, playerPosition, categoryStandings }
}
