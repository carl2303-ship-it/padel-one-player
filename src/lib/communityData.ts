import { supabase } from './supabase'

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
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/** Cores oficiais por categoria - retorna classes Tailwind + hex para inline styles */
export function categoryColors(category?: string | null): { bg: string; text: string; border: string; hex: string; hexTo: string } {
  switch (category) {
    // Masculino - do mais forte ao mais fraco
    case 'M1': return { bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-600', hex: '#9333ea', hexTo: '#7e22ce' }
    case 'M2': return { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-600', hex: '#2563eb', hexTo: '#1d4ed8' }
    case 'M3': return { bg: 'bg-green-600', text: 'text-white', border: 'border-green-600', hex: '#16a34a', hexTo: '#15803d' }
    case 'M4': return { bg: 'bg-yellow-500', text: 'text-white', border: 'border-yellow-500', hex: '#eab308', hexTo: '#ca8a04' }
    case 'M5': return { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-500', hex: '#f97316', hexTo: '#ea580c' }
    case 'M6': return { bg: 'bg-gray-500', text: 'text-white', border: 'border-gray-500', hex: '#6b7280', hexTo: '#4b5563' }
    // Feminino - mesma escala de cores
    case 'F1': return { bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-500', hex: '#a855f7', hexTo: '#9333ea' }
    case 'F2': return { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-500', hex: '#3b82f6', hexTo: '#2563eb' }
    case 'F3': return { bg: 'bg-green-500', text: 'text-white', border: 'border-green-500', hex: '#22c55e', hexTo: '#16a34a' }
    case 'F4': return { bg: 'bg-yellow-400', text: 'text-white', border: 'border-yellow-400', hex: '#facc15', hexTo: '#eab308' }
    case 'F5': return { bg: 'bg-orange-400', text: 'text-white', border: 'border-orange-400', hex: '#fb923c', hexTo: '#f97316' }
    case 'F6': return { bg: 'bg-gray-400', text: 'text-white', border: 'border-gray-400', hex: '#9ca3af', hexTo: '#6b7280' }
    default:   return { bg: 'bg-gray-200', text: 'text-gray-600', border: 'border-gray-200', hex: '#e5e7eb', hexTo: '#d1d5db' }
  }
}

/** Deriva o nível (1-6) a partir da player_category (M1-M6 / F1-F6) */
export function categoryToLevel(category?: string | null): number | undefined {
  if (!category) return undefined
  const num = parseInt(category.charAt(category.length - 1))
  if (isNaN(num) || num < 1 || num > 6) return undefined
  // M1/F1 = nível 6, M2/F2 = 5, ..., M6/F6 = 1
  return 7 - num
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

export interface CommunityGroup {
  id: string
  name: string
  description: string | null
  image_url: string | null
  created_by: string
  created_at: string
  member_count?: number
  is_member?: boolean
  is_admin?: boolean
}

export interface GroupMember {
  id: string
  user_id: string
  role: string
  joined_at: string
  name?: string
  avatar_url?: string
  level?: number
  player_category?: string
}

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
      level: p.level ?? categoryToLevel(p.player_category) ?? undefined,
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
      level: p.level ?? categoryToLevel(p.player_category) ?? undefined,
      player_category: p.player_category || undefined,
      location: p.location,
      is_following: myFollowingSet.has(p.user_id),
    }))
}

// ============================================
// Suggested Players
// ============================================

export async function getSuggestedPlayers(userId: string): Promise<CommunityPlayer[]> {
  // Get who I already follow
  const followingIds = await getFollowingIds(userId)
  const excludeIds = new Set([...followingIds, userId])

  // player_accounts is the single source of truth for player data + category
  const { data: allPlayers } = await supabase
    .from('player_accounts')
    .select('id, user_id, name, avatar_url, level, player_category, location')
    .not('user_id', 'is', null)
    .limit(50)

  if (!allPlayers) return []

  return allPlayers
    .filter((p: any) => p.user_id && !excludeIds.has(p.user_id) && !isTestPlayer(p.name))
    .map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      name: p.name,
      avatar_url: p.avatar_url,
      level: p.level ?? categoryToLevel(p.player_category) ?? undefined,
      player_category: p.player_category || undefined,
      location: p.location,
      is_following: false,
    }))
    .slice(0, 20)
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
      author_name: author?.name || 'Jogador',
      author_avatar: author?.avatar_url,
      author_level: author?.level,
    }
  })
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
// Groups
// ============================================

