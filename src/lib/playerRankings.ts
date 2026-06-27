import { supabase } from './supabase'
import { fetchAllClubs } from './clubAndTournaments'

export interface RankingEntry {
  id: string
  user_id: string | null
  name: string
  avatar_url: string | null
  level: number
  gender: 'male' | 'female'
  position: number
}

export interface RankingsByGender {
  male: RankingEntry[]
  female: RankingEntry[]
}

interface RawRankingRow {
  id: string
  user_id: string | null
  name: string
  avatar_url: string | null
  level: number | string | null
  gender: string | null
  player_category: string | null
}

function isTestPlayer(name?: string | null): boolean {
  if (!name) return true
  const n = name.trim().toUpperCase()
  if (n === 'TEST' || n.startsWith('TEST ') || n.startsWith('PF3') || n.startsWith('PF4')) return true
  if (/^PF\d/.test(n)) return true
  if (/^TEST/i.test(n)) return true
  return false
}

function resolveGender(row: Pick<RawRankingRow, 'gender' | 'player_category'>): 'male' | 'female' | null {
  if (row.gender === 'male' || row.gender === 'female') return row.gender
  const cat = (row.player_category || '').toUpperCase()
  if (cat.startsWith('M')) return 'male'
  if (cat.startsWith('F')) return 'female'
  return null
}

function buildRankings(rows: RawRankingRow[]): RankingsByGender {
  const male: RankingEntry[] = []
  const female: RankingEntry[] = []

  const sorted = [...rows]
    .filter(r => !isTestPlayer(r.name) && r.level != null && Number(r.level) > 0)
    .sort((a, b) => {
      const levelDiff = Number(b.level) - Number(a.level)
      if (levelDiff !== 0) return levelDiff
      return (a.name || '').localeCompare(b.name || '', 'pt')
    })

  for (const row of sorted) {
    const gender = resolveGender(row)
    if (!gender) continue
    const entry: RankingEntry = {
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      avatar_url: row.avatar_url,
      level: Number(row.level),
      gender,
      position: 0,
    }
    if (gender === 'male') male.push(entry)
    else female.push(entry)
  }

  male.forEach((e, i) => { e.position = i + 1 })
  female.forEach((e, i) => { e.position = i + 1 })

  return { male, female }
}

export async function fetchGlobalRankings(): Promise<RankingsByGender> {
  const { data, error } = await supabase.rpc('get_player_level_rankings', { p_club_id: null })

  if (error) {
    console.error('[Rankings] fetchGlobalRankings error:', error)
    return { male: [], female: [] }
  }

  return buildRankings((data || []) as RawRankingRow[])
}

export async function fetchClubRankings(clubId: string): Promise<RankingsByGender> {
  const { data, error } = await supabase.rpc('get_player_level_rankings', { p_club_id: clubId })

  if (error) {
    console.error('[Rankings] fetchClubRankings error:', error)
    return { male: [], female: [] }
  }

  return buildRankings((data || []) as RawRankingRow[])
}

/** Devolve o clube APC (ou o primeiro clube gerido) para rankings por clube. */
export async function findDefaultRankingClub(): Promise<{ id: string; name: string } | null> {
  const clubs = await fetchAllClubs()
  const apc = clubs.find(c => /\bAPC\b/i.test(c.name) || c.name.toUpperCase().includes('APC'))
  if (apc) return { id: apc.id, name: apc.name }
  if (clubs.length > 0) return { id: clubs[0].id, name: clubs[0].name }
  return null
}
