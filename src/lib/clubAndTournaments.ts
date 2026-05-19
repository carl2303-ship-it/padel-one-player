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
  plan_type?: string | null
  photo_url_1?: string | null
  photo_url_2?: string | null
  latitude?: number | null
  longitude?: number | null
  cover_image_url?: string | null
  photos?: string[] | null
  num_courts?: number | null
  amenities?: string[] | null
}

/** Lista todos os clubes geridos pela Padel One (para o jogador escolher no perfil). */
export async function fetchAllClubs(): Promise<ClubDetail[]> {
  const { data } = await supabase
    .from('clubs')
    .select('id, name, description, logo_url, photo_url_1, photo_url_2, address, city, country, phone, email, website, owner_id, is_managed, plan_type, latitude, longitude, cover_image_url, photos, num_courts, amenities')
    .order('name', { ascending: true })
  return (data || []) as ClubDetail[]
}

/** Busca um clube por id (clube favorito do jogador). */
export async function fetchClubById(clubId: string): Promise<ClubDetail | null> {
  const { data } = await supabase
    .from('clubs')
    .select('id, name, description, logo_url, photo_url_1, photo_url_2, address, city, country, phone, email, website, plan_type, latitude, longitude, cover_image_url, photos, num_courts, amenities')
    .eq('id', clubId)
    .maybeSingle()
  return data as ClubDetail | null
}

/** Busca os IDs dos clubes onde o jogador joga. */
export async function fetchPlayerClubs(playerAccountId: string): Promise<string[]> {
  const { data } = await supabase
    .from('player_clubs')
    .select('club_id')
    .eq('player_account_id', playerAccountId)
  return (data || []).map(r => r.club_id)
}

/** Adiciona ou remove um clube da lista de clubes do jogador. Retorna a lista actualizada. */
export async function togglePlayerClub(playerAccountId: string, clubId: string, add: boolean): Promise<string[]> {
  if (add) {
    await supabase
      .from('player_clubs')
      .upsert({ player_account_id: playerAccountId, club_id: clubId }, { onConflict: 'player_account_id,club_id' })
  } else {
    await supabase
      .from('player_clubs')
      .delete()
      .eq('player_account_id', playerAccountId)
      .eq('club_id', clubId)
  }
  return fetchPlayerClubs(playerAccountId)
}

export interface UpcomingTournamentFromTour {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string
  image_url?: string | null
  club_id?: string | null
  /** Nomes dos clubes anfitriões (ex.: escada com vários), preenchido nas listagens. */
  host_clubs_label?: string | null
  description?: string | null
  allow_public_registration?: boolean
  visibility?: 'public' | 'invite_only'
  format?: string | null
  round_robin_type?: string | null
  gender?: string | null
  is_full?: boolean
  is_invited?: boolean
}

/** Normaliza `club_ids` (array JSON, string estilo Postgres `{uuid,uuid}` ou ausente) + `club_id` legacy. */
export function parseClubIds(clubIds: unknown, clubId?: string | null): string[] {
  const out: string[] = []
  const push = (id: string | null | undefined) => {
    if (id && typeof id === 'string' && !out.includes(id)) out.push(id)
  }
  if (clubIds == null) {
    push(clubId ?? undefined)
    return out
  }
  if (Array.isArray(clubIds)) {
    for (const x of clubIds) {
      if (typeof x === 'string') push(x)
    }
    if (out.length === 0) push(clubId ?? undefined)
    return out
  }
  if (typeof clubIds === 'string') {
    const s = clubIds.trim()
    if (s.startsWith('{') && s.endsWith('}')) {
      const inner = s.slice(1, -1).trim()
      if (inner.length > 0) {
        for (const part of inner.split(',')) {
          const id = part.trim().replace(/^"|"$/g, '')
          push(id || null)
        }
      }
    } else if (/^[0-9a-f-]{36}$/i.test(s)) {
      push(s)
    }
    if (out.length === 0) push(clubId ?? undefined)
    return out
  }
  push(clubId ?? undefined)
  return out
}

