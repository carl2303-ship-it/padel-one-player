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
  owner_id?: string | null
  is_managed?: boolean
}

/** Lista todos os clubes geridos pela Padel One (para o jogador escolher no perfil). */
export async function fetchAllClubs(): Promise<ClubDetail[]> {
  const { data } = await supabase
    .from('clubs')
    .select('id, name, description, logo_url, address, city, country, phone, email, website, owner_id, is_managed')
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
  visibility?: 'public' | 'invite_only'
  format?: string | null
  round_robin_type?: string | null
  is_full?: boolean
  is_invited?: boolean
}

/** URL base da app Padel One Tour (para link de inscrição). Configurar VITE_TOUR_APP_URL no .env */
const TOUR_APP_URL = import.meta.env.VITE_TOUR_APP_URL || 'https://padel-one-tour.netlify.app'

/** Gera o link de inscrição para um torneio na Padel One Tour */
export function getTournamentRegistrationUrl(tournamentId: string, phone?: string): string {
  let url = `${TOUR_APP_URL}/?register=${tournamentId}`
  if (phone) url += `&phone=${encodeURIComponent(phone)}`
  return url
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

  const isIndividual =
    (tournament?.format === 'round_robin' && (tournament as any)?.round_robin_type === 'individual') ||
    tournament?.format === 'individual_groups_knockout'
  const isSuperTeams = tournament?.format === 'super_teams'

  if (!categories || categories.length === 0) {
    const items: EnrolledByCategory['items'] = []
    if (isSuperTeams) {
      const { data: superTeams } = await supabase
        .from('super_teams')
        .select('id, name, super_team_players:super_team_players(name)')
        .eq('tournament_id', tournamentId)
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
        .order('name')
      if (players) {
        for (const p of players as any[]) items.push({ id: p.id, name: p.name })
      }
    } else {
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name, player1:players!teams_player1_id_fkey(name), player2:players!teams_player2_id_fkey(name)')
        .eq('tournament_id', tournamentId)
        .order('name')
      if (teams) {
        for (const tm of teams as any[]) {
          items.push({ id: tm.id, name: tm.name, player1_name: tm.player1?.name, player2_name: tm.player2?.name })
        }
      }
    }
    if (items.length === 0) {
      const { data: allPlayers } = await supabase
        .from('players')
        .select('id, name')
        .eq('tournament_id', tournamentId)
        .order('name')
      if (allPlayers) {
        for (const p of allPlayers as any[]) items.push({ id: p.id, name: p.name })
      }
    }
    if (items.length === 0) return []
    return [{ category_id: 'all', category_name: 'Jogadores', items }]
  }

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

// ============================================
// Detalhe de um torneio
// ============================================

export interface TournamentFullDetail {
  id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  status: string
  format: string
  image_url: string | null
  number_of_courts: number
  match_duration_minutes: number
  daily_start_time: string | null
  daily_end_time: string | null
  club_name: string | null
  club_logo: string | null
  categories: { id: string; name: string; max_teams?: number | null }[]
  enrolled: EnrolledByCategory[]
  total_enrolled: number
  is_full: boolean
}

/** Busca todos os detalhes de um torneio, incluindo clube, categorias e inscritos. */
export async function fetchTournamentFullDetail(tournamentId: string): Promise<TournamentFullDetail | null> {
  // 1) Dados do torneio
  const { data: t } = await supabase
    .from('tournaments')
    .select('id, name, description, start_date, end_date, status, format, image_url, number_of_courts, match_duration_minutes, daily_start_time, daily_end_time, club_id, round_robin_type')
    .eq('id', tournamentId)
    .maybeSingle()

  if (!t) return null

  // 2) Dados do clube (se existir)
  let club_name: string | null = null
  let club_logo: string | null = null
  if (t.club_id) {
    const { data: club } = await supabase
      .from('clubs')
      .select('name, logo_url')
      .eq('id', t.club_id)
      .maybeSingle()
    if (club) {
      club_name = club.name
      club_logo = club.logo_url
    }
  }

  // 3) Categorias
  const { data: categories } = await supabase
    .from('tournament_categories')
    .select('id, name, max_teams')
    .eq('tournament_id', tournamentId)
    .order('name')

  // 4) Inscritos por categoria (reutiliza a função existente)
  const enrolled = await fetchEnrolledByCategory(tournamentId)

  // Contar total de inscritos e verificar se está cheio
  let total_enrolled = 0
  for (const cat of enrolled) {
    total_enrolled += cat.items.length
  }
  const totalMax = (categories || []).reduce((sum, c) => c.max_teams ? sum + c.max_teams : sum, 0)
  const is_full = totalMax > 0 && total_enrolled >= totalMax

  return {
    id: t.id,
    name: t.name,
    description: t.description,
    start_date: t.start_date,
    end_date: t.end_date,
    status: t.status,
    format: t.format,
    image_url: t.image_url,
    number_of_courts: t.number_of_courts ?? 1,
    match_duration_minutes: t.match_duration_minutes ?? 90,
    daily_start_time: t.daily_start_time,
    daily_end_time: t.daily_end_time,
    club_name,
    club_logo,
    categories: (categories || []),
    enrolled,
    total_enrolled,
    is_full,
  }
}

/** Próximos torneios (Tour) – opcionalmente filtrados por club_id do APC. */
export async function fetchUpcomingTournaments(clubId?: string | null): Promise<UpcomingTournamentFromTour[]> {
  const today = new Date().toISOString().split('T')[0]
  let query = supabase
    .from('tournaments')
    .select('id, name, start_date, end_date, status, image_url, club_id, description, allow_public_registration, visibility, format, round_robin_type')
    .gte('end_date', today)
    .in('status', ['draft', 'active', 'in_progress'])
    .order('start_date', { ascending: true })
    .limit(20)

  if (clubId) {
    query = query.eq('club_id', clubId)
  }

  const { data } = await query
  return (data || []) as UpcomingTournamentFromTour[]
}

/** Busca contagem de inscritos para uma lista de torneios (teams + players). */
export async function fetchTournamentEnrolledCounts(tournamentIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (tournamentIds.length === 0) return result
  const [teamsRes, playersRes, superTeamsRes, invitesRes] = await Promise.all([
    supabase.from('teams').select('tournament_id').in('tournament_id', tournamentIds),
    supabase.from('players').select('tournament_id').in('tournament_id', tournamentIds),
    supabase.from('super_teams').select('tournament_id').in('tournament_id', tournamentIds),
    supabase.from('tournament_invites').select('tournament_id').in('tournament_id', tournamentIds).eq('status', 'accepted'),
  ])
  const teamsMap = new Map<string, number>()
  const playersMap = new Map<string, number>()
  const superTeamsMap = new Map<string, number>()
  const invitesMap = new Map<string, number>()
  ;(teamsRes.data || []).forEach((t: any) => teamsMap.set(t.tournament_id, (teamsMap.get(t.tournament_id) || 0) + 1))
  ;(playersRes.data || []).forEach((p: any) => playersMap.set(p.tournament_id, (playersMap.get(p.tournament_id) || 0) + 1))
  ;(superTeamsRes.data || []).forEach((s: any) => superTeamsMap.set(s.tournament_id, (superTeamsMap.get(s.tournament_id) || 0) + 1))
  ;(invitesRes.data || []).forEach((i: any) => invitesMap.set(i.tournament_id, (invitesMap.get(i.tournament_id) || 0) + 1))
  tournamentIds.forEach(id => {
    const fromTables = teamsMap.get(id) || playersMap.get(id) || superTeamsMap.get(id) || 0
    const fromInvites = invitesMap.get(id) || 0
    const count = Math.max(fromTables, fromInvites)
    if (count > 0) result.set(id, count)
  })
  return result
}

/** Busca torneios por IDs específicos (para enriquecer dados de torneios de outros clubes). */
export async function fetchTournamentsByIds(ids: string[]): Promise<UpcomingTournamentFromTour[]> {
  if (ids.length === 0) return []
  const { data } = await supabase
    .from('tournaments')
    .select('id, name, start_date, end_date, status, image_url, club_id, description, allow_public_registration, visibility, format, round_robin_type')
    .in('id', ids)
  return (data || []) as UpcomingTournamentFromTour[]
}

/** Busca convites de torneio para o jogador actual. */
export async function fetchMyTournamentInvites(playerAccountId: string): Promise<{
  tournament_id: string
  status: string
  tournament_name?: string
  tournament_start_date?: string
  tournament_image_url?: string | null
}[]> {
  const { data, error } = await supabase
    .from('tournament_invites')
    .select('tournament_id, status')
    .eq('player_account_id', playerAccountId)
    .in('status', ['pending', 'accepted'])

  if (error || !data || data.length === 0) return []

  const tournamentIds = data.map(d => d.tournament_id)
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, start_date, image_url')
    .in('id', tournamentIds)

  const tMap: Record<string, any> = {}
  ;(tournaments || []).forEach(t => { tMap[t.id] = t })

  return data.map(inv => ({
    tournament_id: inv.tournament_id,
    status: inv.status,
    tournament_name: tMap[inv.tournament_id]?.name,
    tournament_start_date: tMap[inv.tournament_id]?.start_date,
    tournament_image_url: tMap[inv.tournament_id]?.image_url,
  }))
}

/** Actualizar status de um convite de torneio. Se aceite, inscreve o jogador automaticamente. */
export async function updateTournamentInviteStatus(
  playerAccountId: string,
  tournamentId: string,
  status: 'accepted' | 'declined'
): Promise<boolean> {
  const { error } = await supabase
    .from('tournament_invites')
    .update({ status })
    .eq('player_account_id', playerAccountId)
    .eq('tournament_id', tournamentId)
  if (error) return false

  if (status === 'accepted') {
    try {
      const { data: existing } = await supabase
        .from('players')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('player_account_id', playerAccountId)
        .maybeSingle()
      if (existing) return true

      const [accountRes, categoryRes, existingPlayersRes] = await Promise.all([
        supabase.from('player_accounts').select('name, phone_number, player_category').eq('id', playerAccountId).maybeSingle(),
        supabase.from('tournament_categories').select('id').eq('tournament_id', tournamentId).order('name').limit(1),
        supabase.from('players').select('category_id').eq('tournament_id', tournamentId).limit(1),
      ])

      const account = accountRes.data
      if (!account) return true
      const categoryId = categoryRes.data?.[0]?.id || existingPlayersRes.data?.[0]?.category_id || null

      await supabase.from('players').insert({
        tournament_id: tournamentId,
        category_id: categoryId,
        name: account.name,
        phone_number: account.phone_number,
        player_account_id: playerAccountId,
      })
    } catch (e) {
      console.error('[updateTournamentInviteStatus] Auto-enroll failed:', e)
    }
  }

  return true
}
