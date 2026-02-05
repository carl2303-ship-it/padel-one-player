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
}

/** Próximos torneios (Tour) – opcionalmente filtrados por club_id do APC. */
export async function fetchUpcomingTournaments(clubId?: string | null): Promise<UpcomingTournamentFromTour[]> {
  const today = new Date().toISOString().split('T')[0]
  let query = supabase
    .from('tournaments')
    .select('id, name, start_date, end_date, status, image_url, club_id')
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
