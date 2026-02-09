import { supabase } from './supabase'

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

// ============================================
// Suggested Players
// ============================================

export async function getSuggestedPlayers(userId: string): Promise<CommunityPlayer[]> {
  // Get who I already follow
  const followingIds = await getFollowingIds(userId)
  const excludeIds = new Set([...followingIds, userId])

  // Get all player accounts that have a user_id (registered users)
  const { data: allPlayers } = await supabase
    .from('player_accounts')
    .select('id, user_id, name, avatar_url, level, player_category, location')
    .not('user_id', 'is', null)
    .limit(50)

  if (!allPlayers) return []

  // Filter out already followed and self
  const suggestions = allPlayers
    .filter((p: any) => p.user_id && !excludeIds.has(p.user_id))
    .map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      name: p.name,
      avatar_url: p.avatar_url,
      level: p.level,
      player_category: p.player_category,
      location: p.location,
      is_following: false,
    }))

  return suggestions.slice(0, 20)
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
    .select('user_id, name, avatar_url, level')
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
      level: acct?.level,
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
// Search Players (for adding to groups, etc.)
// ============================================

export async function searchPlayers(query: string, excludeIds: string[] = []): Promise<CommunityPlayer[]> {
  if (!query || query.trim().length < 2) return []

  const { data } = await supabase
    .from('player_accounts')
    .select('id, user_id, name, avatar_url, level, player_category, location')
    .ilike('name', `%${query.trim()}%`)
    .not('user_id', 'is', null)
    .limit(20)

  if (!data) return []

  return data
    .filter((p: any) => p.user_id && !excludeIds.includes(p.user_id))
    .map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      name: p.name,
      avatar_url: p.avatar_url,
      level: p.level,
      player_category: p.player_category,
      location: p.location,
    }))
}
