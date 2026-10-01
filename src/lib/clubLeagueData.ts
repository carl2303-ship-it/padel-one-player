import { supabase } from './supabase'

export type ClubLeaguePlayerRow = {
  id: string
  team_id: string
  name: string
  phone_number: string | null
  fpp_points: number
  is_captain: boolean
  player_order: number
  player_account_id: string | null
}

export type ClubLeagueTeamRow = {
  id: string
  tournament_id: string
  category_id: string | null
  name: string
  registration_order: number
  captain_player_id: string | null
  club_league_players: ClubLeaguePlayerRow[]
}

export type ClubLeagueMatchdayRow = {
  id: string
  tournament_id: string
  category_id: string | null
  matchday_number: number
  matchday_date: string | null
  label: string | null
  leg: 'home' | 'away' | string
}

export type ClubLeagueConfrontationRow = {
  id: string
  tournament_id: string
  category_id: string | null
  matchday_id: string | null
  home_team_id: string | null
  away_team_id: string | null
  scheduled_time: string | null
  venue: string | null
  status: string
  home_duos_won: number
  away_duos_won: number
  home_sets_won: number
  away_sets_won: number
  winner_team_id: string | null
}

export type ClubLeagueStandingRow = {
  id: string
  tournament_id: string
  category_id: string | null
  team_id: string
  played: number
  won: number
  lost: number
  points: number
  sets_won: number
  sets_lost: number
  sets_diff: number
  position: number | null
}

export type ClubLeagueGameRow = {
  id: string
  confrontation_id: string
  game_type: 'duo1' | 'duo2' | 'duo3' | string
  game_order: number
  home_set1: number | null
  away_set1: number | null
  home_set2: number | null
  away_set2: number | null
  home_stb: number | null
  away_stb: number | null
  winner_team_id: string | null
  status: string
}

export type ClubLeagueLineupRow = {
  id: string
  confrontation_id: string
  team_id: string
  duo1_player1_id: string | null
  duo1_player2_id: string | null
  duo2_player1_id: string | null
  duo2_player2_id: string | null
  duo3_player1_id: string | null
  duo3_player2_id: string | null
}

export type ClubLeagueBundle = {
  teams: ClubLeagueTeamRow[]
  matchdays: ClubLeagueMatchdayRow[]
  confrontations: ClubLeagueConfrontationRow[]
  standings: ClubLeagueStandingRow[]
  games: ClubLeagueGameRow[]
  lineups: ClubLeagueLineupRow[]
}

export async function countClubLeagueTeams(tournamentId: string): Promise<number> {
  const { count } = await supabase
    .from('club_league_teams')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
  return count || 0
}

export async function countClubLeagueTeamsByTournamentIds(
  tournamentIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (tournamentIds.length === 0) return map
  const { data } = await supabase
    .from('club_league_teams')
    .select('tournament_id')
    .in('tournament_id', tournamentIds)
  for (const row of data || []) {
    const id = (row as { tournament_id: string }).tournament_id
    map.set(id, (map.get(id) || 0) + 1)
  }
  return map
}

export async function fetchClubLeagueBundle(
  tournamentId: string,
  categoryId?: string | null
): Promise<ClubLeagueBundle> {
  let teamsQ = supabase
    .from('club_league_teams')
    .select('*, club_league_players!club_league_players_team_id_fkey(*)')
    .eq('tournament_id', tournamentId)
    .order('registration_order')
  if (categoryId) teamsQ = teamsQ.eq('category_id', categoryId)

  let mdQ = supabase
    .from('club_league_matchdays')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('matchday_number')
  if (categoryId) mdQ = mdQ.eq('category_id', categoryId)

  let confQ = supabase
    .from('club_league_confrontations')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('scheduled_time', { ascending: true, nullsFirst: false })
  if (categoryId) confQ = confQ.eq('category_id', categoryId)

  let stQ = supabase
    .from('club_league_standings')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('position', { ascending: true, nullsFirst: false })
  if (categoryId) stQ = stQ.eq('category_id', categoryId)

  const [teamsRes, mdRes, confRes, stRes] = await Promise.all([teamsQ, mdQ, confQ, stQ])
  if (teamsRes.error) throw teamsRes.error
  if (mdRes.error) throw mdRes.error
  if (confRes.error) throw confRes.error
  if (stRes.error) throw stRes.error

  const teams = (teamsRes.data || []) as ClubLeagueTeamRow[]
  for (const team of teams) {
    team.club_league_players = [...(team.club_league_players || [])].sort(
      (a, b) => a.player_order - b.player_order
    )
  }

  const confrontations = (confRes.data || []) as ClubLeagueConfrontationRow[]
  const confrontationIds = confrontations.map((c) => c.id)

  let games: ClubLeagueGameRow[] = []
  let lineups: ClubLeagueLineupRow[] = []
  if (confrontationIds.length > 0) {
    const [gamesRes, lineupRes] = await Promise.all([
      supabase
        .from('club_league_games')
        .select('*')
        .in('confrontation_id', confrontationIds)
        .order('game_order'),
      supabase
        .from('club_league_lineups')
        .select('*')
        .in('confrontation_id', confrontationIds),
    ])
    games = (gamesRes.data || []) as ClubLeagueGameRow[]
    lineups = (lineupRes.data || []) as ClubLeagueLineupRow[]
  }

  return {
    teams,
    matchdays: (mdRes.data || []) as ClubLeagueMatchdayRow[],
    confrontations,
    standings: (stRes.data || []) as ClubLeagueStandingRow[],
    games,
    lineups,
  }
}

export function formatDuoScore(game: ClubLeagueGameRow): string {
  const parts: string[] = []
  if (game.home_set1 != null && game.away_set1 != null) {
    parts.push(`${game.home_set1}-${game.away_set1}`)
  }
  if (game.home_set2 != null && game.away_set2 != null) {
    parts.push(`${game.home_set2}-${game.away_set2}`)
  }
  if (game.home_stb != null && game.away_stb != null) {
    parts.push(`STB ${game.home_stb}-${game.away_stb}`)
  }
  return parts.join(' · ') || '—'
}

export function playerNameById(teams: ClubLeagueTeamRow[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const team of teams) {
    for (const p of team.club_league_players || []) {
      map.set(p.id, p.name)
    }
  }
  return map
}

export function duoLabel(
  lineup: ClubLeagueLineupRow | undefined,
  names: Map<string, string>,
  which: 1 | 2 | 3
): string {
  if (!lineup) return `Dupla ${which}`
  const p1 =
    which === 1 ? lineup.duo1_player1_id : which === 2 ? lineup.duo2_player1_id : lineup.duo3_player1_id
  const p2 =
    which === 1 ? lineup.duo1_player2_id : which === 2 ? lineup.duo2_player2_id : lineup.duo3_player2_id
  const n1 = p1 ? names.get(p1) : null
  const n2 = p2 ? names.get(p2) : null
  if (n1 && n2) return `${n1} / ${n2}`
  if (n1 || n2) return n1 || n2 || `Dupla ${which}`
  return `Dupla ${which}`
}
