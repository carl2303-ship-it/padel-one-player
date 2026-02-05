/**
 * Clube favorito (APC) e próximos torneios – dados da mesma base (Manager/Tour).
 */
import { supabase } from './supabase'

export interface ClubDetail {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  address: string | null
  city: string | null
  country: string | null
  phone: string | null
  email: string | null
  website: string | null
}

/** Lista todos os clubes geridos pela Padel One (para o jogador escolher no perfil). */
export async function fetchAllClubs(): Promise<ClubDetail[]> {
  const { data } = await supabase
    .from('clubs')
    .select('id, name, description, logo_url, address, city, country, phone, email, website')
    .order('name', { ascending: true })
  return (data || []) as ClubDetail[]
}

/** Busca um clube por id (clube favorito do jogador). */
export async function fetchClubById(clubId: string): Promise<ClubDetail | null> {
  const { data } = await supabase
    .from('clubs')
    .select('id, name, description, logo_url, address, city, country, phone, email, website')
    .eq('id', clubId)
    .maybeSingle()
  return data as ClubDetail | null
}

export interface UpcomingTournamentFromTour {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string
  image_url?: string | null
  club_id?: string | null
  description?: string | null
  allow_public_registration?: boolean
}

/** URL base da app Padel One Tour (para link de inscrição). Configurar VITE_TOUR_APP_URL no .env */
const TOUR_APP_URL = import.meta.env.VITE_TOUR_APP_URL || 'https://padel-one-tour.netlify.app'

/** Gera o link de inscrição para um torneio na Padel One Tour */
export function getTournamentRegistrationUrl(tournamentId: string): string {
  return `${TOUR_APP_URL}/?register=${tournamentId}`
}

/** Gera o link para ver inscritos ordenados por categorias na Padel One Tour */
export function getTournamentEnrolledUrl(tournamentId: string): string {
  return `${TOUR_APP_URL}/?register=${tournamentId}&enrolled=1`
}

export interface EnrolledByCategory {
  category_id: string
  category_name: string
  items: { id: string; name: string; player1_name?: string; player2_name?: string; player_names?: string[] }[]
}

/** Inscritos por categoria – jogadores individuais ou equipas, ordenados por categoria. */
export async function fetchEnrolledByCategory(tournamentId: string): Promise<EnrolledByCategory[]> {
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('format, round_robin_type')
    .eq('id', tournamentId)
    .maybeSingle()

  const { data: categories } = await supabase
    .from('tournament_categories')
    .select('id, name')
    .eq('tournament_id', tournamentId)
    .order('name')

  if (!categories || categories.length === 0) return []

  const isIndividual =
    (tournament?.format === 'round_robin' && (tournament as any)?.round_robin_type === 'individual') ||
    tournament?.format === 'individual_groups_knockout'
  const isSuperTeams = tournament?.format === 'super_teams'

  const result: EnrolledByCategory[] = []

  for (const cat of categories) {
    const items: EnrolledByCategory['items'] = []

    if (isSuperTeams) {
      const { data: superTeams } = await supabase
        .from('super_teams')
        .select(`
          id,
          name,
          super_team_players:super_team_players(name)
        `)
        .eq('tournament_id', tournamentId)
        .eq('category_id', cat.id)
        .order('name')

      if (superTeams) {
        for (const st of superTeams as any[]) {
          const playerNames = (st.super_team_players || []).map((p: any) => p.name).filter(Boolean)
          items.push({ id: st.id, name: st.name, player_names: playerNames })
        }
      }
    } else if (isIndividual) {
      const { data: players } = await supabase
        .from('players')
        .select('id, name')
        .eq('tournament_id', tournamentId)
        .eq('category_id', cat.id)
        .order('name')

      if (players) {
        for (const p of players as any[]) {
          items.push({ id: p.id, name: p.name })
        }
      }
    } else {
      const { data: teams } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          player1:players!teams_player1_id_fkey(name),
          player2:players!teams_player2_id_fkey(name)
        `)
        .eq('tournament_id', tournamentId)
        .eq('category_id', cat.id)
        .order('name')

      if (teams) {
        for (const t of teams as any[]) {
          items.push({
            id: t.id,
            name: t.name,
            player1_name: t.player1?.name,
            player2_name: t.player2?.name,
          })
        }
      }
    }

    result.push({
      category_id: cat.id,
      category_name: cat.name,
      items,
    })
  }

  return result
}

/** Próximos torneios (Tour) – opcionalmente filtrados por club_id do APC. */
export async function fetchUpcomingTournaments(clubId?: string | null): Promise<UpcomingTournamentFromTour[]> {
  const today = new Date().toISOString().split('T')[0]
  let query = supabase
    .from('tournaments')
    .select('id, name, start_date, end_date, status, image_url, club_id, description, allow_public_registration')
    .gte('end_date', today)
    .in('status', ['draft', 'active'])
    .order('start_date', { ascending: true })
    .limit(20)

  if (clubId) {
    query = query.eq('club_id', clubId)
  }

  const { data } = await query
  return (data || []) as UpcomingTournamentFromTour[]
}
