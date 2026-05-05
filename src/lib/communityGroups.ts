import { supabase } from './supabase'

// ============================
// Types
// ============================

export interface CommunityGroup {
  id: string
  name: string
  description: string | null
  image_url: string | null
  created_by: string
  is_active: boolean
  created_at: string
  member_count?: number
  last_message?: string | null
  last_message_at?: string | null
  my_role?: string
}

export interface GroupMember {
  id: string
  user_id: string
  role: string
  joined_at: string
  name: string
  avatar_url: string | null
  level: number | null
  player_category: string | null
}

export interface GroupInvite {
  id: string
  group_id: string
  invited_by: string
  invited_user_id: string
  status: string
  created_at: string
  group_name?: string
  group_image_url?: string | null
  inviter_name?: string
}

// ============================
// Group CRUD
// ============================

export async function createGroup(params: {
  name: string
  description?: string
  imageUrl?: string
}): Promise<{ success: boolean; groupId?: string; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  const { data: group, error: groupErr } = await supabase
    .from('community_groups')
    .insert({
      name: params.name,
      description: params.description || null,
      image_url: params.imageUrl || null,
      created_by: user.id,
      is_active: true,
    })
    .select('id')
    .single()

  if (groupErr || !group) {
    console.error('[Groups] Error creating group:', groupErr)
    return { success: false, error: groupErr?.message || 'Erro ao criar grupo' }
  }

  const { error: memberErr } = await supabase
    .from('community_group_members')
    .insert({
      group_id: group.id,
      user_id: user.id,
      role: 'admin',
    })

  if (memberErr) {
    console.error('[Groups] Error adding creator as admin:', memberErr)
  }

  return { success: true, groupId: group.id }
}

