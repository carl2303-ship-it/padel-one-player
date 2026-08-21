import { supabase } from './supabase'
import { sendPushToPlayer } from './pushNotifications'
import { getTranslations } from './translations'
import { getPartnerNamesFromMatch, isLikelyTeamLabel } from './matchPlayerNames'
import { resolveTeamPlayerNamesMap, resolveIndividualPlayerNames } from './resolveTeamPlayerNames'

// ============================================
// Helpers
// ============================================

/** Verifica se um nome parece ser de teste/placeholder */
function isTestPlayer(name?: string): boolean {
  if (!name) return true
  const n = name.trim().toUpperCase()
  if (n === 'TEST' || n.startsWith('TEST ') || n.startsWith('PF3') || n.startsWith('PF4')) return true
  if (/^PF\d/.test(n)) return true
  if (/^TEST/i.test(n)) return true
  return false
}

/** Retorna as iniciais do nome (primeira letra do nome + primeira letra do apelido) */
export function getInitials(name?: string): string {
  if (!name) return '?'
  const primary = name.trim().split(/\s*\/\s*/)[0]?.trim() || name.trim()
  const parts = primary.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/** @deprecated Use levelColors() instead */
export function categoryColors(category?: string | null): { bg: string; text: string; border: string; hex: string; hexTo: string } {
  return levelColors(undefined)
}

/** @deprecated Use player.level instead */
export function categoryToLevel(category?: string | null): number | undefined {
  if (!category) return undefined
  const num = parseInt(category.charAt(category.length - 1))
  if (isNaN(num) || num < 1 || num > 6) return undefined
  const map: Record<number, number> = { 1: 6.5, 2: 5.5, 3: 4.5, 4: 3.5, 5: 2.5, 6: 1.0 }
  return map[num]
}

/** Cores por nível numérico */
export function levelColors(level?: number | null): { bg: string; text: string; border: string; hex: string; hexTo: string } {
  const lvl = level ?? 0
  if (lvl >= 6) return { bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-600', hex: '#9333ea', hexTo: '#7e22ce' }
  if (lvl >= 5) return { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-600', hex: '#2563eb', hexTo: '#1d4ed8' }
  if (lvl >= 4) return { bg: 'bg-green-600', text: 'text-white', border: 'border-green-600', hex: '#16a34a', hexTo: '#15803d' }
  if (lvl >= 3) return { bg: 'bg-yellow-500', text: 'text-white', border: 'border-yellow-500', hex: '#eab308', hexTo: '#ca8a04' }
  if (lvl >= 2) return { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-500', hex: '#f97316', hexTo: '#ea580c' }
  return { bg: 'bg-gray-400', text: 'text-white', border: 'border-gray-400', hex: '#9ca3af', hexTo: '#6b7280' }
}

// ============================================
// Types
// ============================================

export interface CommunityPlayer {
  id: string          // player_accounts.id
  user_id: string     // auth user id
  name: string
  avatar_url?: string
  level?: number
  player_category?: string
  location?: string
  is_following?: boolean
}

export interface CommunityPost {
  id: string
  user_id: string
  content: string | null
  image_url: string | null
  video_url: string | null
  post_type: string
  match_id: string | null
  created_at: string
  // Joined fields
  author_name?: string
  author_avatar?: string
  author_level?: number
}

/** Um item de feed pode ser um post OU um jogo recente de um jogador seguido */
export interface FeedMatchItem {
  id: string
  tournament_id: string
  tournament_name: string
  court: string
  start_time: string
  team1_name: string
  team2_name: string
  player1_name?: string
  player2_name?: string
  player3_name?: string
  player4_name?: string
  player1_avatar?: string | null
  player2_avatar?: string | null
  player3_avatar?: string | null
  player4_avatar?: string | null
  score1: number | null
  score2: number | null
  status: string
  round: string
  set1?: string
  set2?: string
  set3?: string
  // Info do jogador seguido que participou
  followed_player_name: string
  followed_player_avatar?: string | null
  followed_player_level?: number | null
  followed_player_won: boolean
  played_at: string
}

export type FeedItem =
  | { type: 'post'; data: CommunityPost; date: string }
  | { type: 'match'; data: FeedMatchItem; date: string }


// ============================================
// Follow / Unfollow
// ============================================

export async function followUser(followerId: string, followingId: string): Promise<boolean> {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId })
  if (error) {
    console.error('[Community] Error following:', error)
    return false
  }

  // 🔔 Push: notify the followed user
  try {
    // Get follower name
    const { data: followerAccount } = await supabase
      .from('player_accounts')
      .select('name')
      .eq('user_id', followerId)
      .maybeSingle()
    // Get followed user's player_account_id
    const { data: followedAccount } = await supabase
      .from('player_accounts')
      .select('id')
      .eq('user_id', followingId)
      .maybeSingle()
    
    if (followedAccount?.id) {
      const { getTranslations } = await import('./translations')
      const t = getTranslations()
      sendPushToPlayer(followedAccount.id, {
        title: t.notifications.newFollower,
        body: t.notifications.newFollowerBody.replace('{name}', followerAccount?.name || t.notifications.someone),
        url: '/?screen=community',
        tag: `follow-${followerId}`,
      })
    }
  } catch {}

  return true
}

export async function unfollowUser(followerId: string, followingId: string): Promise<boolean> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
  if (error) {
    console.error('[Community] Error unfollowing:', error)
    return false
  }
  return true
}

export async function getFollowingIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
  return (data || []).map((f: any) => f.following_id)
}

export async function getFollowingCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('follows')
    .select('id', { count: 'exact', head: true })
    .eq('follower_id', userId)
  return count || 0
}

export async function getFollowersCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('follows')
    .select('id', { count: 'exact', head: true })
    .eq('following_id', userId)
  return count || 0
}

/** Get full list of users I'm following with their details */
export async function getFollowingList(userId: string): Promise<CommunityPlayer[]> {
  const { data: followData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)

  if (!followData || followData.length === 0) return []

  const followingIds = followData.map((f: any) => f.following_id)
  
  const { data: players } = await supabase
    .from('player_accounts')
    .select('id, user_id, name, avatar_url, level, player_category, location')
    .in('user_id', followingIds)

  if (!players) return []

  return players
    .filter((p: any) => !isTestPlayer(p.name))
    .map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      name: p.name,
      avatar_url: p.avatar_url,
      level: p.level ?? undefined,
      player_category: p.player_category || undefined,
      location: p.location,
      is_following: true,
    }))
}