async function enrichTournamentsWithHostClubLabels(
  rows: Record<string, unknown>[]
): Promise<UpcomingTournamentFromTour[]> {
  const allVenueIds = new Set<string>()
  for (const r of rows) {
    for (const id of parseClubIds(r.club_ids, r.club_id as string | null | undefined)) {
      allVenueIds.add(id)
    }
  }
  const clubNameById = new Map<string, string>()
  if (allVenueIds.size > 0) {
    const { data: clubsRows } = await supabase
      .from('clubs')
      .select('id, name')
      .in('id', [...allVenueIds])
    for (const c of clubsRows || []) {
      const row = c as { id: string; name: string }
      clubNameById.set(row.id, row.name)
    }
  }
  return rows.map((r) => {
    const ids = parseClubIds(r.club_ids, r.club_id as string | null | undefined)
    const labels = ids.map((id) => clubNameById.get(id)).filter(Boolean) as string[]
    return {
      ...r,
      host_clubs_label: labels.length > 0 ? labels.join(' · ') : null,
    } as UpcomingTournamentFromTour
  })
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
  round_robin_type?: string | null
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
export async function fetchTournamentFullDetail(tournamentId: string, playerAccountId?: string | null): Promise<TournamentFullDetail | null> {
  // 1) Dados do torneio (tenta SELECT directo; se RLS bloquear, usa RPC para torneios invite_only)
  let t: any = null
  const { data: directData } = await supabase
    .from('tournaments')
    .select('id, name, description, start_date, end_date, status, format, image_url, number_of_courts, match_duration_minutes, daily_start_time, daily_end_time, club_id, club_ids, round_robin_type')
    .eq('id', tournamentId)
    .maybeSingle()

  t = directData

  if (!t && playerAccountId) {
    try {
      const { data: rpcData } = await supabase.rpc('get_tournament_for_invited_player', {
        p_player_account_id: playerAccountId,
        p_tournament_id: tournamentId,
      })
      if (rpcData && typeof rpcData === 'object' && !(rpcData as any).error) {
        t = rpcData
      }
    } catch (e) {
      console.warn('[fetchTournamentFullDetail] RPC fallback failed:', e)
    }
  }

  if (!t) return null

  // 2) Clube(s) — torneio escada pode ter vários em club_ids
  console.log('[fetchTournamentFullDetail] RAW club fields:', { club_id: t.club_id, club_ids: t.club_ids, type_club_ids: typeof t.club_ids, isArray: Array.isArray(t.club_ids) })
  let club_name: string | null = null
  let club_logo: string | null = null
  const venueIds = parseClubIds(t.club_ids, t.club_id)
  if (venueIds.length > 0) {
    const { data: clubsRows } = await supabase
      .from('clubs')
      .select('id, name, logo_url')
      .in('id', venueIds)
    const byId = new Map((clubsRows || []).map((c: { id: string; name: string; logo_url?: string | null }) => [c.id, c]))
    const names = venueIds.map((id) => byId.get(id)?.name).filter(Boolean) as string[]
    if (names.length > 0) {
      club_name = names.join(' · ')
      club_logo = byId.get(venueIds[0])?.logo_url ?? null
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

  console.log('[fetchTournamentFullDetail] RAW tournament data:', { format: t.format, round_robin_type: t.round_robin_type, name: t.name })
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    start_date: t.start_date,
    end_date: t.end_date,
    status: t.status,
    format: t.format,
    round_robin_type: t.round_robin_type || null,
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

/** Próximos torneios (Tour) – opcionalmente filtrados por club_ids do jogador. */
export async function fetchUpcomingTournaments(clubIds?: string[] | string | null): Promise<UpcomingTournamentFromTour[]> {
  const today = new Date().toISOString().split('T')[0]
  let query = supabase
    .from('tournaments')
    .select('id, name, start_date, end_date, status, image_url, club_id, club_ids, description, allow_public_registration, visibility, format, round_robin_type, gender')
    .gte('end_date', today)
    .in('status', ['draft', 'active', 'in_progress'])
    .order('start_date', { ascending: true })
    .limit(30)

  const ids = Array.isArray(clubIds) ? clubIds : clubIds ? [clubIds] : []
  if (ids.length > 0) {
    const orParts = ids.flatMap((id) => [`club_id.eq.${id}`, `club_ids.cs.{${id}}`])
    query = query.or(orParts.join(','))
  }

  const { data } = await query
  return enrichTournamentsWithHostClubLabels((data || []) as Record<string, unknown>[])
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
    .select('id, name, start_date, end_date, status, image_url, club_id, club_ids, description, allow_public_registration, visibility, format, round_robin_type, gender')
    .in('id', ids)
  return enrichTournamentsWithHostClubLabels((data || []) as Record<string, unknown>[])
}

/** Busca convites de torneio para o jogador actual.
 *  Tenta a RPC get_my_tournament_invites (SECURITY DEFINER) que garante
 *  acesso a torneios invite_only; faz fallback para queries directas.
 */
export async function fetchMyTournamentInvites(playerAccountId: string): Promise<{
  tournament_id: string
  status: string
  tournament_name?: string
  tournament_start_date?: string
  tournament_image_url?: string | null
}[]> {
  let invites: { tournament_id: string; status: string }[] = []

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_tournament_invites', {
      p_player_account_id: playerAccountId,
    })
    if (!rpcError && rpcData) {
      const arr = Array.isArray(rpcData) ? rpcData : (typeof rpcData === 'string' ? JSON.parse(rpcData) : null)
      if (Array.isArray(arr)) invites = arr
    }
    if (rpcError) console.warn('[fetchMyTournamentInvites] RPC falhou, fallback:', rpcError.message)
  } catch (e) {
    console.warn('[fetchMyTournamentInvites] RPC exception, fallback:', e)
  }

  if (invites.length === 0) {
    const { data, error } = await supabase
      .from('tournament_invites')
      .select('tournament_id, status')
      .eq('player_account_id', playerAccountId)
      .in('status', ['pending', 'accepted'])

    if (error || !data || data.length === 0) return []
    invites = data
  }

  const tournamentIds = invites.map(d => d.tournament_id)

  const [tournamentsRes, enrolledRes] = await Promise.all([
    supabase.from('tournaments').select('id, name, start_date, image_url').in('id', tournamentIds),
    supabase.from('players').select('tournament_id').eq('player_account_id', playerAccountId).in('tournament_id', tournamentIds),
  ])

  const enrolledTournamentIds = new Set((enrolledRes.data || []).map((p: any) => p.tournament_id))

  // Auto-cleanup: mark invites as 'accepted' for tournaments where player is already enrolled
  const toCleanup = invites.filter(inv => inv.status === 'pending' && enrolledTournamentIds.has(inv.tournament_id))
  if (toCleanup.length > 0) {
    for (const inv of toCleanup) {
      supabase.from('tournament_invites')
        .update({ status: 'accepted' })
        .eq('player_account_id', playerAccountId)
        .eq('tournament_id', inv.tournament_id)
        .then(() => {})
    }
  }

  const filtered = invites.filter(inv => !enrolledTournamentIds.has(inv.tournament_id))
  if (filtered.length === 0) return []

  const tMap: Record<string, any> = {}
  ;(tournamentsRes.data || []).forEach(t => { tMap[t.id] = t })

  return filtered.map(inv => ({
    tournament_id: inv.tournament_id,
    status: inv.status,
    tournament_name: tMap[inv.tournament_id]?.name,
    tournament_start_date: tMap[inv.tournament_id]?.start_date,
    tournament_image_url: tMap[inv.tournament_id]?.image_url,
  }))
}

/** Actualizar status de um convite de torneio. Se aceite, inscreve o jogador automaticamente.
 * Tenta primeiro a RPC `accept_tournament_invite` (SECURITY DEFINER, bypassa RLS).
 * Faz fallback para o método antigo (UPDATE direto + INSERT em players) se a RPC falhar.
 */
export async function updateTournamentInviteStatus(
  playerAccountId: string,
  tournamentId: string,
  status: 'accepted' | 'declined'
): Promise<boolean> {
  // Caminho preferencial: RPC que faz tudo num \u00fanico passo (atualiza convite + auto-enroll)
  const { data: rpcResult, error: rpcError } = await supabase.rpc('accept_tournament_invite', {
    p_player_account_id: playerAccountId,
    p_tournament_id: tournamentId,
    p_status: status,
  })

  if (!rpcError && rpcResult && typeof rpcResult === 'object' && (rpcResult as any).success) {
    return true
  }

  if (rpcError) {
    console.warn('[updateTournamentInviteStatus] RPC falhou, a tentar fallback:', rpcError.message)
  }

  // Fallback: m\u00e9todo antigo (UPDATE direto). Pode falhar silenciosamente em RLS.
  const { error } = await supabase
    .from('tournament_invites')
    .update({ status })
    .eq('player_account_id', playerAccountId)
    .eq('tournament_id', tournamentId)
  if (error) {
    console.error('[updateTournamentInviteStatus] UPDATE falhou:', error)
    return false
  }

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

      const { error: insertError } = await supabase.from('players').insert({
        tournament_id: tournamentId,
        category_id: categoryId,
        name: account.name,
        phone_number: account.phone_number,
        player_account_id: playerAccountId,
      })
      if (insertError) {
        console.error('[updateTournamentInviteStatus] INSERT em players falhou (RLS?):', insertError)
      }
    } catch (e) {
      console.error('[updateTournamentInviteStatus] Auto-enroll falhou:', e)
    }
  }

  return true
}

