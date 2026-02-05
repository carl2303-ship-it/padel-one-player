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

export interface PlayerDashboardData {
  playerName: string
  playerAccountId: string | null
  upcomingTournaments: TournamentSummary[]
  pastTournaments: TournamentSummary[]
  upcomingMatches: PlayerMatch[]
  recentMatches: PlayerMatch[]
  leagueStandings: LeagueStanding[]
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
    if (isCompleted) past.push(row)
    else if (isOngoing) upcoming.push(row)
    else {
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
    await fetchLeagueStandingsOnly(playerAccount.id, name || '', result)
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
    const recentMatches = matches.filter((m) => m.status === 'completed').reverse().slice(0, 10)
    result.upcomingMatches = upcomingMatches
    result.recentMatches = recentMatches
    const totalMatches = wins + losses
    result.stats.totalMatches = totalMatches
    result.stats.wins = wins
    result.stats.losses = losses
    result.stats.winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0
  }

  await fetchLeagueStandingsOnly(playerAccount.id, name || '', result)
  return result
}

async function fetchLeagueStandingsOnly(
  playerAccountId: string,
  playerName: string,
  result: PlayerDashboardData
): Promise<void> {
  let query = supabase
    .from('league_standings')
    .select(
      `
      id, league_id, total_points, tournaments_played, entity_name,
      leagues!inner(id, name)
    `
    )
  if (playerName) {
    query = query.or(`player_account_id.eq.${playerAccountId},entity_name.ilike.${playerName}`)
  } else {
    query = query.eq('player_account_id', playerAccountId)
  }
  const { data: standings } = await query.order('total_points', { ascending: false })

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
  losses: number
  points_for: number
  points_against: number
  points: number
}

export interface TournamentMyMatch {
  id: string
  court: string
  scheduled_time: string
  team1_name: string
  team2_name: string
  team1_score: number
  team2_score: number
  status: string
  round: string
  is_winner?: boolean
}

export async function fetchTournamentStandingsAndMatches(
  tournamentId: string,
  userId: string
): Promise<{ standings: TournamentStandingRow[]; myMatches: TournamentMyMatch[]; tournamentName: string }> {
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
    supabase.from('teams').select('id, name, group_name, final_position').eq('tournament_id', tournamentId),
    supabase.from('players').select('id, name, group_name').eq('tournament_id', tournamentId),
  ])

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
          } else {
            s.losses++
            s.points += 1
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
          } else {
            s.losses++
            s.points += 1
          }
        }
      })
    })
  } else if (teams) {
    teams.forEach((t: any) => {
      standingsMap.set(t.id, {
        id: t.id,
        name: t.name,
        group_name: t.group_name || 'Geral',
        final_position: t.final_position,
        wins: 0,
        losses: 0,
        points_for: 0,
        points_against: 0,
        points: 0,
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
        } else if (t2s > t1s) {
          s1.losses++
          s1.points += 1
        }
      }
      if (s2) {
        s2.points_for += t2s
        s2.points_against += t1s
        if (t2s > t1s) {
          s2.wins++
          s2.points += 2
        } else if (t1s > t2s) {
          s2.losses++
          s2.points += 1
        }
      }
    })
  }

  const standingsArray = Array.from(standingsMap.values()).sort((a, b) => {
    if (a.final_position && b.final_position) return a.final_position - b.final_position
    if (a.final_position) return -1
    if (b.final_position) return 1
    if (b.points !== a.points) return b.points - a.points
    return b.points_for - b.points_against - (a.points_for - a.points_against)
  })

  let myMatches: TournamentMyMatch[] = []
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
    if (playerIds.length > 0) {
      const cond = playerIds.map((id) => `player1_id.eq.${id},player2_id.eq.${id}`).join(',')
      const { data: myTeams } = await supabase.from('teams').select('id').or(cond)
      const teamIds = (myTeams || []).map((t: any) => t.id)
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
            return {
              id: m.id,
              court: m.court || '',
              scheduled_time: m.scheduled_time || '',
              team1_name: team1Name,
              team2_name: team2Name,
              team1_score: t1Sets,
              team2_score: t2Sets,
              status: m.status,
              round: m.round || '',
              is_winner,
            }
          })
        }
      }
    }
  }

  return { standings: standingsArray, myMatches, tournamentName }
}