/** Get full list of my followers with their details */
export async function getFollowersList(userId: string): Promise<CommunityPlayer[]> {
  const { data: followData } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', userId)

  if (!followData || followData.length === 0) return []

  const followerIds = followData.map((f: any) => f.follower_id)
  
  const { data: players } = await supabase
    .from('player_accounts')
    .select('id, user_id, name, avatar_url, level, player_category, location')
    .in('user_id', followerIds)

  if (!players) return []

  // Check which of my followers I also follow back
  const myFollowingIds = await getFollowingIds(userId)
  const myFollowingSet = new Set(myFollowingIds)

  return players
    .filter((p: any) => !isTestPlayer(p.name))
    .map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      name: p.name,
      avatar_url: p.avatar_url,
      level: p.level ?? undefined,
      player_category: p.player_category || undefined,
      location: p.location,
      is_following: myFollowingSet.has(p.user_id),
    }))
}

// ============================================
// Suggested Players
// ============================================

export async function getSuggestedPlayers(userId: string): Promise<CommunityPlayer[]> {
  const { data, error } = await supabase.rpc('get_suggested_players', { p_user_id: userId })

  if (error) {
    console.error('[Community] getSuggestedPlayers RPC error:', error)
    return []
  }
  if (!data) return []

  return (data as any[])
    .filter((p: any) => !isTestPlayer(p.name))
    .map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      name: p.name,
      avatar_url: p.avatar_url,
      level: p.level ?? undefined,
      player_category: p.player_category || undefined,
      location: p.location,
      is_following: false,
    }))
}

// ============================================
// Feed Posts
// ============================================

export async function getFeedPosts(userId: string): Promise<CommunityPost[]> {
  // Get who I follow
  const followingIds = await getFollowingIds(userId)
  // Include my own posts too
  const allUserIds = [...followingIds, userId]

  if (allUserIds.length === 0) return []

  const { data: posts } = await supabase
    .from('community_posts')
    .select('*')
    .in('user_id', allUserIds)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!posts || posts.length === 0) return []

  // Get author details from player_accounts
  const uniqueUserIds = [...new Set(posts.map((p: any) => p.user_id))]
  const { data: authors } = await supabase
    .from('player_accounts')
    .select('user_id, name, avatar_url, level')
    .in('user_id', uniqueUserIds)

  const authorMap = new Map<string, any>()
  if (authors) {
    authors.forEach((a: any) => authorMap.set(a.user_id, a))
  }

  return posts.map((p: any) => {
    const author = authorMap.get(p.user_id)
    return {
      ...p,
      author_name: author?.name || (typeof window !== 'undefined' ? getTranslations().common.player : 'Jogador'),
      author_avatar: author?.avatar_url,
      author_level: author?.level,
    }
  })
}

// ============================================
// Feed: Jogos dos seguidos
// ============================================

/**
 * Busca jogos recentes (últimos 60 dias) de jogadores que eu sigo.
 * Inclui jogos de torneio (matches) E jogos abertos (open_games).
 * Retorna até 30 jogos mais recentes, com info do jogador seguido.
 */