// ============================================
// Grupos, jogos e brackets por categoria
// ============================================

export interface CategoryGroupStanding {
  id: string
  name: string
  group_name: string
  wins: number
  draws: number
  losses: number
  points_for: number
  points_against: number
  points: number
  player1_name?: string
  player2_name?: string
}

export interface CategoryMatchInfo {
  id: string
  team1_id: string | null
  team2_id: string | null
  team1_name: string
  team2_name: string
  set1?: string
  set2?: string
  set3?: string
  round: string
  status: string
  scheduled_time?: string
}

export interface TournamentCategoryDetail {
  category_id: string
  category_name: string
  groups: Record<string, CategoryGroupStanding[]>
  groupMatches: CategoryMatchInfo[]
  knockoutMatches: CategoryMatchInfo[]
  hasData: boolean
}

const KNOCKOUT_ROUNDS = ['quarter', 'semi', 'final', '3rd', 'round_of_16']
function isKnockoutRound(round: string) {
  const r = round.toLowerCase()
  return KNOCKOUT_ROUNDS.some(k => r.includes(k))
}

export async function fetchTournamentCategoryDetails(tournamentId: string): Promise<TournamentCategoryDetail[]> {
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('format, round_robin_type')
    .eq('id', tournamentId)
    .maybeSingle()

  if (!tournament) return []

  const { data: categories } = await supabase
    .from('tournament_categories')
    .select('id, name')
    .eq('tournament_id', tournamentId)
    .order('name')

  const isIndividual =
    (tournament.format === 'round_robin' && (tournament as any).round_robin_type === 'individual') ||
    tournament.format === 'individual_groups_knockout' ||
    tournament.format === 'mixed_american' ||
    tournament.format === 'mixed_gender'

  const { data: allMatches } = await supabase
    .from('matches')
    .select('id, team1_id, team2_id, team1_score_set1, team2_score_set1, team1_score_set2, team2_score_set2, team1_score_set3, team2_score_set3, round, status, scheduled_time, category_id, player1_individual_id, player2_individual_id, player3_individual_id, player4_individual_id')
    .eq('tournament_id', tournamentId)
    .order('round')

  let nameMap = new Map<string, string>()

  if (isIndividual) {
    const { data: players } = await supabase
      .from('players')
      .select('id, name, group_name, category_id')
      .eq('tournament_id', tournamentId)
    if (players) {
      for (const p of players as any[]) nameMap.set(p.id, p.name)
    }
  } else {
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, group_name, category_id, player1_id, player2_id')
      .eq('tournament_id', tournamentId)
    if (teams) {
      const playerIds = new Set<string>()
      for (const tm of teams as any[]) {
        nameMap.set(tm.id, tm.name)
        if (tm.player1_id) playerIds.add(tm.player1_id)
        if (tm.player2_id) playerIds.add(tm.player2_id)
      }
      if (playerIds.size > 0) {
        const { data: playersForTeams } = await supabase
          .from('players')
          .select('id, name, group_name, category_id')
          .in('id', Array.from(playerIds))
        if (playersForTeams) {
          for (const p of playersForTeams as any[]) nameMap.set(p.id, p.name)
        }
      }
    }
  }

  const entityTable = isIndividual ? 'players' : 'teams'
  const { data: entities } = await supabase
    .from(entityTable)
    .select('id, name, group_name, category_id')
    .eq('tournament_id', tournamentId)

  const entityByCat = new Map<string, any[]>()
  if (entities) {
    for (const e of entities) {
      const catId = (e as any).category_id || 'all'
      if (!entityByCat.has(catId)) entityByCat.set(catId, [])
      entityByCat.get(catId)!.push(e)
    }
  }

  const matchesByCat = new Map<string, any[]>()
  if (allMatches) {
    for (const m of allMatches) {
      const catId = (m as any).category_id || 'all'
      if (!matchesByCat.has(catId)) matchesByCat.set(catId, [])
      matchesByCat.get(catId)!.push(m)
    }
  }

  const buildMatchInfo = (m: any): CategoryMatchInfo => {
    let t1id = m.team1_id
    let t2id = m.team2_id
    let t1name: string
    let t2name: string

    if (isIndividual) {
      const p1 = m.player1_individual_id
      const p2 = m.player2_individual_id
      const p3 = m.player3_individual_id
      const p4 = m.player4_individual_id
      if (!t1id) t1id = p1
      if (!t2id) t2id = p3
      const n1 = nameMap.get(p1) || ''
      const n2 = nameMap.get(p2) || ''
      const n3 = nameMap.get(p3) || ''
      const n4 = nameMap.get(p4) || ''
      t1name = [n1, n2].filter(Boolean).join(' - ') || 'TBD'
      t2name = [n3, n4].filter(Boolean).join(' - ') || 'TBD'
    } else {
      t1name = nameMap.get(t1id) || 'TBD'
      t2name = nameMap.get(t2id) || 'TBD'
    }

    const set1 = (m.team1_score_set1 != null && m.team2_score_set1 != null) ? `${m.team1_score_set1}-${m.team2_score_set1}` : undefined
    const set2 = (m.team1_score_set2 != null && m.team2_score_set2 != null) ? `${m.team1_score_set2}-${m.team2_score_set2}` : undefined
    const set3 = (m.team1_score_set3 != null && m.team2_score_set3 != null) ? `${m.team1_score_set3}-${m.team2_score_set3}` : undefined
    return {
      id: m.id,
      team1_id: t1id,
      team2_id: t2id,
      team1_name: t1name,
      team2_name: t2name,
      set1, set2, set3,
      round: m.round || '',
      status: m.status || 'scheduled',
      scheduled_time: m.scheduled_time,
    }
  }

  const computeGroupStandings = (catEntities: any[], catMatches: any[]): Record<string, CategoryGroupStanding[]> => {
    const hasGroups = catEntities.some((e: any) => e.group_name)
    if (!hasGroups) return {}

    const groups: Record<string, CategoryGroupStanding[]> = {}
    for (const e of catEntities) {
      const gn = (e as any).group_name || 'Geral'
      if (!groups[gn]) groups[gn] = []
      groups[gn].push({
        id: e.id,
        name: (e as any).name,
        group_name: gn,
        wins: 0, draws: 0, losses: 0,
        points_for: 0, points_against: 0, points: 0,
      })
    }

    const completedMatches = catMatches.filter((m: any) => m.status === 'completed')
    for (const m of completedMatches) {
      const t1id = isIndividual ? (m.player1_individual_id || m.team1_id) : m.team1_id
      const t2id = isIndividual ? (m.player2_individual_id || m.team2_id) : m.team2_id
      if (!t1id || !t2id) continue
      if (isKnockoutRound(m.round || '')) continue

      let t1row: CategoryGroupStanding | undefined
      let t2row: CategoryGroupStanding | undefined
      for (const rows of Object.values(groups)) {
        if (!t1row) t1row = rows.find(r => r.id === t1id)
        if (!t2row) t2row = rows.find(r => r.id === t2id)
      }
      if (!t1row || !t2row) continue

      let setsWonT1 = 0, setsWonT2 = 0
      const sets = [
        [m.team1_score_set1, m.team2_score_set1],
        [m.team1_score_set2, m.team2_score_set2],
        [m.team1_score_set3, m.team2_score_set3],
      ]
      for (const [a, b] of sets) {
        if (a != null && b != null) {
          if (a > b) setsWonT1++
          else if (b > a) setsWonT2++
        }
      }
      t1row.points_for += setsWonT1; t1row.points_against += setsWonT2
      t2row.points_for += setsWonT2; t2row.points_against += setsWonT1

      if (setsWonT1 > setsWonT2) { t1row.wins++; t2row.losses++; t1row.points += 3 }
      else if (setsWonT2 > setsWonT1) { t2row.wins++; t1row.losses++; t2row.points += 3 }
      else { t1row.draws++; t2row.draws++; t1row.points++; t2row.points++ }
    }

    for (const rows of Object.values(groups)) {
      rows.sort((a, b) => b.points - a.points || (b.points_for - b.points_against) - (a.points_for - a.points_against))
    }
    return groups
  }

  let catList: { id: string; name: string }[]
  if (categories && categories.length > 0) {
    catList = categories
  } else {
    const derivedCatIds = new Set<string>()
    if (entities) {
      for (const e of entities) {
        const cid = (e as any).category_id
        if (cid) derivedCatIds.add(cid)
      }
    }
    if (derivedCatIds.size > 0) {
      catList = Array.from(derivedCatIds).map(id => ({ id, name: 'Geral' }))
    } else {
      catList = [{ id: 'all', name: 'Geral' }]
    }
  }

  const result: TournamentCategoryDetail[] = []

  for (const cat of catList) {
    const catEntities = entityByCat.get(cat.id) || []
    const catMatches = matchesByCat.get(cat.id) || []

    const groups = computeGroupStandings(catEntities, catMatches)
    const hasGroups = Object.keys(groups).length > 0

    const matchInfos = catMatches.map(buildMatchInfo)
    const groupMatches = matchInfos.filter(m => !isKnockoutRound(m.round))
    const knockoutMatches = matchInfos.filter(m => isKnockoutRound(m.round))

    const hasData = hasGroups || matchInfos.length > 0

    result.push({
      category_id: cat.id,
      category_name: cat.name,
      groups,
      groupMatches,
      knockoutMatches,
      hasData,
    })
  }

  return result
}
