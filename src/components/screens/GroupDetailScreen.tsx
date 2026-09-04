import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Settings, Camera, ArrowLeft, X, Send } from 'lucide-react'
import { useI18n } from '../../lib/i18nContext'
import { supabase } from '../../lib/supabase'
import {
  levelColors,
  getInitials,
  searchPlayers,
  type CommunityPlayer,
} from '../../lib/communityData'
import {
  updateGroup,
  deleteGroup,
  getGroupDetails,
  getGroupMembers,
  removeGroupMember,
  leaveGroup,
  inviteToGroup,
  type CommunityGroup,
  type GroupMember,
} from '../../lib/communityGroups'
import {
  sendMessage,
  getMessages,
  addReaction,
  removeReaction,
  deleteMessage,
  uploadChatImage,
  subscribeToGroupChat,
  type ChatMessage,
} from '../../lib/groupChat'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '🏆', '👏']

export default function GroupDetailScreen({
  groupId, userId, playerAccountId: _playerAccountId, playerName, playerAvatar, playerLevel: _playerLevel,
  onBack, onOpenPlayerProfile, onCreateGroupGame,
}: {
  groupId: string
  userId: string
  playerAccountId: string
  playerName?: string
  playerAvatar?: string | null
  playerLevel?: number | null
  onBack: () => void
  onOpenPlayerProfile: (uid: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
  onCreateGroupGame: (groupId: string) => void
}) {
  void _playerAccountId
  void _playerLevel
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'chat' | 'members' | 'games'>('chat')
  const [group, setGroup] = useState<CommunityGroup | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Invite members
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteSearchQuery, setInviteSearchQuery] = useState('')
  const [inviteSearchResults, setInviteSearchResults] = useState<CommunityPlayer[]>([])
  const [inviteSearching, setInviteSearching] = useState(false)
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null)

  // Group games
  const [groupGames, setGroupGames] = useState<import('../../lib/openGames').OpenGame[]>([])
  const [gamesLoading, setGamesLoading] = useState(false)

  // Settings
  const [showSettings, setShowSettings] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const isAdmin = group?.my_role === 'admin'

  useEffect(() => {
    loadGroupData()
    const unsub = subscribeToGroupChat(groupId, {
      onNewMessage: async (raw) => {
        if (raw.user_id === userId) return
        const { data: pa } = await supabase.from('player_accounts').select('name, avatar_url').eq('user_id', raw.user_id).maybeSingle()
        setMessages(prev => [{ ...raw, author_name: pa?.name || 'Jogador', author_avatar: pa?.avatar_url, reactions: [], reply_preview: null }, ...prev])
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      },
      onDeleteMessage: (id) => {
        if (id) setMessages(prev => prev.filter(m => m.id !== id))
      },
      onNewReaction: (r) => {
        if (!r) return
        setMessages(prev => prev.map(m => {
          if (m.id !== r.message_id) return m
          const existing = (m.reactions || []).find(rg => rg.emoji === r.emoji)
          if (existing) {
            return { ...m, reactions: m.reactions!.map(rg => rg.emoji === r.emoji ? { ...rg, count: rg.count + 1, users: [...rg.users, r.user_id], reacted_by_me: rg.reacted_by_me || r.user_id === userId } : rg) }
          }
          return { ...m, reactions: [...(m.reactions || []), { emoji: r.emoji, count: 1, users: [r.user_id], reacted_by_me: r.user_id === userId }] }
        }))
      },
      onDeleteReaction: (r) => {
        if (!r) return
        setMessages(prev => prev.map(m => {
          if (m.id !== r.message_id) return m
          return { ...m, reactions: (m.reactions || []).map(rg => rg.emoji === r.emoji ? { ...rg, count: rg.count - 1, users: rg.users.filter(u => u !== r.user_id), reacted_by_me: rg.reacted_by_me && r.user_id !== userId } : rg).filter(rg => rg.count > 0) }
        }))
      },
    })
    return unsub
  }, [groupId])

  async function loadGroupData() {
    setChatLoading(true)
    const [groupData, msgs, mems] = await Promise.all([
      getGroupDetails(groupId),
      getMessages({ groupId, limit: 50 }),
      getGroupMembers(groupId),
    ])
    setGroup(groupData)
    setMessages(msgs)
    setMembers(mems)
    if (groupData) { setEditName(groupData.name); setEditDesc(groupData.description || '') }
    setChatLoading(false)
  }

  async function handleSendMessage() {
    const text = messageText.trim()
    if (!text && !imageFile) return
    setSendingMsg(true)
    let imgUrl: string | undefined
    if (imageFile) {
      imgUrl = (await uploadChatImage(imageFile)) || undefined
    }
    const result = await sendMessage({
      groupId,
      content: text || undefined,
      imageUrl: imgUrl,
      replyToId: replyTo?.id,
      messageType: imageFile ? 'image' : 'text',
    })
    if (result.success) {
      const { data: pa } = await supabase.from('player_accounts').select('name, avatar_url').eq('user_id', userId).maybeSingle()
      const newMsg: ChatMessage = {
        id: result.messageId!,
        group_id: groupId,
        user_id: userId,
        content: text || null,
        image_url: imgUrl || null,
        reply_to_message_id: replyTo?.id || null,
        message_type: imageFile ? 'image' : 'text',
        metadata: {},
        created_at: new Date().toISOString(),
        author_name: pa?.name || playerName || 'Eu',
        author_avatar: pa?.avatar_url || playerAvatar || null,
        reply_preview: replyTo ? { content: replyTo.content, author_name: replyTo.author_name || '' } : null,
        reactions: [],
      }
      setMessages(prev => [newMsg, ...prev])
      setMessageText('')
      setReplyTo(null)
      setImageFile(null)
      setImagePreview(null)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } else {
      console.error('[GroupChat] Send failed:', result.error)
      alert(result.error || 'Erro ao enviar mensagem')
    }
    setSendingMsg(false)
  }

  async function handleReaction(messageId: string, emoji: string) {
    const msg = messages.find(m => m.id === messageId)
    const existingReaction = msg?.reactions?.find(r => r.emoji === emoji && r.reacted_by_me)
    if (existingReaction) {
      await removeReaction(messageId, emoji)
      setMessages(prev => prev.map(m => m.id !== messageId ? m : { ...m, reactions: (m.reactions || []).map(r => r.emoji === emoji ? { ...r, count: r.count - 1, users: r.users.filter(u => u !== userId), reacted_by_me: false } : r).filter(r => r.count > 0) }))
    } else {
      await addReaction(messageId, emoji)
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m
        const ex = (m.reactions || []).find(r => r.emoji === emoji)
        if (ex) return { ...m, reactions: m.reactions!.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, users: [...r.users, userId], reacted_by_me: true } : r) }
        return { ...m, reactions: [...(m.reactions || []), { emoji, count: 1, users: [userId], reacted_by_me: true }] }
      }))
    }
    setShowEmojiPicker(null)
  }

  async function handleDeleteMessage(msgId: string) {
    if (!confirm('Apagar esta mensagem?')) return
    const ok = await deleteMessage(msgId)
    if (ok.success) setMessages(prev => prev.filter(m => m.id !== msgId))
  }

  async function handleRemoveMember(_memberId: string, memberUserId: string) {
    void _memberId
    if (!confirm('Remover este membro do grupo?')) return
    const ok = await removeGroupMember(groupId, memberUserId)
    if (ok.success) setMembers(prev => prev.filter(m => m.user_id !== memberUserId))
  }

  async function handleLeaveGroup() {
    if (!confirm('Tens a certeza que queres sair deste grupo?')) return
    const ok = await leaveGroup(groupId)
    if (ok.success) onBack()
  }

  async function handleSaveSettings() {
    const result = await updateGroup({ groupId, name: editName.trim(), description: editDesc.trim() })
    if (result.success) {
      setGroup(prev => prev ? { ...prev, name: editName.trim(), description: editDesc.trim() } : prev)
      setShowSettings(false)
    } else {
      alert(result.error || 'Erro ao guardar')
    }
  }

  async function handleDeleteGroup() {
    if (!confirm('Tens a certeza que queres eliminar este grupo? Esta ação é irreversível.')) return
    const ok = await deleteGroup(groupId)
    if (ok.success) onBack()
  }

  // Invite search debounce
  useEffect(() => {
    if (inviteSearchQuery.trim().length < 2) { setInviteSearchResults([]); return }
    const timer = setTimeout(async () => {
      setInviteSearching(true)
      const results = await searchPlayers(inviteSearchQuery, [userId])
      const memberUserIds = new Set(members.map(m => m.user_id))
      setInviteSearchResults(results.filter(p => !memberUserIds.has(p.user_id)))
      setInviteSearching(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [inviteSearchQuery])

  async function handleInvite(targetUserId: string) {
    setInvitingUserId(targetUserId)
    const result = await inviteToGroup(groupId, targetUserId)
    if (result.success) {
      setInviteSearchResults(prev => prev.filter(p => p.user_id !== targetUserId))
      // Send system message
      await sendMessage({ groupId, content: `convidou um novo jogador para o grupo`, messageType: 'system' })
    } else {
      alert(result.error || 'Erro ao convidar')
    }
    setInvitingUserId(null)
  }

  // Load group games
  useEffect(() => {
    if (activeTab === 'games') loadGroupGames()
  }, [activeTab])

  async function loadGroupGames() {
    setGamesLoading(true)
    try {
      const { fetchOpenGames } = await import('../../lib/openGames')
      const allGames = await fetchOpenGames({})
      setGroupGames(allGames.filter(g => (g as any).group_id === groupId))
    } catch (err) {
      console.error('[GroupDetail] Load games error:', err)
    }
    setGamesLoading(false)
  }

  function handleCreateGroupGame() {
    onCreateGroupGame(groupId)
  }

  // Load members when switching to tab
  useEffect(() => {
    if (activeTab === 'members' && members.length === 0) {
      setMembersLoading(true)
      getGroupMembers(groupId).then(m => { setMembers(m); setMembersLoading(false) })
    }
  }, [activeTab])

  function formatMsgTime(dateStr: string) {
    const d = new Date(dateStr)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  function formatMsgDate(dateStr: string) {
    const d = new Date(dateStr)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return 'Hoje'
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
    return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const groupedMessages = useMemo(() => {
    const reversed = [...messages].reverse()
    const groups: { date: string; messages: ChatMessage[] }[] = []
    let currentDate = ''
    reversed.forEach(msg => {
      const date = formatMsgDate(msg.created_at)
      if (date !== currentDate) {
        currentDate = date
        groups.push({ date, messages: [] })
      }
      groups[groups.length - 1].messages.push(msg)
    })
    return groups
  }, [messages])

  if (chatLoading) {
    return (
      <div className="animate-fade-in flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100dvh - 10rem)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
        <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-400 flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
          {group?.image_url ? <img src={group.image_url} className="w-full h-full object-cover" /> : (group?.name || 'G').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-gray-900 truncate">{group?.name}</p>
          <p className="text-xs text-gray-500">{group?.member_count} membros</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-gray-100 rounded-full">
            <Settings className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {(['chat', 'members', 'games'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${activeTab === tab ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}>
            {tab === 'chat' ? '💬 Chat' : tab === 'members' ? `👥 Membros` : '🎾 Jogos'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'chat' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
            {groupedMessages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-400">Ainda não há mensagens</p>
                <p className="text-xs text-gray-300 mt-1">Sê o primeiro a enviar uma mensagem!</p>
              </div>
            ) : (
              groupedMessages.map((dateGroup, gi) => (
                <div key={gi}>
                  <div className="flex items-center justify-center my-3">
                    <span className="text-[11px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{dateGroup.date}</span>
                  </div>
                  {dateGroup.messages.map(msg => {
                    const isMe = msg.user_id === userId
                    const isSystem = msg.message_type === 'system'

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex items-center justify-center my-2">
                          <span className="text-[11px] text-gray-400 italic">{msg.author_name} {msg.content}</span>
                        </div>
                      )
                    }

                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2 group`}>
                        <div className={`flex gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : ''}`}>
                          {!isMe && (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden mt-auto cursor-pointer" onClick={() => onOpenPlayerProfile(msg.user_id)}>
                              {msg.author_avatar ? <img src={msg.author_avatar} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-gray-600">{(msg.author_name || '?').charAt(0).toUpperCase()}</span>}
                            </div>
                          )}
                          <div>
                            {!isMe && <p className="text-[10px] text-gray-500 font-medium mb-0.5 ml-1">{msg.author_name}</p>}
                            {/* Reply preview */}
                            {msg.reply_preview && (
                              <div className={`text-[11px] px-2 py-1 mb-0.5 rounded-lg border-l-2 ${isMe ? 'bg-red-50 border-red-300 text-red-700' : 'bg-gray-100 border-gray-300 text-gray-600'}`}>
                                <span className="font-semibold">{msg.reply_preview.author_name}</span>
                                <p className="truncate">{msg.reply_preview.content}</p>
                              </div>
                            )}
                            <div
                              className={`px-3 py-2 rounded-2xl relative ${isMe ? 'bg-red-600 text-white rounded-br-md' : 'bg-gray-100 text-gray-900 rounded-bl-md'}`}
                              onContextMenu={e => { e.preventDefault(); setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id) }}
                            >
                              {msg.image_url && (
                                <img src={msg.image_url} alt="" className="max-w-full rounded-lg mb-1 max-h-60 object-cover cursor-pointer" onClick={() => window.open(msg.image_url!, '_blank')} />
                              )}
                              {msg.content && <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}
                              <p className={`text-[10px] mt-0.5 text-right ${isMe ? 'text-red-200' : 'text-gray-400'}`}>{formatMsgTime(msg.created_at)}</p>
                            </div>
                            {/* Reactions */}
                            {msg.reactions && msg.reactions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1 ml-1">
                                {msg.reactions.map(r => (
                                  <button key={r.emoji} onClick={() => handleReaction(msg.id, r.emoji)} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border ${r.reacted_by_me ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'} hover:bg-gray-100 transition-colors`}>
                                    <span>{r.emoji}</span>
                                    <span className="text-[10px] text-gray-600">{r.count}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            {/* Action buttons on hover/click */}
                            <div className={`flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <button onClick={() => setReplyTo(msg)} className="text-[10px] text-gray-400 hover:text-gray-600 px-1">Responder</button>
                              <button onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)} className="text-[10px] text-gray-400 hover:text-gray-600 px-1">Reagir</button>
                              {(isMe || isAdmin) && <button onClick={() => handleDeleteMessage(msg.id)} className="text-[10px] text-red-400 hover:text-red-600 px-1">Apagar</button>}
                            </div>
                            {/* Emoji picker */}
                            {showEmojiPicker === msg.id && (
                              <div className={`flex gap-1 mt-1 bg-white shadow-lg rounded-xl p-1.5 border border-gray-100 ${isMe ? 'justify-end' : ''}`}>
                                {QUICK_EMOJIS.map(emoji => (
                                  <button key={emoji} onClick={() => handleReaction(msg.id, emoji)} className="text-lg hover:scale-125 transition-transform p-0.5">{emoji}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Reply preview bar */}
          {replyTo && (
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-gray-500 font-semibold">A responder a {replyTo.author_name}</p>
                <p className="text-xs text-gray-400 truncate">{replyTo.content}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-gray-200 rounded-full"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
          )}

          {/* Image preview */}
          {imagePreview && (
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
              <img src={imagePreview} alt="" className="w-12 h-12 rounded-lg object-cover" />
              <p className="text-xs text-gray-500 flex-1">Imagem selecionada</p>
              <button onClick={() => { setImageFile(null); setImagePreview(null) }} className="p-1 hover:bg-gray-200 rounded-full"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
          )}

          {/* Input area */}
          <div className="px-3 py-2 border-t border-gray-100 bg-white flex items-center gap-2">
            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={e => {
              const f = e.target.files?.[0]
              if (f) {
                setImageFile(f)
                const reader = new FileReader()
                reader.onload = ev => setImagePreview(ev.target?.result as string)
                reader.readAsDataURL(f)
              }
              e.target.value = ''
            }} />
            <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
              <Camera className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
              placeholder="Escreve uma mensagem..."
              className="flex-1 px-3 py-2 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button onClick={handleSendMessage} disabled={sendingMsg || (!messageText.trim() && !imageFile)} className="p-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded-full transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="flex-1 overflow-y-auto py-3">
          {isAdmin && (
            <button onClick={() => { setShowInviteModal(true); setInviteSearchQuery(''); setInviteSearchResults([]) }} className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 rounded-xl mb-3 hover:bg-red-100 transition-colors">
              <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center"><Plus className="w-5 h-5 text-white" /></div>
              <span className="text-sm font-semibold text-red-700">Convidar jogadores</span>
            </button>
          )}

          {membersLoading ? (
            <div className="text-center py-6 text-gray-400 text-sm">{t.common.loading}</div>
          ) : (
            <div className="space-y-1">
              {members.map(m => {
                const colors = levelColors(m.level)
                return (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => onOpenPlayerProfile(m.user_id)}>
                      {m.avatar_url ? <img src={m.avatar_url} className="w-full h-full object-cover" /> : <span className="text-sm font-bold text-gray-600">{m.name.charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpenPlayerProfile(m.user_id)}>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{m.name}</p>
                        {m.role === 'admin' && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">Admin</span>}
                      </div>
                      {m.level != null && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${colors?.bg || 'bg-gray-100'} ${colors?.text || 'text-gray-600'}`}>Nv {m.level.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                    {isAdmin && m.user_id !== userId && (
                      <button onClick={() => handleRemoveMember(m.id, m.user_id)} className="text-xs text-red-500 hover:text-red-700 px-2 py-1">Remover</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Leave group button */}
          <div className="mt-6 px-4">
            <button onClick={handleLeaveGroup} className="w-full py-2.5 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
              Sair do grupo
            </button>
          </div>
        </div>
      )}

      {activeTab === 'games' && (
        <div className="flex-1 overflow-y-auto py-3">
          <div className="flex items-center justify-between px-1 py-4 mb-3">
            <p className="text-sm text-gray-500">Jogos abertos deste grupo</p>
            <button onClick={handleCreateGroupGame} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors">
              <Plus className="w-4 h-4" /> Criar Jogo
            </button>
          </div>

          {gamesLoading ? (
            <div className="text-center py-6 text-gray-400 text-sm">{t.common.loading}</div>
          ) : groupGames.length > 0 ? (
            <div className="space-y-3">
              {groupGames.map(game => {
                const confirmedPlayers = game.players.filter(p => p.status === 'confirmed')
                const spotsLeft = game.max_players - confirmedPlayers.length
                const gameDate = new Date(game.scheduled_at)
                return (
                  <div key={game.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-gray-900">{gameDate.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })} · {String(gameDate.getHours()).padStart(2, '0')}:{String(gameDate.getMinutes()).padStart(2, '0')}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${spotsLeft <= 1 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {spotsLeft} {spotsLeft === 1 ? 'lugar' : 'lugares'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{game.club_name}</p>
                    <div className="flex gap-2">
                      {confirmedPlayers.map(p => (
                        <div key={p.id} className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                          {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>}
                        </div>
                      ))}
                      {Array.from({ length: spotsLeft }).map((_, i) => (
                        <div key={`empty-${i}`} className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                          <Plus className="w-4 h-4 text-gray-300" />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">Sem jogos do grupo</p>
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setShowInviteModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Convidar Jogadores</h3>
              <button onClick={() => setShowInviteModal(false)} className="p-1 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-4">
              <input type="text" value={inviteSearchQuery} onChange={e => setInviteSearchQuery(e.target.value)} placeholder="Pesquisar jogador..." className="w-full px-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {inviteSearching ? (
                <div className="text-center py-6 text-gray-400 text-sm">A pesquisar...</div>
              ) : inviteSearchResults.length > 0 ? (
                <div className="space-y-2">
                  {inviteSearchResults.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : <span className="text-sm font-bold text-gray-600">{getInitials(p.name)}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                      </div>
                      <button
                        onClick={() => handleInvite(p.user_id)}
                        disabled={invitingUserId === p.user_id}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        {invitingUserId === p.user_id ? '...' : 'Convidar'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : inviteSearchQuery.trim().length >= 2 ? (
                <div className="text-center py-6 text-sm text-gray-400">Nenhum jogador encontrado</div>
              ) : (
                <div className="text-center py-6 text-sm text-gray-400">Escreve pelo menos 2 letras</div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Settings Modal */}
      {showSettings && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Definições do Grupo</h3>
                <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500" maxLength={50} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" rows={3} maxLength={200} />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 space-y-3">
              <button onClick={handleSaveSettings} className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors">Guardar</button>
              <button onClick={handleDeleteGroup} className="w-full py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-xl transition-colors">Eliminar grupo</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ---------- Listas de Seguindo/Seguidores ----------
