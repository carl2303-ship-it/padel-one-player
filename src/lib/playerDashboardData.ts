/**
 * Dados do dashboard do jogador – mesma lógica que Padel One Tour (PlayerDashboard).
 * Lê da mesma base Supabase; os dados ficam nos dois lados (Tour e Player).
 */
import { supabase } from './supabase'

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
  score1: number | null
  score2: number | null
  status: string
  round: string
  is_winner?: boolean
  set1?: string
  set2?: string
  set3?: string
  is_open_game?: boolean // Indica se é um jogo aberto
  open_game_id?: string // ID do jogo aberto
  club_name?: string // Nome do clube (para jogos abertos)
}

export interface LeagueStanding {
  league_id: string
  league_name: string
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
}

export interface PlayerStats {
  totalMatches: number
  wins: number
  losses: number
  winRate: number
  tournamentsPlayed: number
  bestFinish: string
}

export interface PastTournamentDetail {
  standings: any[]
  myMatches: any[]
  playerPosition?: number
  tournamentName: string
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
  losses: 0,
  winRate: 0,
  tournamentsPlayed: 0,
  bestFinish: '-',
}

export async function fetchPlayerDashboardData(userId: string): Promise<PlayerDashboardData> {
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

  const { data: playerAccount } = await supabase
    .from('player_accounts')
    .select('id, name, phone_number')
    .eq('user_id', userId)
    .maybeSingle()

  if (!playerAccount) return result

  result.playerAccountId = playerAccount.id
  result.playerName = playerAccount.name || ''

  const phone = (playerAccount as any).phone_number
  const name = playerAccount.name

  const [playersByPhone, playersByName] = await Promise.all([
    phone
      ? supabase.from('players').select('id, tournament_id').eq('phone_number', phone)
      : { data: [] },
    name
      ? supabase.from('players').select('id, tournament_id').ilike('name', name)
      : { data: [] },
  ])

  const allPlayersMap = new Map<string, { id: string; tournament_id: string | null }>()
  ;[...(playersByPhone.data || []), ...(playersByName.data || [])].forEach((p: any) => {
    allPlayersMap.set(p.id, p)
  })
  const allPlayers = Array.from(allPlayersMap.values())
  const playerIds = allPlayers.map((p) => p.id)
  const tournamentIds = allPlayers.filter((p) => p.tournament_id).map((p) => p.tournament_id!)

  if (allPlayers.length === 0) {
    await fetchLeagueStandingsOnly(playerAccount.id, name || '', result)
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
          .select('tournament_id, tournaments!inner(id, name, start_date, end_date, status)')
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

  const teamIds =
    (
      await supabase
        .from('teams')
        .select('id')
        .or(playerConditions)
    ).data?.map((t: any) => t.id) || []

  const teamMatchConditions =
    teamIds.length > 0
      ? `team1_id.in.(${teamIds.join(',')}),team2_id.in.(${teamIds.join(',')})`
      : ''
  const individualMatchConditions = playerIds
    .map(
      (id) =>
        `player1_individual_id.eq.${id},player2_individual_id.eq.${id},player3_individual_id.eq.${id},player4_individual_id.eq.${id}`
    )
    .join(',')
  const allConditions = [teamMatchConditions, individualMatchConditions].filter((c) => c.length > 0).join(',')

  if (!allConditions) {
    await fetchLeagueStandingsOnly(playerAccount.id, name || '', result, playerIds, teamIds)
    return result
  }

  const { data: matchesData } = await supabase
    .from('matches')
    .select(
      `
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
    )
    .or(allConditions)
    .order('scheduled_time', { ascending: true })

  if (matchesData) {
    let wins = 0
    let losses = 0
    const matches: PlayerMatch[] = (matchesData as any[]).map((m) => {
      const isIndividual = m.p1 || m.p2 || m.p3 || m.p4
      const team1Name = isIndividual
        ? `${m.p1?.name || 'TBD'}${m.p2 ? ' / ' + m.p2.name : ''}`
        : m.team1?.name || 'TBD'
      const team2Name = isIndividual
        ? `${m.p3?.name || 'TBD'}${m.p4 ? ' / ' + m.p4.name : ''}`
        : m.team2?.name || 'TBD'
      const p1Name = isIndividual ? m.p1?.name : (m.team1 as any)?.t1p1?.name
      const p2Name = isIndividual ? m.p2?.name : (m.team1 as any)?.t1p2?.name
      const p3Name = isIndividual ? m.p3?.name : (m.team2 as any)?.t2p1?.name
      const p4Name = isIndividual ? m.p4?.name : (m.team2 as any)?.t2p2?.name
      const team1Sets = [
        (m.team1_score_set1 || 0) > (m.team2_score_set1 || 0) ? 1 : 0,
        (m.team1_score_set2 || 0) > (m.team2_score_set2 || 0) ? 1 : 0,
        (m.team1_score_set3 || 0) > (m.team2_score_set3 || 0) ? 1 : 0,
      ].reduce((a, b) => a + b, 0)
      const team2Sets = [
        (m.team2_score_set1 || 0) > (m.team1_score_set1 || 0) ? 1 : 0,
        (m.team2_score_set2 || 0) > (m.team1_score_set2 || 0) ? 1 : 0,
        (m.team2_score_set3 || 0) > (m.team1_score_set3 || 0) ? 1 : 0,
      ].reduce((a, b) => a + b, 0)
      let is_winner: boolean | undefined
      if (m.status === 'completed' && (team1Sets > 0 || team2Sets > 0)) {
        const isPlayerInTeam1 = isIndividual
          ? playerIds.includes(m.p1?.id) || playerIds.includes(m.p2?.id)
          : teamIds.includes(m.team1?.id)
        is_winner = isPlayerInTeam1 ? team1Sets > team2Sets : team2Sets > team1Sets
        if (is_winner) wins++
        else losses++
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
    
    // Buscar jogos abertos onde o jogador está inscrito
    if (playerAccount.id) {
      // Primeiro buscar os game_ids onde o jogador está inscrito
      const { data: playerGames } = await supabase
        .from('open_game_players')
        .select('game_id')
        .eq('player_account_id', playerAccount.id)

      if (playerGames && playerGames.length > 0) {
        const gameIds = playerGames.map((pg: any) => pg.game_id).filter(Boolean)
        
        if (gameIds.length === 0) {
          result.upcomingMatches = upcomingMatches
        } else {
          // Depois buscar os jogos abertos com os filtros corretos
          const { data: openGames, error: openGamesError } = await supabase
            .from('open_games')
            .select('id, scheduled_at, status, club_id, court_name, duration_minutes, max_players')
            .in('id', gameIds)
            .gte('scheduled_at', new Date().toISOString())
            .in('status', ['open', 'full'])

          if (openGamesError) {
            console.error('[PlayerDashboard] Error fetching open games:', openGamesError)
            result.upcomingMatches = upcomingMatches
          } else if (openGames && openGames.length > 0) {

            // Buscar dados dos clubes separadamente
            let clubsMap = new Map<string, { name: string; city: string | null }>()
            const clubIds = [...new Set(openGames.map((g: any) => g.club_id).filter(Boolean))]
            if (clubIds.length > 0) {
              const { data: clubsData } = await supabase
                .from('clubs')
                .select('id, name, city')
                .in('id', clubIds)
              
              clubsData?.forEach((club: any) => {
                clubsMap.set(club.id, { name: club.name, city: club.city })
              })
            }

            // Contar jogadores em cada jogo
          const gameIds = openGames.map((g: any) => g.id)
          const { data: playersCount } = await supabase
            .from('open_game_players')
            .select('game_id')
            .in('game_id', gameIds)

          const countMap = new Map<string, number>()
          playersCount?.forEach((p: any) => {
            countMap.set(p.game_id, (countMap.get(p.game_id) || 0) + 1)
          })

          // Converter jogos abertos para PlayerMatch
          const openGameMatches: PlayerMatch[] = openGames.map((game: any) => {
            const playersCount = countMap.get(game.id) || 0
            const club = clubsMap.get(game.club_id)
            return {
              id: `open_${game.id}`,
              tournament_id: '',
              tournament_name: 'Jogo Aberto',
              court: game.court_name || '',
              start_time: game.scheduled_at,
              team1_name: `${playersCount}/${game.max_players} jogadores`,
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

            // Combinar jogos de torneios com jogos abertos e ordenar por data
            result.upcomingMatches = [...upcomingMatches, ...openGameMatches].sort((a, b) => 
              new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
            )
          } else {
            result.upcomingMatches = upcomingMatches
          }
        }
      } else {
        result.upcomingMatches = upcomingMatches
      }
    } else {
      result.upcomingMatches = upcomingMatches
    }
    result.recentMatches = recentMatches
    const totalMatches = wins + losses
    result.stats.totalMatches = totalMatches
    result.stats.wins = wins
    result.stats.losses = losses
    result.stats.winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0
  } else {
    // Se não há matches de torneios, ainda podemos ter jogos abertos
    if (playerAccount.id) {
      const { data: playerGames } = await supabase
        .from('open_game_players')
        .select('game_id')
        .eq('player_account_id', playerAccount.id)

      if (playerGames && playerGames.length > 0) {
        const gameIds = playerGames.map((pg: any) => pg.game_id).filter(Boolean)
        
        if (gameIds.length === 0) {
          // Não há gameIds válidos, não fazer nada
        } else {
          const { data: openGames, error: openGamesError } = await supabase
            .from('open_games')
            .select('id, scheduled_at, status, club_id, court_name, duration_minutes, max_players')
            .in('id', gameIds)
            .gte('scheduled_at', new Date().toISOString())
            .in('status', ['open', 'full'])

          if (openGamesError) {
            console.error('[PlayerDashboard] Error fetching open games (else block):', openGamesError)
          } else if (openGames && openGames.length > 0) {

            // Buscar dados dos clubes separadamente
            let clubsMap = new Map<string, { name: string; city: string | null }>()
            const clubIds = [...new Set(openGames.map((g: any) => g.club_id).filter(Boolean))]
            if (clubIds.length > 0) {
              const { data: clubsData } = await supabase
                .from('clubs')
                .select('id, name, city')
                .in('id', clubIds)
              
              clubsData?.forEach((club: any) => {
                clubsMap.set(club.id, { name: club.name, city: club.city })
              })
            }

            // Contar jogadores em cada jogo
          const gameIdsForCount = openGames.map((g: any) => g.id)
          const { data: playersCount } = await supabase
            .from('open_game_players')
            .select('game_id')
            .in('game_id', gameIdsForCount)

          const countMap = new Map<string, number>()
          playersCount?.forEach((p: any) => {
            countMap.set(p.game_id, (countMap.get(p.game_id) || 0) + 1)
          })

            const openGameMatches: PlayerMatch[] = openGames.map((game: any) => {
              const playersCount = countMap.get(game.id) || 0
              const club = clubsMap.get(game.club_id)
              return {
                id: `open_${game.id}`,
                tournament_id: '',
                tournament_name: 'Jogo Aberto',
                court: game.court_name || '',
                start_time: game.scheduled_at,
                team1_name: `${playersCount}/${game.max_players} jogadores`,
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

            result.upcomingMatches = openGameMatches.sort((a, b) => 
              new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
            )
          }
        }
      }
    }
  }

  await fetchLeagueStandingsOnly(playerAccount.id, name || '', result, playerIds, teamIds)

  // Enriquecer com Edge Function (usa service role, ignora RLS) – ligas e histórico
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('get-player-dashboard', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (edgeError) console.warn('[Dashboard] Edge Function error:', edgeError)
      if (edgeData && !edgeData.error) {
        if (edgeData.leagueStandings?.length) result.leagueStandings = edgeData.leagueStandings
        if (edgeData.pastTournaments?.length) result.pastTournaments = edgeData.pastTournaments
        if (edgeData.pastTournamentDetails && Object.keys(edgeData.pastTournamentDetails).length > 0) {
          result.pastTournamentDetails = edgeData.pastTournamentDetails
        }
      }
    }
  } catch (err) {
    console.error('[Dashboard] Edge Function error:', err)
    // Fallback: manter dados das queries diretas
  }

  return result
}

async function fetchLeagueStandingsOnly(
  playerAccountId: string,
  playerName: string,
  result: PlayerDashboardData,
  playerIds: string[] = [],
  teamIds: string[] = []
): Promise<void> {
  const conditions: string[] = [`player_account_id.eq.${playerAccountId}`]
  if (playerName) {
    conditions.push(`entity_name.ilike.%${(playerName || '').trim()}%`)
  }
  if (playerIds.length > 0) {
    conditions.push(`entity_id.in.(${playerIds.join(',')})`)
  }
  if (teamIds.length > 0) {
    conditions.push(`entity_id.in.(${teamIds.join(',')})`)
  }
  const { data: standings, error: standingsError } = await supabase
    .from('league_standings')
    .select(
      `
      id, league_id, total_points, tournaments_played, entity_name,
      leagues!inner(id, name)
    `
    )
    .or(conditions.join(','))
    .order('total_points', { ascending: false })
  if (standingsError) console.warn('[LeagueStandings] Error:', standingsError)
  if (!standings || standings.length === 0) return

  const leagueData = await Promise.all(
    (standings as any[]).map(async (s) => {
      const leagueId = s.leagues?.id
      const { data: allStandings } = await supabase
        .from('league_standings')
        .select('id, total_points')
        .eq('league_id', leagueId)
        .order('total_points', { ascending: false })
      const position = allStandings ? allStandings.findIndex((st: any) => st.id === s.id) + 1 : 0
      return {
        league_id: leagueId,
        league_name: s.leagues?.name || '',
        position,
        total_participants: allStandings?.length || 0,
        points: s.total_points,
        tournaments_played: s.tournaments_played,
      }
    })
  )
  result.leagueStandings = leagueData
}

export async function fetchLeagueFullStandings(
  leagueId: string,
  playerName: string
): Promise<LeagueFullStanding[]> {
  const { data: allStandings } = await supabase
    .from('league_standings')
    .select('entity_name, total_points, tournaments_played, best_position')
    .eq('league_id', leagueId)
    .order('total_points', { ascending: false })

  if (!allStandings) return []
  return allStandings.map((s: any, index: number) => ({
    position: index + 1,
    entity_name: s.entity_name,
    total_points: s.total_points,
    tournaments_played: s.tournaments_played,
    best_position: s.best_position ?? 0,
    is_current_player: playerName ? s.entity_name?.toLowerCase().trim() === playerName.toLowerCase().trim() : false,
  }))
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
}

export async function fetchTournamentStandingsAndMatches(
  tournamentId: string,
  userId: string
): Promise<{ standings: TournamentStandingRow[]; myMatches: TournamentMyMatch[]; tournamentName: string; playerPosition?: number }> {
  let tournamentName = ''

  const [{ data: tournament }, { data: matches }, { data: teams }, { data: players }] = await Promise.all([
    supabase.from('tournaments').select('name').eq('id', tournamentId).maybeSingle(),
    supabase
      .from('matches')
      .select(
        'id, team1_id, team2_id, player1_individual_id, player2_individual_id, player3_individual_id, player4_individual_id, team1_score_set1, team2_score_set1, team1_score_set2, team2_score_set2, team1_score_set3, team2_score_set3, status, round'
      )
      .eq('tournament_id', tournamentId)
      .eq('status', 'completed'),
    supabase.from('teams').select('id, name, group_name, final_position, player1_id, player2_id, player1:players!teams_player1_id_fkey(id, name), player2:players!teams_player2_id_fkey(id, name)').eq('tournament_id', tournamentId),
    supabase.from('players').select('id, name, group_name').eq('tournament_id', tournamentId),
  ])

  // Create a map of player names by id (from players table and from teams relations)
  const playerNamesMap = new Map<string, string>()
  if (players) {
    players.forEach((p: any) => {
      playerNamesMap.set(p.id, p.name)
    })
  }
  // Also add player names from teams relations
  if (teams) {
    teams.forEach((t: any) => {
      if (t.player1?.id && t.player1?.name) {
        playerNamesMap.set(t.player1.id, t.player1.name)
      }
      if (t.player2?.id && t.player2?.name) {
        playerNamesMap.set(t.player2.id, t.player2.name)
      }
    })
  }

  console.log('[fetchTournamentStandingsAndMatches] Teams:', teams?.length, 'Players:', players?.length, 'Matches:', matches?.length)

  if (tournament) tournamentName = tournament.name || ''

  const isIndividual = (players?.length || 0) > 0 && (teams?.length || 0) === 0
  const standingsMap = new Map<string, any>()

  if (isIndividual && players) {
    players.forEach((p: any) => {
      standingsMap.set(p.id, {
        id: p.id,
        name: p.name,
        group_name: p.group_name || 'Geral',
        wins: 0,
        draws: 0,
        losses: 0,
        points_for: 0,
        points_against: 0,
        points: 0,
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
    console.log('[fetchTournamentStandingsAndMatches] Processing teams, playerNamesMap size:', playerNamesMap.size)
    teams.forEach((t: any) => {
      // Prefer names from team relations, fallback to map
      const player1Name = t.player1?.name || (t.player1_id ? playerNamesMap.get(t.player1_id) : undefined)
      const player2Name = t.player2?.name || (t.player2_id ? playerNamesMap.get(t.player2_id) : undefined)
      console.log('[fetchTournamentStandingsAndMatches] Team:', t.name, 'Player1ID:', t.player1_id, 'Player1Name:', player1Name, 'Player2ID:', t.player2_id, 'Player2Name:', player2Name)
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
        player1_name: player1Name,
        player2_name: player2Name,
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
      const indCond = playerIds
        .map(
          (id) =>
            `player1_individual_id.eq.${id},player2_individual_id.eq.${id},player3_individual_id.eq.${id},player4_individual_id.eq.${id}`
        )
        .join(',')
      const allCond = [teamMatchCond, indCond].filter((c) => c.length > 0).join(',')
      if (allCond) {
        const { data: playerMatches } = await supabase
          .from('matches')
          .select(
            `
            id, court, scheduled_time, team1_score_set1, team2_score_set1, team1_score_set2, team2_score_set2, team1_score_set3, team2_score_set3, status, round, team1_id, team2_id,
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
            const t1Sets = [
              (m.team1_score_set1 || 0) > (m.team2_score_set1 || 0) ? 1 : 0,
              (m.team1_score_set2 || 0) > (m.team2_score_set2 || 0) ? 1 : 0,
              (m.team1_score_set3 || 0) > (m.team2_score_set3 || 0) ? 1 : 0,
            ].reduce((a, b) => a + b, 0)
            const t2Sets = [
              (m.team2_score_set1 || 0) > (m.team1_score_set1 || 0) ? 1 : 0,
              (m.team2_score_set2 || 0) > (m.team1_score_set2 || 0) ? 1 : 0,
              (m.team2_score_set3 || 0) > (m.team1_score_set3 || 0) ? 1 : 0,
            ].reduce((a, b) => a + b, 0)
            let is_winner: boolean | undefined
            if (m.status === 'completed' && (t1Sets > 0 || t2Sets > 0)) {
              const inTeam1 = isInd
                ? playerIds.includes(m.p1?.id) || playerIds.includes(m.p2?.id)
                : teamIds.includes(m.team1?.id)
              is_winner = inTeam1 ? t1Sets > t2Sets : t2Sets > t1Sets
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
            }
          })
        }
      }
    }
  }

  let playerPosition: number | undefined
  const posIdx = standingsArray.findIndex((row) => entityIds.has(row.id))
  if (posIdx >= 0) playerPosition = posIdx + 1

  return { standings: standingsArray, myMatches, tournamentName, playerPosition }
}