export async function getFeedMatches(userId: string): Promise<FeedMatchItem[]> {
  // 1) Quem eu sigo
  const followingIds = await getFollowingIds(userId)
  if (followingIds.length === 0) return []

  // 2) Obter player_accounts dos seguidos (batch)
  const { data: followedAccounts } = await supabase
    .from('player_accounts')
    .select('id, user_id, name, avatar_url, level, phone_number')
    .in('user_id', followingIds)

  if (!followedAccounts || followedAccounts.length === 0) return []

  // Mapa user_id → player_account info
  const accountByUserId = new Map<string, typeof followedAccounts[0]>()
  const accountById = new Map<string, typeof followedAccounts[0]>()
  followedAccounts.forEach(a => {
    accountByUserId.set(a.user_id, a)
    accountById.set(a.id, a)
  })
  const playerAccountIds = followedAccounts.map(a => a.id)

  // 3) Obter players ligados a estes player_accounts OU por user_id
  //    NOTA: A tabela 'players' pode ter RLS restritivo que impede ver players de outros users.
  //    Se o resultado for vazio, logamos o problema para diagnóstico.
  const { data: playersByAccount, error: errByAccount } = await supabase
    .from('players')
    .select('id, player_account_id, user_id')
    .in('player_account_id', playerAccountIds)

  const { data: playersByUser, error: errByUser } = await supabase
    .from('players')
    .select('id, player_account_id, user_id')
    .in('user_id', followingIds)

  // Combinar resultados (sem duplicados)
  const allPlayersMap = new Map<string, { id: string; player_account_id: string | null; user_id: string | null }>()
  ;(playersByAccount || []).forEach(p => allPlayersMap.set(p.id, p))
  ;(playersByUser || []).forEach(p => allPlayersMap.set(p.id, p))
  const playersData = Array.from(allPlayersMap.values())

  // Mapa player_id → player_account_id
  const playerToAccount = new Map<string, string>()
  playersData.forEach(p => {
    if (p.player_account_id) {
      playerToAccount.set(p.id, p.player_account_id)
    } else if (p.user_id) {
      // Fallback: mapear via user_id → player_account
      const acct = accountByUserId.get(p.user_id)
      if (acct) playerToAccount.set(p.id, acct.id)
    }
  })
  const playerIds = playersData.map(p => p.id)

  const results: FeedMatchItem[] = []

  // ============================================
  // PARTE A: Jogos de Torneio (matches table)
  // ============================================
  // Helper: dividir array em batches
  const chunk = <T>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = []
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size))
    }
    return chunks
  }

  if (playerIds.length > 0) {
    // 4) Obter teams que contêm estes players (em batches para evitar URL longo)
    const allTeams: { id: string; player1_id: string | null; player2_id: string | null }[] = []
    const playerBatches = chunk(playerIds, 40) // max 40 players × 2 conditions = 80 per batch

    for (const batch of playerBatches) {
      const batchCond = batch.map(id => `player1_id.eq.${id},player2_id.eq.${id}`).join(',')
      const { data: batchTeams } = await supabase
        .from('teams')
        .select('id, player1_id, player2_id')
        .or(batchCond)
      if (batchTeams) allTeams.push(...batchTeams)
    }

    // Deduplicar teams
    const teamsMap = new Map<string, typeof allTeams[0]>()
    allTeams.forEach(t => teamsMap.set(t.id, t))
    const teamsData = Array.from(teamsMap.values())

    const teamIds = teamsData.map(t => t.id)
    const teamToAccount = new Map<string, string>()
    teamsData.forEach(t => {
      const p1AccountId = t.player1_id ? playerToAccount.get(t.player1_id) : undefined
      const p2AccountId = t.player2_id ? playerToAccount.get(t.player2_id) : undefined
      if (p1AccountId) teamToAccount.set(t.id, p1AccountId)
      else if (p2AccountId) teamToAccount.set(t.id, p2AccountId)
    })

    const since = new Date()
    since.setDate(since.getDate() - 60)
    const sinceISO = since.toISOString()

    const matchSelect = `
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

    // 5) Buscar matches em batches separados:
    //    A) Por team IDs (batches de 25 teams)
    //    B) Por individual player IDs (batches de 15 players)
    const allMatchesMap = new Map<string, any>()

    // 5A) Matches por teams
    if (teamIds.length > 0) {
      const teamBatches = chunk(teamIds, 25)
      for (const batch of teamBatches) {
        const cond = `team1_id.in.(${batch.join(',')}),team2_id.in.(${batch.join(',')})`
        const { data } = await supabase
          .from('matches')
          .select(matchSelect)
          .or(cond)
          .eq('status', 'completed')
          .gte('scheduled_time', sinceISO)
          .order('scheduled_time', { ascending: false })
          .limit(30)
        if (data) data.forEach((m: any) => allMatchesMap.set(m.id, m))
      }
    }

    // 5B) Matches por individual player IDs (usar .in.() para URLs curtos)
    const indivBatches = chunk(playerIds, 50)
    for (const batch of indivBatches) {
      const ids = batch.join(',')
      const cond = `player1_individual_id.in.(${ids}),player2_individual_id.in.(${ids}),player3_individual_id.in.(${ids}),player4_individual_id.in.(${ids})`
      const { data } = await supabase
        .from('matches')
        .select(matchSelect)
        .or(cond)
        .eq('status', 'completed')
        .gte('scheduled_time', sinceISO)
        .order('scheduled_time', { ascending: false })
        .limit(30)
      if (data) data.forEach((m: any) => allMatchesMap.set(m.id, m))
    }

    const matchesData = Array.from(allMatchesMap.values())

    if (matchesData.length > 0) {
      const playerIdSet = new Set(playerIds)

      // Resolve nomes reais via RPC (bypassa RLS) + player_accounts
      const teamIdsFromMatches = new Set<string>()
      const individualPlayersForNames: Array<{ id?: string | null; name?: string | null }> = []
      for (const m of matchesData) {
        if (m.team1_id) teamIdsFromMatches.add(m.team1_id)
        if (m.team2_id) teamIdsFromMatches.add(m.team2_id)
        if (m.p1) individualPlayersForNames.push(m.p1)
        if (m.p2) individualPlayersForNames.push(m.p2)
        if (m.p3) individualPlayersForNames.push(m.p3)
        if (m.p4) individualPlayersForNames.push(m.p4)
      }
      const [teamPlayerNamesMap, individualNamesMap] = await Promise.all([
        resolveTeamPlayerNamesMap(teamIdsFromMatches),
        resolveIndividualPlayerNames(individualPlayersForNames),
      ])

      for (const m of matchesData) {
        const isIndividual = m.p1 || m.p2 || m.p3 || m.p4

        let followedAccountId: string | undefined

        if (isIndividual) {
          for (const pid of [m.p1?.id, m.p2?.id, m.p3?.id, m.p4?.id]) {
            if (pid && playerToAccount.has(pid)) {
              followedAccountId = playerToAccount.get(pid)
              break
            }
          }
        } else {
          if (m.team1_id && teamToAccount.has(m.team1_id)) {
            followedAccountId = teamToAccount.get(m.team1_id)
          } else if (m.team2_id && teamToAccount.has(m.team2_id)) {
            followedAccountId = teamToAccount.get(m.team2_id)
          }
        }

        if (!followedAccountId) continue
        const followedAccount = accountById.get(followedAccountId)
        if (!followedAccount) continue

        const team1Players = m.team1_id ? teamPlayerNamesMap.get(m.team1_id) : null
        const team2Players = m.team2_id ? teamPlayerNamesMap.get(m.team2_id) : null

        const r1 = m.p1?.id ? individualNamesMap.get(m.p1.id) : null
        const r2 = m.p2?.id ? individualNamesMap.get(m.p2.id) : null
        const r3 = m.p3?.id ? individualNamesMap.get(m.p3.id) : null
        const r4 = m.p4?.id ? individualNamesMap.get(m.p4.id) : null

        const p1Name = isIndividual ? (r1?.name || m.p1?.name) : (team1Players?.player1_name || (m.team1 as any)?.t1p1?.name)
        const p2Name = isIndividual ? (r2?.name || m.p2?.name) : (team1Players?.player2_name || (m.team1 as any)?.t1p2?.name)
        const p3Name = isIndividual ? (r3?.name || m.p3?.name) : (team2Players?.player1_name || (m.team2 as any)?.t2p1?.name)
        const p4Name = isIndividual ? (r4?.name || m.p4?.name) : (team2Players?.player2_name || (m.team2 as any)?.t2p2?.name)

        const team1Name = isIndividual
          ? `${p1Name || 'TBD'}${p2Name ? ' / ' + p2Name : ''}`
          : m.team1?.name || 'TBD'
        const team2Name = isIndividual
          ? `${p3Name || 'TBD'}${p4Name ? ' / ' + p4Name : ''}`
          : m.team2?.name || 'TBD'

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

        let followedInTeam1 = false
        if (isIndividual) {
          followedInTeam1 = (m.p1?.id && playerIdSet.has(m.p1.id) && playerToAccount.get(m.p1.id) === followedAccountId) ||
                            (m.p2?.id && playerIdSet.has(m.p2.id) && playerToAccount.get(m.p2.id) === followedAccountId)
        } else {
          followedInTeam1 = m.team1_id && teamToAccount.get(m.team1_id) === followedAccountId
        }

        const followedWon = followedInTeam1 ? team1Sets > team2Sets : team2Sets > team1Sets

        const set1 = (m.team1_score_set1 != null && m.team2_score_set1 != null)
          ? `${m.team1_score_set1}-${m.team2_score_set1}` : undefined
        const set2 = (m.team1_score_set2 != null && m.team2_score_set2 != null && (m.team1_score_set2 > 0 || m.team2_score_set2 > 0))
          ? `${m.team1_score_set2}-${m.team2_score_set2}` : undefined
        const set3 = (m.team1_score_set3 != null && m.team2_score_set3 != null && (m.team1_score_set3 > 0 || m.team2_score_set3 > 0))
          ? `${m.team1_score_set3}-${m.team2_score_set3}` : undefined

        results.push({
          id: m.id,
          tournament_id: m.tournament_id,
          tournament_name: (m.tournaments as any)?.name || '',
          court: m.court || '',
          start_time: m.scheduled_time || '',
          team1_name: team1Name,
          team2_name: team2Name,
          player1_name: p1Name,
          player2_name: p2Name,
          player3_name: p3Name,
          player4_name: p4Name,
          player1_avatar: isIndividual ? (r1?.avatar_url ?? null) : (team1Players?.player1_avatar ?? null),
          player2_avatar: isIndividual ? (r2?.avatar_url ?? null) : (team1Players?.player2_avatar ?? null),
          player3_avatar: isIndividual ? (r3?.avatar_url ?? null) : (team2Players?.player1_avatar ?? null),
          player4_avatar: isIndividual ? (r4?.avatar_url ?? null) : (team2Players?.player2_avatar ?? null),
          score1: team1Sets,
          score2: team2Sets,
          status: m.status,
          round: m.round || '',
          set1,
          set2,
          set3,
          followed_player_name: followedAccount.name,
          followed_player_avatar: followedAccount.avatar_url,
          followed_player_level: followedAccount.level,
          followed_player_won: followedWon,
          played_at: m.scheduled_time || '',
        })
      }
    }
  }

  // ============================================
  // PARTE B: Jogos Abertos (open_games table)
  // ============================================
  try {
    const since = new Date()
    since.setDate(since.getDate() - 60)

    // Buscar jogos abertos com resultado confirmado onde jogadores seguidos participaram
    const { data: openGamePlayers } = await supabase
      .from('open_game_players')
      .select('game_id, user_id, player_account_id, position')
      .in('player_account_id', playerAccountIds)
      .eq('status', 'confirmed')

    if (openGamePlayers && openGamePlayers.length > 0) {
      const openGameIds = [...new Set(openGamePlayers.map(p => p.game_id))]

      // Buscar resultados confirmados desses jogos
      const { data: openResults } = await supabase
        .from('open_game_results')
        .select(`
          id, game_id, status,
          team1_score_set1, team2_score_set1,
          team1_score_set2, team2_score_set2,
          team1_score_set3, team2_score_set3,
          created_at
        `)
        .in('game_id', openGameIds)
        .eq('status', 'confirmed')

      if (openResults && openResults.length > 0) {
        const confirmedGameIds = openResults.map(r => r.game_id)

        // Buscar dados dos jogos
        const { data: openGames } = await supabase
          .from('open_games')
          .select('id, scheduled_at, club_id, clubs(name)')
          .in('id', confirmedGameIds)
          .gte('scheduled_at', since.toISOString())

        if (openGames && openGames.length > 0) {
          // Buscar TODOS os jogadores desses jogos
          const { data: allGamePlayers } = await supabase
            .from('open_game_players')
            .select('game_id, user_id, player_account_id, position, status')
            .in('game_id', confirmedGameIds)
            .eq('status', 'confirmed')

          // Buscar nomes dos jogadores
          const allPaIds = [...new Set((allGamePlayers || []).map(p => p.player_account_id).filter(Boolean))]
          const { data: playerNames } = allPaIds.length > 0
            ? await supabase.from('player_accounts').select('id, name').in('id', allPaIds)
            : { data: [] }
          const nameMap = new Map<string, string>()
          ;(playerNames || []).forEach((p: any) => nameMap.set(p.id, p.name))

          for (const game of (openGames as any[])) {
            const result = openResults.find(r => r.game_id === game.id)
            if (!result) continue

            const gamePlayers = (allGamePlayers || []).filter(p => p.game_id === game.id)
            const followedPlayer = gamePlayers.find(p => p.player_account_id && playerAccountIds.includes(p.player_account_id))
            if (!followedPlayer || !followedPlayer.player_account_id) continue

            const followedAccount = accountById.get(followedPlayer.player_account_id)
            if (!followedAccount) continue

            // Nomes por posição
            const byPos = new Map<number, string>()
            gamePlayers.forEach(p => {
              if (p.position && p.player_account_id) {
                const t = typeof window !== 'undefined' ? getTranslations() : null
                byPos.set(p.position, nameMap.get(p.player_account_id) || (t?.common.player || 'Jogador'))
              }
            })

            const t = typeof window !== 'undefined' ? (() => { try { return (require('./translations') as any).getTranslations() } catch { return null } })() : null
            const playerLabel = t?.common.player || 'Jogador'
            const p1Name = byPos.get(1) || `${playerLabel} 1`
            const p2Name = byPos.get(2) || `${playerLabel} 2`
            const p3Name = byPos.get(3) || `${playerLabel} 3`
            const p4Name = byPos.get(4) || `${playerLabel} 4`

            const team1Sets = [
              (result.team1_score_set1 || 0) > (result.team2_score_set1 || 0) ? 1 : 0,
              (result.team1_score_set2 || 0) > (result.team2_score_set2 || 0) ? 1 : 0,
              (result.team1_score_set3 || 0) > (result.team2_score_set3 || 0) ? 1 : 0,
            ].reduce((a, b) => a + b, 0)
            const team2Sets = [
              (result.team2_score_set1 || 0) > (result.team1_score_set1 || 0) ? 1 : 0,
              (result.team2_score_set2 || 0) > (result.team1_score_set2 || 0) ? 1 : 0,
              (result.team2_score_set3 || 0) > (result.team1_score_set3 || 0) ? 1 : 0,
            ].reduce((a, b) => a + b, 0)

            const followedInTeam1 = followedPlayer.position != null && followedPlayer.position <= 2
            const followedWon = followedInTeam1 ? team1Sets > team2Sets : team2Sets > team1Sets

            const set1 = `${result.team1_score_set1 || 0}-${result.team2_score_set1 || 0}`
            const set2 = (result.team1_score_set2 > 0 || result.team2_score_set2 > 0)
              ? `${result.team1_score_set2}-${result.team2_score_set2}` : undefined
            const set3 = (result.team1_score_set3 > 0 || result.team2_score_set3 > 0)
              ? `${result.team1_score_set3}-${result.team2_score_set3}` : undefined

            const clubName = (game.clubs as any)?.name || ''

            results.push({
              id: game.id,
              tournament_id: '',
              tournament_name: clubName ? `Jogo Aberto · ${clubName}` : 'Jogo Aberto',
              court: '',
              start_time: game.scheduled_at || '',
              team1_name: `${p1Name} / ${p2Name}`,
              team2_name: `${p3Name} / ${p4Name}`,
              player1_name: p1Name,
              player2_name: p2Name,
              player3_name: p3Name,
              player4_name: p4Name,
              score1: team1Sets,
              score2: team2Sets,
              status: 'completed',
              round: 'open_game',
              set1,
              set2,
              set3,
              followed_player_name: followedAccount.name,
              followed_player_avatar: followedAccount.avatar_url,
              followed_player_level: followedAccount.level,
              followed_player_won: followedWon,
              played_at: game.scheduled_at || result.created_at || '',
            })
          }
        }
      }
    }
  } catch (err) {
    console.error('[Community] Error fetching open game feed:', err)
  }

  // Ordenar tudo por data (mais recente primeiro)
  results.sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())

  return results.slice(0, 30)
}

// ============================================
// Feed Unificado (Posts + Jogos dos Seguidos)
// ============================================

/**
 * Retorna um feed unificado com posts e jogos dos seguidos,
 * ordenado por data (mais recente primeiro).
 */
export async function getUnifiedFeed(userId: string): Promise<FeedItem[]> {
  const [posts, matches] = await Promise.all([
    getFeedPosts(userId),
    getFeedMatches(userId),
  ])

  const items: FeedItem[] = []

  for (const post of posts) {
    items.push({ type: 'post', data: post, date: post.created_at })
  }

  for (const match of matches) {
    items.push({ type: 'match', data: match, date: match.played_at })
  }

  // Ordenar por data descendente
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return items
}

// ============================================
// Create Post
// ============================================

export async function createPost(
  userId: string,
  content: string,
  imageFile?: File,
  videoFile?: File
): Promise<boolean> {
  let image_url: string | null = null
  let video_url: string | null = null
  let post_type = 'text'

  // Upload image if provided
  if (imageFile) {
    const ext = imageFile.name.split('.').pop()
    const path = `posts/${userId}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('community')
      .upload(path, imageFile, { upsert: true })
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('community').getPublicUrl(path)
      image_url = urlData.publicUrl
      post_type = 'image'
    } else {
      console.error('[Community] Image upload error:', uploadError)
    }
  }

  // Upload video if provided
  if (videoFile) {
    const ext = videoFile.name.split('.').pop()
    const path = `posts/${userId}/${Date.now()}_video.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('community')
      .upload(path, videoFile, { upsert: true })
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('community').getPublicUrl(path)
      video_url = urlData.publicUrl
      post_type = 'video'
    } else {
      console.error('[Community] Video upload error:', uploadError)
    }
  }

  const { error } = await supabase
    .from('community_posts')
    .insert({
      user_id: userId,
      content: content || null,
      image_url,
      video_url,
      post_type,
    })

  if (error) {
    console.error('[Community] Error creating post:', error)
    return false
  }
  return true
}

export async function deletePost(postId: string): Promise<boolean> {
  const { error } = await supabase
    .from('community_posts')
    .delete()
    .eq('id', postId)
  if (error) {
    console.error('[Community] Error deleting post:', error)
    return false
  }
  return true
}


// ============================================
// Get Player Profile (full details for another player)
// ============================================

export interface ProfileMatch {
  id: string
  tournament_id?: string
  tournament_name?: string
  team1_name: string
  team2_name: string
  player1_name?: string
  player2_name?: string
  player3_name?: string
  player4_name?: string
  score1: number | null
  score2: number | null
  set1?: string
  set2?: string
  set3?: string
  is_winner: boolean | null
  played_at?: string
}

export interface TopPlayer {
  name: string
  count: number
}

export interface FavoriteClub {
  id: string
  name: string
  logo_url?: string
}

export interface PlayerProfile {
  id: string
  user_id: string
  name: string
  avatar_url?: string
  level?: number
  level_reliability_percent?: number
  player_category?: string
  location?: string
  bio?: string
  preferred_hand?: string
  court_position?: string
  game_type?: string
  preferred_time?: string
  birth_date?: string
  wins?: number
  draws?: number
  losses?: number
  points?: number
  favorite_club_id?: string
  followingCount: number
  followersCount: number
  isFollowedByMe: boolean
  recentMatches: ProfileMatch[]
  topPlayers: TopPlayer[]
  favoriteClub: FavoriteClub | null
}

export async function getPlayerProfile(
  targetUserId: string,
  myUserId: string,
  opts?: { accountId?: string | null; preferredName?: string | null },
): Promise<PlayerProfile | null> {
  const fields =
    'id, user_id, name, avatar_url, level, level_reliability_percent, player_category, location, bio, preferred_hand, court_position, game_type, preferred_time, birth_date, wins, losses, points, favorite_club_id, phone_number'

  // 1) Fetch the correct player_accounts row.
  // Several placeholder/legacy accounts can share the same user_id — never pick at random.
  let pa: any = null
  if (opts?.accountId) {
    const { data } = await supabase.from('player_accounts').select(fields).eq('id', opts.accountId).maybeSingle()
    pa = data
  }
  if (!pa && opts?.preferredName) {
    const preferred = opts.preferredName.trim().toLowerCase()
    const { data: byUser } = await supabase.from('player_accounts').select(fields).eq('user_id', targetUserId)
    pa =
      (byUser || []).find((a: any) => (a.name || '').trim().toLowerCase() === preferred) ||
      (byUser || []).find((a: any) => (a.name || '').trim().toLowerCase().startsWith(preferred.split(/\s*\/\s*/)[0])) ||
      null
  }
  if (!pa) {
    const { data: byUser } = await supabase.from('player_accounts').select(fields).eq('user_id', targetUserId)
    const rows = byUser || []
    if (rows.length === 1) {
      pa = rows[0]
    } else if (rows.length > 1) {
      // Prefer real player accounts over Wild Card placeholders
      pa =
        rows.find((a: any) => !/^wild\s*card/i.test(a.name || '')) ||
        rows[0]
    }
  }

  if (!pa) return null

  const phone = pa.phone_number
  const playerName = pa.name

  // 2) Fetch follow counts + followingIds in parallel
  const [followingCount, followersCount, followingIds] = await Promise.all([
    getFollowingCount(targetUserId),
    getFollowersCount(targetUserId),
    getFollowingIds(myUserId),
  ])

  // 3) Find this player's entries in the 'players' table
  //    Same approach as playerDashboardData.ts: account_id first, then fallbacks for unlinked records
  const [playersByAccountId, playersByPhone, playersByName] = await Promise.all([
    pa.id
      ? supabase.from('players').select('id, tournament_id').eq('player_account_id', pa.id)
      : { data: [] },
    phone
      ? supabase.from('players').select('id, tournament_id').eq('phone_number', phone).is('player_account_id', null)
      : { data: [] },
    playerName
      ? supabase.from('players').select('id, tournament_id').ilike('name', playerName).is('player_account_id', null)
      : { data: [] },
  ])

  const allPlayersMap = new Map<string, { id: string; tournament_id: string | null }>()
  ;[...(playersByAccountId.data || []), ...(playersByPhone.data || []), ...(playersByName.data || [])].forEach((p: any) => {
    allPlayersMap.set(p.id, p)
  })
  const allPlayerEntries = Array.from(allPlayersMap.values())
  const playerIds = allPlayerEntries.map((p) => p.id)

  let recentMatches: ProfileMatch[] = []
  const topPlayersMap = new Map<string, number>()

  if (playerIds.length > 0) {
    // 4) Find all teams this player belongs to
    const playerConditions = playerIds.map((id) => `player1_id.eq.${id},player2_id.eq.${id}`).join(',')
    const { data: teamsData } = await supabase
      .from('teams')
      .select('id')
      .or(playerConditions)
    const teamIds = (teamsData || []).map((t: any) => t.id)

    // 5) Build match query conditions (teams + individual matches)
    const teamMatchConditions = teamIds.length > 0
      ? `team1_id.in.(${teamIds.join(',')}),team2_id.in.(${teamIds.join(',')})`
      : ''
    const pids = playerIds.join(',')
    const individualMatchConditions = playerIds.length > 0
      ? `player1_individual_id.in.(${pids}),player2_individual_id.in.(${pids}),player3_individual_id.in.(${pids}),player4_individual_id.in.(${pids})`
      : ''
    const allConditions = [teamMatchConditions, individualMatchConditions].filter(c => c.length > 0).join(',')

    if (allConditions) {
      // 6) Fetch matches with JOINs (same as playerDashboardData.ts)
      const { data: matchesData } = await supabase
        .from('matches')
        .select(`
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
        `)
        .or(allConditions)
        .order('scheduled_time', { ascending: false })

      if (matchesData) {
        const teamIdSet = new Set(teamIds)
        const playerIdSet = new Set(playerIds)

        // Resolve nomes reais via RPC (bypassa RLS) + player_accounts
        const teamIdsFromMatches = new Set<string>()
        const individualPlayersForNames: Array<{ id?: string | null; name?: string | null }> = []
        for (const m of matchesData as any[]) {
          if (m.team1_id) teamIdsFromMatches.add(m.team1_id)
          if (m.team2_id) teamIdsFromMatches.add(m.team2_id)
          if (m.p1) individualPlayersForNames.push(m.p1)
          if (m.p2) individualPlayersForNames.push(m.p2)
          if (m.p3) individualPlayersForNames.push(m.p3)
          if (m.p4) individualPlayersForNames.push(m.p4)
        }
        const [teamPlayerNamesMap, individualNamesMap] = await Promise.all([
          resolveTeamPlayerNamesMap(teamIdsFromMatches),
          resolveIndividualPlayerNames(individualPlayersForNames),
        ])

        for (const m of (matchesData as any[])) {
          if (m.status !== 'completed') continue

          const isIndividual = m.p1 || m.p2 || m.p3 || m.p4

          const team1Players = m.team1_id ? teamPlayerNamesMap.get(m.team1_id) : null
          const team2Players = m.team2_id ? teamPlayerNamesMap.get(m.team2_id) : null
          const r1 = m.p1?.id ? individualNamesMap.get(m.p1.id) : null
          const r2 = m.p2?.id ? individualNamesMap.get(m.p2.id) : null
          const r3 = m.p3?.id ? individualNamesMap.get(m.p3.id) : null
          const r4 = m.p4?.id ? individualNamesMap.get(m.p4.id) : null

          const p1Name = isIndividual ? (r1?.name || m.p1?.name) : (team1Players?.player1_name || (m.team1 as any)?.t1p1?.name)
          const p2Name = isIndividual ? (r2?.name || m.p2?.name) : (team1Players?.player2_name || (m.team1 as any)?.t1p2?.name)
          const p3Name = isIndividual ? (r3?.name || m.p3?.name) : (team2Players?.player1_name || (m.team2 as any)?.t2p1?.name)
          const p4Name = isIndividual ? (r4?.name || m.p4?.name) : (team2Players?.player2_name || (m.team2 as any)?.t2p2?.name)
          const p1Avatar = isIndividual ? (r1?.avatar_url ?? null) : (team1Players?.player1_avatar ?? null)
          const p2Avatar = isIndividual ? (r2?.avatar_url ?? null) : (team1Players?.player2_avatar ?? null)
          const p3Avatar = isIndividual ? (r3?.avatar_url ?? null) : (team2Players?.player1_avatar ?? null)
          const p4Avatar = isIndividual ? (r4?.avatar_url ?? null) : (team2Players?.player2_avatar ?? null)

          const team1Name = isIndividual
            ? `${p1Name || 'TBD'}${p2Name ? ' / ' + p2Name : ''}`
            : m.team1?.name || 'TBD'
          const team2Name = isIndividual
            ? `${p3Name || 'TBD'}${p4Name ? ' / ' + p4Name : ''}`
            : m.team2?.name || 'TBD'

          // Set scores — equal games (e.g. 5-5) count as played, neither side wins the set
          const setPairs: Array<[number, number]> = [
            [m.team1_score_set1 || 0, m.team2_score_set1 || 0],
            [m.team1_score_set2 || 0, m.team2_score_set2 || 0],
            [m.team1_score_set3 || 0, m.team2_score_set3 || 0],
          ]
          let team1Sets = 0
          let team2Sets = 0
          let hasPlayedSets = false
          for (const [a, b] of setPairs) {
            if (a === 0 && b === 0) continue
            hasPlayedSets = true
            if (a > b) team1Sets++
            else if (b > a) team2Sets++
          }

          const isPlayerInTeam1 = isIndividual
            ? playerIdSet.has(m.p1?.id) || playerIdSet.has(m.p2?.id)
            : teamIdSet.has(m.team1?.id)

          const isWinner = !hasPlayedSets
            ? undefined
            : team1Sets === team2Sets
              ? null
              : isPlayerInTeam1
                ? team1Sets > team2Sets
                : team2Sets > team1Sets

          // Build set strings
          const set1 = (m.team1_score_set1 != null && m.team2_score_set1 != null)
            ? `${m.team1_score_set1}-${m.team2_score_set1}` : undefined
          const set2 = (m.team1_score_set2 != null && m.team2_score_set2 != null && (m.team1_score_set2 > 0 || m.team2_score_set2 > 0))
            ? `${m.team1_score_set2}-${m.team2_score_set2}` : undefined
          const set3 = (m.team1_score_set3 != null && m.team2_score_set3 != null && (m.team1_score_set3 > 0 || m.team2_score_set3 > 0))
            ? `${m.team1_score_set3}-${m.team2_score_set3}` : undefined

          // Reorder so the target player's team is always "team 1" (my team)
          recentMatches.push({
            id: m.id,
            tournament_id: m.tournament_id,
            tournament_name: (m.tournaments as any)?.name || '',
            team1_name: isPlayerInTeam1 ? team1Name : team2Name,
            team2_name: isPlayerInTeam1 ? team2Name : team1Name,
            player1_name: isPlayerInTeam1 ? p1Name : p3Name,
            player2_name: isPlayerInTeam1 ? p2Name : p4Name,
            player3_name: isPlayerInTeam1 ? p3Name : p1Name,
            player4_name: isPlayerInTeam1 ? p4Name : p2Name,
            player1_avatar: isPlayerInTeam1 ? p1Avatar : p3Avatar,
            player2_avatar: isPlayerInTeam1 ? p2Avatar : p4Avatar,
            player3_avatar: isPlayerInTeam1 ? p3Avatar : p1Avatar,
            player4_avatar: isPlayerInTeam1 ? p4Avatar : p2Avatar,
            my_side: 1,
            score1: isPlayerInTeam1 ? team1Sets : team2Sets,
            score2: isPlayerInTeam1 ? team2Sets : team1Sets,
            set1: isPlayerInTeam1 ? set1 : (set1 ? set1.split('-').reverse().join('-') : undefined),
            set2: isPlayerInTeam1 ? set2 : (set2 ? set2.split('-').reverse().join('-') : undefined),
            set3: isPlayerInTeam1 ? set3 : (set3 ? set3.split('-').reverse().join('-') : undefined),
            is_winner: isWinner,
            played_at: m.scheduled_time,
          } as any)

          // Count partners only (same team)
          getPartnerNamesFromMatch(
            {
              team1_name: isPlayerInTeam1 ? team1Name : team2Name,
              team2_name: isPlayerInTeam1 ? team2Name : team1Name,
              player1_name: isPlayerInTeam1 ? p1Name : p3Name,
              player2_name: isPlayerInTeam1 ? p2Name : p4Name,
              player3_name: isPlayerInTeam1 ? p3Name : p1Name,
              player4_name: isPlayerInTeam1 ? p4Name : p2Name,
              my_side: 1,
            },
            playerName,
          ).forEach((n) => topPlayersMap.set(n, (topPlayersMap.get(n) || 0) + 1))
        }
      }
    }
  }

  // 7) Fetch open game results (quick results + normal confirmed results)
  const { data: ogPlayers } = await supabase
    .from('open_game_players')
    .select('game_id')
    .eq('player_account_id', pa.id)
    .eq('status', 'confirmed')

  if (ogPlayers && ogPlayers.length > 0) {
    const ogGameIds = ogPlayers.map((p: any) => p.game_id)
    const { data: ogResults } = await supabase
      .from('open_game_results')
      .select('game_id, team1_score_set1, team2_score_set1, team1_score_set2, team2_score_set2, team1_score_set3, team2_score_set3, status')
      .in('game_id', ogGameIds)
      .eq('status', 'confirmed')

    if (ogResults && ogResults.length > 0) {
      const ogResultGameIds = ogResults.map((r: any) => r.game_id)
      const { data: ogGames } = await supabase
        .from('open_games')
        .select('id, scheduled_at, club_id')
        .in('id', ogResultGameIds)

      const { data: ogAllPlayers } = await supabase
        .from('open_game_players')
        .select('game_id, player_account_id, position, status')
        .in('game_id', ogResultGameIds)
        .eq('status', 'confirmed')

      const ogPaIds = [...new Set((ogAllPlayers || []).map((p: any) => p.player_account_id).filter(Boolean))]
      const { data: ogAccounts } = ogPaIds.length > 0
        ? await supabase.from('player_accounts').select('id, name, avatar_url').in('id', ogPaIds)
        : { data: [] }
      const ogAccountMap = new Map((ogAccounts || []).map((a: any) => [a.id, { name: a.name as string, avatar_url: a.avatar_url as string | null }]))

      const ogClubIds = [...new Set((ogGames || []).map((g: any) => g.club_id).filter(Boolean))]
      const { data: ogClubs } = ogClubIds.length > 0
        ? await supabase.from('clubs').select('id, name').in('id', ogClubIds)
        : { data: [] }
      const ogClubMap = new Map((ogClubs || []).map((c: any) => [c.id, c.name]))

      for (const result of ogResults) {
        const game = (ogGames || []).find((g: any) => g.id === result.game_id)
        if (!game) continue

        const gamePlayers = (ogAllPlayers || [])
          .filter((p: any) => p.game_id === result.game_id)
          .sort((a: any, b: any) => a.position - b.position)
        if (gamePlayers.length < 4) continue

        const getInfo = (paId: string) => ogAccountMap.get(paId) || { name: '?', avatar_url: null }
        const i1 = getInfo(gamePlayers[0].player_account_id)
        const i2 = getInfo(gamePlayers[1].player_account_id)
        const i3 = getInfo(gamePlayers[2].player_account_id)
        const i4 = getInfo(gamePlayers[3].player_account_id)
        const p1Name = i1.name
        const p2Name = i2.name
        const p3Name = i3.name
        const p4Name = i4.name

        const isInTeam1 = gamePlayers[0].player_account_id === pa.id || gamePlayers[1].player_account_id === pa.id

        const s1 = `${result.team1_score_set1 ?? 0}-${result.team2_score_set1 ?? 0}`
        const s2 = (result.team1_score_set2 > 0 || result.team2_score_set2 > 0)
          ? `${result.team1_score_set2}-${result.team2_score_set2}` : undefined
        const s3 = (result.team1_score_set3 > 0 || result.team2_score_set3 > 0)
          ? `${result.team1_score_set3}-${result.team2_score_set3}` : undefined

        const t1Sets = [(result.team1_score_set1 ?? 0) > (result.team2_score_set1 ?? 0) ? 1 : 0,
          (result.team1_score_set2 ?? 0) > (result.team2_score_set2 ?? 0) ? 1 : 0,
          (result.team1_score_set3 ?? 0) > (result.team2_score_set3 ?? 0) ? 1 : 0].reduce((a, b) => a + b, 0)
        const t2Sets = [(result.team2_score_set1 ?? 0) > (result.team1_score_set1 ?? 0) ? 1 : 0,
          (result.team2_score_set2 ?? 0) > (result.team1_score_set2 ?? 0) ? 1 : 0,
          (result.team2_score_set3 ?? 0) > (result.team1_score_set3 ?? 0) ? 1 : 0].reduce((a, b) => a + b, 0)

        const hasPlayed =
          ((result.team1_score_set1 ?? 0) + (result.team2_score_set1 ?? 0) > 0) ||
          ((result.team1_score_set2 ?? 0) + (result.team2_score_set2 ?? 0) > 0) ||
          ((result.team1_score_set3 ?? 0) + (result.team2_score_set3 ?? 0) > 0)
        const isWinner = !hasPlayed
          ? undefined
          : t1Sets === t2Sets
            ? null
            : isInTeam1
              ? t1Sets > t2Sets
              : t2Sets > t1Sets
        const clubName = ogClubMap.get(game.club_id) || ''

        recentMatches.push({
          id: result.game_id,
          tournament_id: null as any,
          tournament_name: clubName,
          team1_name: isInTeam1 ? `${p1Name} / ${p2Name}` : `${p3Name} / ${p4Name}`,
          team2_name: isInTeam1 ? `${p3Name} / ${p4Name}` : `${p1Name} / ${p2Name}`,
          player1_name: isInTeam1 ? p1Name : p3Name,
          player2_name: isInTeam1 ? p2Name : p4Name,
          player3_name: isInTeam1 ? p3Name : p1Name,
          player4_name: isInTeam1 ? p4Name : p2Name,
          player1_avatar: isInTeam1 ? i1.avatar_url : i3.avatar_url,
          player2_avatar: isInTeam1 ? i2.avatar_url : i4.avatar_url,
          player3_avatar: isInTeam1 ? i3.avatar_url : i1.avatar_url,
          player4_avatar: isInTeam1 ? i4.avatar_url : i2.avatar_url,
          my_side: 1,
          score1: isInTeam1 ? t1Sets : t2Sets,
          score2: isInTeam1 ? t2Sets : t1Sets,
          set1: isInTeam1 ? s1 : s1.split('-').reverse().join('-'),
          set2: isInTeam1 && s2 ? s2 : (s2 ? s2.split('-').reverse().join('-') : undefined),
          set3: isInTeam1 && s3 ? s3 : (s3 ? s3.split('-').reverse().join('-') : undefined),
          is_winner: isWinner,
          played_at: game.scheduled_at,
          is_open_game: true,
        } as any)

        getPartnerNamesFromMatch(
          {
            team1_name: isInTeam1 ? `${p1Name} / ${p2Name}` : `${p3Name} / ${p4Name}`,
            team2_name: isInTeam1 ? `${p3Name} / ${p4Name}` : `${p1Name} / ${p2Name}`,
            player1_name: isInTeam1 ? p1Name : p3Name,
            player2_name: isInTeam1 ? p2Name : p4Name,
            player3_name: isInTeam1 ? p3Name : p1Name,
            player4_name: isInTeam1 ? p4Name : p2Name,
            my_side: 1,
          },
          playerName,
        ).forEach((n) => topPlayersMap.set(n, (topPlayersMap.get(n) || 0) + 1))
      }

      recentMatches.sort((a, b) => new Date(b.played_at || 0).getTime() - new Date(a.played_at || 0).getTime())
    }
  }

  // Build topPlayers — only real person names
  const topPlayers: TopPlayer[] = Array.from(topPlayersMap.entries())
    .filter(([name]) => name && !isLikelyTeamLabel(name) && name !== '?')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  // Fetch favorite club
  let favoriteClub: FavoriteClub | null = null
  if (pa.favorite_club_id) {
    const { data: club } = await supabase
      .from('clubs')
      .select('id, name, logo_url')
      .eq('id', pa.favorite_club_id)
      .single()
    if (club) {
      favoriteClub = { id: club.id, name: club.name, logo_url: club.logo_url }
    }
  }

  // Always recompute W/D/L from loaded matches so draws (e.g. American 5-5) are correct.
  // player_accounts.wins/losses can lag behind until the owner opens their dashboard.
  let finalWins = 0
  let finalDraws = 0
  let finalLosses = 0
  for (const m of recentMatches) {
    if (m.is_winner === true) finalWins++
    else if (m.is_winner === false) finalLosses++
    else if (m.is_winner === null) finalDraws++
  }
  // Fallback to stored counters only when we could not load any completed results
  if (recentMatches.length === 0) {
    finalWins = pa.wins ?? 0
    finalLosses = pa.losses ?? 0
  }

  return {
    id: pa.id,
    user_id: pa.user_id,
    name: pa.name,
    avatar_url: pa.avatar_url,
    level: pa.level ?? undefined,
    level_reliability_percent: pa.level_reliability_percent ?? undefined,
    player_category: pa.player_category || undefined,
    location: pa.location,
    bio: pa.bio || undefined,
    preferred_hand: pa.preferred_hand || undefined,
    court_position: pa.court_position || undefined,
    game_type: pa.game_type || undefined,
    preferred_time: pa.preferred_time || undefined,
    birth_date: pa.birth_date || undefined,
    wins: finalWins,
    draws: finalDraws,
    losses: finalLosses,
    points: pa.points ?? 0,
    favorite_club_id: pa.favorite_club_id || undefined,
    followingCount,
    followersCount,
    isFollowedByMe: followingIds.includes(targetUserId),
    recentMatches: recentMatches.slice(0, 5),
    topPlayers,
    favoriteClub,
  }
}

// ============================================
// Search Players
// ============================================

export async function searchPlayers(query: string, excludeIds: string[] = []): Promise<CommunityPlayer[]> {
  if (!query || query.trim().length < 2) return []

  const { data, error } = await supabase
    .rpc('search_players_unaccent', { search_query: query.trim() })

  if (error) console.error('[Community] searchPlayers error:', error)
  if (!data) return []

  const seen = new Set<string>()
  const results: CommunityPlayer[] = []
  for (const p of data) {
    if (!p.user_id) continue
    if (excludeIds.includes(p.user_id) || seen.has(p.user_id) || isTestPlayer(p.name)) continue
    seen.add(p.user_id)
    results.push({
      id: p.id,
      user_id: p.user_id,
      name: p.name,
      avatar_url: p.avatar_url,
      level: p.level ?? undefined,
      player_category: p.player_category || undefined,
      location: p.location,
    })
  }
  return results
}
