/**
 * Dados leves para popup de pré-visualização de jogador (inscritos, etc.)
 */
import { supabase } from './supabase'
import { findPlayerAccountByName } from './classes'
import { fetchGlobalRankings } from './playerRankings'

export interface PlayerPreviewData {
  name: string
  avatar_url?: string | null
  level?: number
  wins?: number
  losses?: number
  rankingPosition?: number | null
}

let rankingsCache: { at: number; male: Map<string, number>; female: Map<string, number> } | null = null
const RANKINGS_TTL_MS = 60_000

async function rankingPositionFor(accountId?: string | null, userId?: string | null): Promise<number | null> {
  const now = Date.now()
  if (!rankingsCache || now - rankingsCache.at > RANKINGS_TTL_MS) {
    const rankings = await fetchGlobalRankings()
    const male = new Map<string, number>()
    const female = new Map<string, number>()
    rankings.male.forEach((e) => {
      male.set(e.id, e.position)
      if (e.user_id) male.set(`u:${e.user_id}`, e.position)
    })
    rankings.female.forEach((e) => {
      female.set(e.id, e.position)
      if (e.user_id) female.set(`u:${e.user_id}`, e.position)
    })
    rankingsCache = { at: now, male, female }
  }
  const lookup = (m: Map<string, number>) =>
    (accountId && m.get(accountId)) || (userId && m.get(`u:${userId}`)) || null
  return lookup(rankingsCache.male) ?? lookup(rankingsCache.female)
}

export async function fetchPlayerPreview(opts: {
  accountId?: string | null
  userId?: string | null
  nameHint?: string
}): Promise<PlayerPreviewData | null> {
  let row: {
    id: string
    user_id?: string | null
    name: string
    avatar_url?: string | null
    level?: number | null
    wins?: number | null
    losses?: number | null
  } | null = null

  if (opts.accountId) {
    const { data } = await supabase
      .from('player_accounts')
      .select('id, user_id, name, avatar_url, level, wins, losses')
      .eq('id', opts.accountId)
      .maybeSingle()
    row = data
  }

  if (!row && opts.userId) {
    const { data } = await supabase
      .from('player_accounts')
      .select('id, user_id, name, avatar_url, level, wins, losses')
      .eq('user_id', opts.userId)
      .maybeSingle()
    row = data
  }

  if (!row && opts.nameHint) {
    const acc = await findPlayerAccountByName(opts.nameHint)
    if (acc) {
      const { data } = await supabase
        .from('player_accounts')
        .select('id, user_id, name, avatar_url, level, wins, losses')
        .eq('id', acc.id)
        .maybeSingle()
      row = data
    }
  }

  if (!row) {
    return opts.nameHint
      ? {
          name: opts.nameHint,
          level: undefined,
          wins: 0,
          losses: 0,
          rankingPosition: null,
        }
      : null
  }

  const rankingPosition = await rankingPositionFor(row.id, row.user_id)

  return {
    name: row.name,
    avatar_url: row.avatar_url,
    level: row.level ?? undefined,
    wins: row.wins ?? 0,
    losses: row.losses ?? 0,
    rankingPosition,
  }
}
