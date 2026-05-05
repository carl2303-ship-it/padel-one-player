import { supabase } from './supabase'

// ============================
// Types
// ============================

export interface ChatMessage {
  id: string
  group_id: string
  user_id: string
  content: string | null
  image_url: string | null
  reply_to_message_id: string | null
  message_type: 'text' | 'image' | 'game' | 'tournament' | 'system'
  metadata: Record<string, any>
  created_at: string
  // Joined fields
  author_name?: string
  author_avatar?: string | null
  // Reply preview
  reply_preview?: {
    content: string | null
    author_name: string
  } | null
  // Reactions aggregated
  reactions?: ReactionGroup[]
}

export interface ReactionGroup {
  emoji: string
  count: number
  users: string[]
  reacted_by_me: boolean
}

// ============================
// Send Message
// ============================

export async function sendMessage(params: {
  groupId: string
  content?: string
  imageUrl?: string
  replyToId?: string
  messageType?: ChatMessage['message_type']
  metadata?: Record<string, any>
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  const { data, error } = await supabase
    .from('community_group_messages')
    .insert({
      group_id: params.groupId,
      user_id: user.id,
      content: params.content || null,
      image_url: params.imageUrl || null,
      reply_to_message_id: params.replyToId || null,
      message_type: params.messageType || 'text',
      metadata: params.metadata || {},
    })
    .select('id')
    .single()

  if (error) {
    console.error('[GroupChat] Error sending message:', error)
    return { success: false, error: error.message }
  }
  return { success: true, messageId: data?.id }
}

// ============================
// Get Messages (paginated)
// ============================

export async function getMessages(params: {
  groupId: string
  limit?: number
  before?: string
}): Promise<ChatMessage[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('community_group_messages')
    .select('*')
    .eq('group_id', params.groupId)
    .order('created_at', { ascending: false })
    .limit(params.limit || 50)

  if (params.before) {
    query = query.lt('created_at', params.before)
  }

  const { data: messages, error } = await query

  if (error) {
    console.error('[GroupChat] Error fetching messages:', error)
    return []
  }
  if (!messages?.length) return []

  const userIds = [...new Set(messages.map(m => m.user_id))]
  const messageIds = messages.map(m => m.id)
  const replyIds = messages
    .map(m => m.reply_to_message_id)
    .filter(Boolean) as string[]

  const [{ data: players }, { data: reactions }, replyData] = await Promise.all([
    supabase.from('player_accounts').select('user_id, name, avatar_url').in('user_id', userIds),
    supabase.from('community_group_message_reactions').select('*').in('message_id', messageIds),
    replyIds.length > 0
      ? supabase.from('community_group_messages').select('id, content, user_id').in('id', replyIds)
      : { data: [] as any[] },
  ])

  const playerMap = new Map((players || []).map(p => [p.user_id, p]))
  const replyMessages = (replyData as any)?.data || replyData || []
  const replyMap = new Map((Array.isArray(replyMessages) ? replyMessages : []).map((r: any) => [r.id, r]))

  const reactionsByMsg = new Map<string, Map<string, { count: number; users: string[] }>>()
  ;(reactions || []).forEach(r => {
    if (!reactionsByMsg.has(r.message_id)) {
      reactionsByMsg.set(r.message_id, new Map())
    }
    const emojiMap = reactionsByMsg.get(r.message_id)!
    if (!emojiMap.has(r.emoji)) {
      emojiMap.set(r.emoji, { count: 0, users: [] })
    }
    const entry = emojiMap.get(r.emoji)!
    entry.count++
    entry.users.push(r.user_id)
  })

  return messages.map(m => {
    const author = playerMap.get(m.user_id)
    const replyMsg = m.reply_to_message_id ? replyMap.get(m.reply_to_message_id) : null
    const replyAuthor = replyMsg ? playerMap.get(replyMsg.user_id) : null

    const msgReactions = reactionsByMsg.get(m.id)
    const reactionGroups: ReactionGroup[] = []
    if (msgReactions) {
      msgReactions.forEach((val, emoji) => {
        reactionGroups.push({
          emoji,
          count: val.count,
          users: val.users,
          reacted_by_me: val.users.includes(user.id),
        })
      })
    }

    return {
      ...m,
      author_name: author?.name || 'Jogador',
      author_avatar: author?.avatar_url || null,
      reply_preview: replyMsg
        ? { content: replyMsg.content, author_name: replyAuthor?.name || 'Jogador' }
        : null,
      reactions: reactionGroups,
    }
  })
}

// ============================
// Reactions
// ============================

export async function addReaction(messageId: string, emoji: string): Promise<{ success: boolean }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const { error } = await supabase
    .from('community_group_message_reactions')
    .insert({ message_id: messageId, user_id: user.id, emoji })

  if (error && error.code !== '23505') {
    console.error('[GroupChat] Error adding reaction:', error)
    return { success: false }
  }
  return { success: true }
}

export async function removeReaction(messageId: string, emoji: string): Promise<{ success: boolean }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const { error } = await supabase
    .from('community_group_message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .eq('emoji', emoji)

  if (error) {
    console.error('[GroupChat] Error removing reaction:', error)
    return { success: false }
  }
  return { success: true }
}

// ============================
// Delete Message
// ============================

export async function deleteMessage(messageId: string): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('community_group_messages')
    .delete()
    .eq('id', messageId)

  if (error) {
    console.error('[GroupChat] Error deleting message:', error)
    return { success: false }
  }
  return { success: true }
}

// ============================
// Upload Chat Image
// ============================

export async function uploadChatImage(file: File): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const ext = file.name.split('.').pop() || 'jpg'
  const path = `chat/${user.id}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('community')
    .upload(path, file, { cacheControl: '3600', upsert: false })

  if (error) {
    console.error('[GroupChat] Error uploading image:', error)
    return null
  }

  const { data: urlData } = supabase.storage
    .from('community')
    .getPublicUrl(path)

  return urlData?.publicUrl || null
}

// ============================
// Realtime Subscription
// ============================

export function subscribeToGroupChat(
  groupId: string,
  callbacks: {
    onNewMessage?: (msg: any) => void
    onDeleteMessage?: (msgId: string) => void
    onNewReaction?: (reaction: any) => void
    onDeleteReaction?: (reaction: any) => void
  }
) {
  const channel = supabase.channel(`group-chat-${groupId}`)

  channel.on(
    'postgres_changes' as any,
    {
      event: 'INSERT',
      schema: 'public',
      table: 'community_group_messages',
      filter: `group_id=eq.${groupId}`,
    },
    (payload: any) => {
      callbacks.onNewMessage?.(payload.new)
    }
  )

  channel.on(
    'postgres_changes' as any,
    {
      event: 'DELETE',
      schema: 'public',
      table: 'community_group_messages',
      filter: `group_id=eq.${groupId}`,
    },
    (payload: any) => {
      callbacks.onDeleteMessage?.(payload.old?.id)
    }
  )

  channel.on(
    'postgres_changes' as any,
    {
      event: 'INSERT',
      schema: 'public',
      table: 'community_group_message_reactions',
    },
    (payload: any) => {
      callbacks.onNewReaction?.(payload.new)
    }
  )

  channel.on(
    'postgres_changes' as any,
    {
      event: 'DELETE',
      schema: 'public',
      table: 'community_group_message_reactions',
    },
    (payload: any) => {
      callbacks.onDeleteReaction?.(payload.old)
    }
  )

  channel.subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