export async function getMyGroups(userId: string): Promise<CommunityGroup[]> {
  // Get groups where I'm a member
  const { data: memberships } = await supabase
    .from('community_group_members')
    .select('group_id, role')
    .eq('user_id', userId)

  if (!memberships || memberships.length === 0) return []

  const groupIds = memberships.map((m: any) => m.group_id)
  const roleMap = new Map<string, string>()
  memberships.forEach((m: any) => roleMap.set(m.group_id, m.role))

  const { data: groups } = await supabase
    .from('community_groups')
    .select('*')
    .in('id', groupIds)
    .order('created_at', { ascending: false })

  if (!groups) return []

  // Get member counts
  const result: CommunityGroup[] = []
  for (const g of groups) {
    const { count } = await supabase
      .from('community_group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', g.id)

    result.push({
      ...g,
      member_count: count || 0,
      is_member: true,
      is_admin: roleMap.get(g.id) === 'admin',
    })
  }

  return result
}

export async function createGroup(
  name: string,
  description: string,
  createdBy: string,
  imageFile?: File
): Promise<string | null> {
  let image_url: string | null = null

  if (imageFile) {
    const ext = imageFile.name.split('.').pop()
    const path = `groups/${createdBy}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('community')
      .upload(path, imageFile, { upsert: true })
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('community').getPublicUrl(path)
      image_url = urlData.publicUrl
    }
  }

  const { data, error } = await supabase
    .from('community_groups')
    .insert({
      name,
      description: description || null,
      image_url,
      created_by: createdBy,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[Community] Error creating group:', error)
    return null
  }

  // Add creator as admin member
  await supabase
    .from('community_group_members')
    .insert({
      group_id: data.id,
      user_id: createdBy,
      role: 'admin',
    })

  return data.id
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data: members } = await supabase
    .from('community_group_members')
    .select('id, user_id, role, joined_at')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })

  if (!members || members.length === 0) return []

  const userIds = members.map((m: any) => m.user_id)
  const { data: accounts } = await supabase
    .from('player_accounts')
    .select('user_id, name, avatar_url, level, player_category')
    .in('user_id', userIds)

  const accountMap = new Map<string, any>()
  if (accounts) {
    accounts.forEach((a: any) => accountMap.set(a.user_id, a))
  }

  return members.map((m: any) => {
    const acct = accountMap.get(m.user_id)
    return {
      ...m,
      name: acct?.name || 'Jogador',
      avatar_url: acct?.avatar_url,
      level: acct?.level ?? categoryToLevel(acct?.player_category),
      player_category: acct?.player_category || undefined,
    }
  })
}

export async function addGroupMember(groupId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('community_group_members')
    .insert({ group_id: groupId, user_id: userId, role: 'member' })
  if (error) {
    console.error('[Community] Error adding member:', error)
    return false
  }
  return true
}

export async function removeGroupMember(groupId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('community_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
  if (error) {
    console.error('[Community] Error removing member:', error)
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
  is_winner: boolean
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

export async function getPlayerProfile(targetUserId: string, myUserId: string): Promise<PlayerProfile | null> {
  // 1) Fetch player_accounts data
  const { data: pa } = await supabase
    .from('player_accounts')
    .select('id, user_id, name, avatar_url, level, level_reliability_percent, player_category, location, bio, preferred_hand, court_position, game_type, preferred_time, birth_date, wins, losses, points, favorite_club_id, phone_number')
    .eq('user_id', targetUserId)
    .limit(1)
    .single()

  if (!pa) return null

  const phone = pa.phone_number
  const playerName = pa.name

  // 2) Fetch follow counts + followingIds in parallel
  const [followingCount, followersCount, followingIds] = await Promise.all([
    getFollowingCount(targetUserId),
    getFollowersCount(targetUserId),
    getFollowingIds(myUserId),
  ])

  // 3) Find this player's entries in the 'players' table by phone OR name
  //    (same approach as playerDashboardData.ts)
  const [playersByPhone, playersByName] = await Promise.all([
    phone
      ? supabase.from('players').select('id, tournament_id').eq('phone_number', phone)
      : { data: [] },
    playerName
      ? supabase.from('players').select('id, tournament_id').ilike('name', playerName)
      : { data: [] },
  ])

  const allPlayersMap = new Map<string, { id: string; tournament_id: string | null }>()
  ;[...(playersByPhone.data || []), ...(playersByName.data || [])].forEach((p: any) => {
    allPlayersMap.set(p.id, p)
  })
  const allPlayerEntries = Array.from(allPlayersMap.values())
  const playerIds = allPlayerEntries.map((p) => p.id)

  let recentMatches: ProfileMatch[] = []
  const topPlayersMap = new Map<string, number>()
  let computedWins = 0
  let computedLosses = 0

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
    const individualMatchConditions = playerIds
      .map((id) => `player1_individual_id.eq.${id},player2_individual_id.eq.${id},player3_individual_id.eq.${id},player4_individual_id.eq.${id}`)
      .join(',')
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

        for (const m of (matchesData as any[])) {
          if (m.status !== 'completed') continue

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

          // Set scores
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

          const isPlayerInTeam1 = isIndividual
            ? playerIdSet.has(m.p1?.id) || playerIdSet.has(m.p2?.id)
            : teamIdSet.has(m.team1?.id)

          const isWinner = isPlayerInTeam1 ? team1Sets > team2Sets : team2Sets > team1Sets
          if (isWinner) computedWins++
          else computedLosses++

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
            score1: isPlayerInTeam1 ? team1Sets : team2Sets,
            score2: isPlayerInTeam1 ? team2Sets : team1Sets,
            set1: isPlayerInTeam1 ? set1 : (set1 ? set1.split('-').reverse().join('-') : undefined),
            set2: isPlayerInTeam1 ? set2 : (set2 ? set2.split('-').reverse().join('-') : undefined),
            set3: isPlayerInTeam1 ? set3 : (set3 ? set3.split('-').reverse().join('-') : undefined),
            is_winner: isWinner,
            played_at: m.scheduled_time,
          })

          // Count other players for topPlayers
          const allNames = [p1Name, p2Name, p3Name, p4Name].filter(n => n && n !== playerName) as string[]
          allNames.forEach(n => topPlayersMap.set(n, (topPlayersMap.get(n) || 0) + 1))
        }
      }
    }
  }

  // Build topPlayers
  const topPlayers: TopPlayer[] = Array.from(topPlayersMap.entries())
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

  // Use computed wins/losses from actual matches if available, otherwise fallback to player_accounts
  const finalWins = computedWins > 0 ? computedWins : (pa.wins ?? 0)
  const finalLosses = computedLosses > 0 ? computedLosses : (pa.losses ?? 0)

  return {
    id: pa.id,
    user_id: pa.user_id,
    name: pa.name,
    avatar_url: pa.avatar_url,
    level: pa.level ?? categoryToLevel(pa.player_category) ?? undefined,
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
// Search Players (for adding to groups, etc.)
// ============================================

export async function searchPlayers(query: string, excludeIds: string[] = []): Promise<CommunityPlayer[]> {
  if (!query || query.trim().length < 2) return []

  const { data, error } = await supabase
    .from('player_accounts')
    .select('id, user_id, name, avatar_url, level, player_category, location')
    .ilike('name', `%${query.trim()}%`)
    .limit(30)

  if (error) console.error('[Community] searchPlayers error:', error)
  if (!data) return []

  // Deduplicate by user_id (some players may have multiple player_accounts)
  const seen = new Set<string>()
  const results: CommunityPlayer[] = []
  for (const p of data) {
    const key = p.user_id || p.id
    if (excludeIds.includes(key) || seen.has(key) || isTestPlayer(p.name)) continue
    seen.add(key)
    results.push({
      id: p.id,
      user_id: p.user_id || p.id,
      name: p.name,
      avatar_url: p.avatar_url,
      level: p.level ?? categoryToLevel(p.player_category) ?? undefined,
      player_category: p.player_category || undefined,
      location: p.location,
    })
  }
  return results
}