export async function updateGroup(params: {
  groupId: string
  name?: string
  description?: string
  imageUrl?: string
}): Promise<{ success: boolean; error?: string }> {
  const updates: Record<string, any> = {}
  if (params.name !== undefined) updates.name = params.name
  if (params.description !== undefined) updates.description = params.description
  if (params.imageUrl !== undefined) updates.image_url = params.imageUrl

  const { error } = await supabase
    .from('community_groups')
    .update(updates)
    .eq('id', params.groupId)

  if (error) {
    console.error('[Groups] Error updating group:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function deleteGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('community_groups')
    .delete()
    .eq('id', groupId)

  if (error) {
    console.error('[Groups] Error deleting group:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ============================
// Fetch Groups
// ============================

export async function getMyGroups(userId: string): Promise<CommunityGroup[]> {
  const { data: memberships, error: memErr } = await supabase
    .from('community_group_members')
    .select('group_id, role')
    .eq('user_id', userId)

  if (memErr || !memberships?.length) return []

  const groupIds = memberships.map(m => m.group_id)
  const roleMap = new Map(memberships.map(m => [m.group_id, m.role]))

  const { data: groups, error: grpErr } = await supabase
    .from('community_groups')
    .select('*')
    .in('id', groupIds)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (grpErr || !groups) return []

  const { data: memberCounts } = await supabase
    .from('community_group_members')
    .select('group_id')
    .in('group_id', groupIds)

  const countMap = new Map<string, number>()
  ;(memberCounts || []).forEach(m => {
    countMap.set(m.group_id, (countMap.get(m.group_id) || 0) + 1)
  })

  const { data: lastMessages } = await supabase
    .from('community_group_messages')
    .select('group_id, content, created_at')
    .in('group_id', groupIds)
    .order('created_at', { ascending: false })

  const lastMsgMap = new Map<string, { content: string | null; created_at: string }>()
  ;(lastMessages || []).forEach(m => {
    if (!lastMsgMap.has(m.group_id)) {
      lastMsgMap.set(m.group_id, { content: m.content, created_at: m.created_at })
    }
  })

  return groups.map(g => ({
    ...g,
    member_count: countMap.get(g.id) || 0,
    last_message: lastMsgMap.get(g.id)?.content || null,
    last_message_at: lastMsgMap.get(g.id)?.created_at || null,
    my_role: roleMap.get(g.id) || 'member',
  }))
}

export async function getGroupDetails(groupId: string): Promise<CommunityGroup | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: group } = await supabase
    .from('community_groups')
    .select('*')
    .eq('id', groupId)
    .single()

  if (!group) return null

  const { data: members } = await supabase
    .from('community_group_members')
    .select('user_id, role')
    .eq('group_id', groupId)

  const myMembership = members?.find(m => m.user_id === user.id)

  return {
    ...group,
    member_count: members?.length || 0,
    my_role: myMembership?.role || 'member',
  }
}

// ============================
// Members
// ============================

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data: members, error } = await supabase
    .from('community_group_members')
    .select('id, user_id, role, joined_at')
    .eq('group_id', groupId)
    .order('role', { ascending: true })
    .order('joined_at', { ascending: true })

  if (error || !members?.length) return []

  const userIds = members.map(m => m.user_id)
  const { data: players } = await supabase
    .from('player_accounts')
    .select('user_id, name, avatar_url, level, player_category')
    .in('user_id', userIds)

  const playerMap = new Map(
    (players || []).map(p => [p.user_id, p])
  )

  return members.map(m => {
    const p = playerMap.get(m.user_id)
    return {
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
      name: p?.name || 'Jogador',
      avatar_url: p?.avatar_url || null,
      level: p?.level || null,
      player_category: p?.player_category || null,
    }
  })
}

export async function removeGroupMember(groupId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('community_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function leaveGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  const { error } = await supabase
    .from('community_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================
// Invites
// ============================

export async function inviteToGroup(groupId: string, invitedUserId: string): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  const { data: existing } = await supabase
    .from('community_group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', invitedUserId)
    .maybeSingle()

  if (existing) return { success: false, error: 'Jogador já é membro do grupo' }

  const { data: pendingInvite } = await supabase
    .from('community_group_invites')
    .select('id')
    .eq('group_id', groupId)
    .eq('invited_user_id', invitedUserId)
    .eq('status', 'pending')
    .maybeSingle()

  if (pendingInvite) return { success: false, error: 'Convite já enviado' }

  const { error } = await supabase
    .from('community_group_invites')
    .insert({
      group_id: groupId,
      invited_by: user.id,
      invited_user_id: invitedUserId,
      status: 'pending',
    })

  if (error) {
    console.error('[Groups] Error inviting:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function getMyGroupInvites(userId: string): Promise<GroupInvite[]> {
  const { data: invites, error } = await supabase
    .from('community_group_invites')
    .select('*')
    .eq('invited_user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error || !invites?.length) return []

  const groupIds = [...new Set(invites.map(i => i.group_id))]
  const inviterIds = [...new Set(invites.map(i => i.invited_by))]

  const [{ data: groups }, { data: inviters }] = await Promise.all([
    supabase.from('community_groups').select('id, name, image_url').in('id', groupIds),
    supabase.from('player_accounts').select('user_id, name').in('user_id', inviterIds),
  ])

  const groupMap = new Map((groups || []).map(g => [g.id, g]))
  const inviterMap = new Map((inviters || []).map(p => [p.user_id, p.name]))

  return invites.map(inv => {
    const g = groupMap.get(inv.group_id)
    return {
      ...inv,
      group_name: g?.name || 'Grupo',
      group_image_url: g?.image_url || null,
      inviter_name: inviterMap.get(inv.invited_by) || 'Jogador',
    }
  })
}

export async function respondToGroupInvite(inviteId: string, accept: boolean): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  const { data: invite, error: fetchErr } = await supabase
    .from('community_group_invites')
    .select('*')
    .eq('id', inviteId)
    .single()

  if (fetchErr || !invite) return { success: false, error: 'Convite não encontrado' }

  const { error: updateErr } = await supabase
    .from('community_group_invites')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', inviteId)

  if (updateErr) return { success: false, error: updateErr.message }

  if (accept) {
    const { error: joinErr } = await supabase
      .from('community_group_members')
      .insert({
        group_id: invite.group_id,
        user_id: user.id,
        role: 'member',
      })

    if (joinErr && joinErr.code !== '23505') {
      console.error('[Groups] Error joining after accept:', joinErr)
      return { success: false, error: joinErr.message }
    }
  }

  return { success: true }
}

export async function uploadGroupImage(file: File): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const ext = file.name.split('.').pop() || 'jpg'
  const path = `groups/${user.id}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('community')
    .upload(path, file, { cacheControl: '3600', upsert: false })

  if (error) {
    console.error('[Groups] Error uploading image:', error)
    return null
  }

  const { data: urlData } = supabase.storage
    .from('community')
    .getPublicUrl(path)

  return urlData?.publicUrl || null
}
