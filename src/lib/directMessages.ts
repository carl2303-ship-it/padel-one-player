import { supabase } from './supabase'
import { sendPushToPlayer } from './pushNotifications'

export interface DmConversation {
  id: string
  otherUserId: string
  otherName: string
  otherAvatar?: string | null
  otherLevel?: number | null
  lastMessagePreview: string | null
  lastMessageAt: string
  unreadCount: number
}

export interface DirectMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string | null
  image_url: string | null
  created_at: string
  read_at: string | null
  is_mine: boolean
}

function pairUsers(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

/** Abre ou reutiliza conversa 1:1 entre o user actual e o outro membro. */
export async function getOrCreateConversation(
  myUserId: string,
  otherUserId: string
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
  if (!myUserId || !otherUserId || myUserId === otherUserId) {
    return { success: false, error: 'Destinatário inválido' }
  }

  const [user_a, user_b] = pairUsers(myUserId, otherUserId)

  const { data: existing, error: findErr } = await supabase
    .from('direct_conversations')
    .select('id')
    .eq('user_a', user_a)
    .eq('user_b', user_b)
    .maybeSingle()

  if (findErr) {
    console.error('[DM] find conversation:', findErr)
    return { success: false, error: findErr.message }
  }
  if (existing?.id) return { success: true, conversationId: existing.id }

  const { data: created, error: createErr } = await supabase
    .from('direct_conversations')
    .insert({ user_a, user_b })
    .select('id')
    .single()

  if (createErr) {
    // Race: outra sessão criou entretanto
    const { data: again } = await supabase
      .from('direct_conversations')
      .select('id')
      .eq('user_a', user_a)
      .eq('user_b', user_b)
      .maybeSingle()
    if (again?.id) return { success: true, conversationId: again.id }
    console.error('[DM] create conversation:', createErr)
    return { success: false, error: createErr.message }
  }

  return { success: true, conversationId: created.id }
}

export async function getMyConversations(myUserId: string): Promise<DmConversation[]> {
  const { data: rows, error } = await supabase
    .from('direct_conversations')
    .select('id, user_a, user_b, last_message_at, last_message_preview, created_at')
    .or(`user_a.eq.${myUserId},user_b.eq.${myUserId}`)
    .order('last_message_at', { ascending: false })

  if (error) {
    console.error('[DM] list conversations:', error)
    return []
  }
  if (!rows?.length) return []

  const otherIds = rows.map((r) => (r.user_a === myUserId ? r.user_b : r.user_a))
  const conversationIds = rows.map((r) => r.id)

  const [{ data: players }, { data: unreadRows }] = await Promise.all([
    supabase
      .from('player_accounts')
      .select('user_id, name, avatar_url, level')
      .in('user_id', otherIds),
    supabase
      .from('direct_messages')
      .select('conversation_id')
      .in('conversation_id', conversationIds)
      .neq('sender_id', myUserId)
      .is('read_at', null),
  ])

  const playerMap = new Map((players || []).map((p) => [p.user_id, p]))
  const unreadMap = new Map<string, number>()
  ;(unreadRows || []).forEach((u) => {
    unreadMap.set(u.conversation_id, (unreadMap.get(u.conversation_id) || 0) + 1)
  })

  return rows.map((r) => {
    const otherUserId = r.user_a === myUserId ? r.user_b : r.user_a
    const p = playerMap.get(otherUserId)
    return {
      id: r.id,
      otherUserId,
      otherName: p?.name || 'Jogador',
      otherAvatar: p?.avatar_url || null,
      otherLevel: p?.level ?? null,
      lastMessagePreview: r.last_message_preview,
      lastMessageAt: r.last_message_at || r.created_at || new Date().toISOString(),
      unreadCount: unreadMap.get(r.id) || 0,
    }
  })
}

export async function getConversationMessages(
  conversationId: string,
  myUserId: string,
  opts?: { limit?: number; before?: string }
): Promise<DirectMessage[]> {
  let query = supabase
    .from('direct_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(opts?.limit || 50)

  if (opts?.before) {
    query = query.lt('created_at', opts.before)
  }

  const { data, error } = await query
  if (error) {
    console.error('[DM] get messages:', error)
    return []
  }

  return (data || []).map((m) => ({
    id: m.id,
    conversation_id: m.conversation_id,
    sender_id: m.sender_id,
    content: m.content,
    image_url: m.image_url,
    created_at: m.created_at,
    read_at: m.read_at,
    is_mine: m.sender_id === myUserId,
  }))
}

export async function sendDirectMessage(params: {
  conversationId: string
  senderId: string
  content?: string
  imageUrl?: string
  recipientUserId: string
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const content = params.content?.trim() || null
  if (!content && !params.imageUrl) {
    return { success: false, error: 'Mensagem vazia' }
  }

  const { data, error } = await supabase
    .from('direct_messages')
    .insert({
      conversation_id: params.conversationId,
      sender_id: params.senderId,
      content,
      image_url: params.imageUrl || null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[DM] send:', error)
    return { success: false, error: error.message }
  }

  const preview = content
    ? content.length > 80
      ? `${content.slice(0, 80)}…`
      : content
    : '📷 Imagem'

  await supabase
    .from('direct_conversations')
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: preview,
    })
    .eq('id', params.conversationId)

  // Push opcional ao destinatário
  try {
    const [{ data: sender }, { data: recipient }] = await Promise.all([
      supabase.from('player_accounts').select('name').eq('user_id', params.senderId).maybeSingle(),
      supabase.from('player_accounts').select('id').eq('user_id', params.recipientUserId).maybeSingle(),
    ])
    if (recipient?.id) {
      sendPushToPlayer(recipient.id, {
        title: 'Nova mensagem',
        body: `${sender?.name || 'Alguém'}: ${preview}`,
        url: '/?screen=messages',
        tag: `dm-${params.conversationId}`,
      })
    }
  } catch {
    /* push best-effort */
  }

  return { success: true, messageId: data.id }
}

export async function markConversationRead(
  conversationId: string,
  myUserId: string
): Promise<void> {
  const { error } = await supabase
    .from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', myUserId)
    .is('read_at', null)

  if (error) console.error('[DM] mark read:', error)
}

export async function uploadDmImage(file: File, userId: string): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `dms/${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('community').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) {
    console.error('[DM] image upload:', error)
    return null
  }
  const { data } = supabase.storage.from('community').getPublicUrl(path)
  return data?.publicUrl || null
}

export function subscribeToConversation(
  conversationId: string,
  onInsert: (msg: DirectMessage, myUserId: string) => void,
  myUserId: string
) {
  const channel = supabase
    .channel(`dm-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const m = payload.new as any
        onInsert(
          {
            id: m.id,
            conversation_id: m.conversation_id,
            sender_id: m.sender_id,
            content: m.content,
            image_url: m.image_url,
            created_at: m.created_at,
            read_at: m.read_at,
            is_mine: m.sender_id === myUserId,
          },
          myUserId
        )
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
