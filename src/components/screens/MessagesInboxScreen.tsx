import { useEffect, useState } from 'react'
import { ChevronLeft, MessageCircle, Search } from 'lucide-react'
import { getInitials, levelColors, searchPlayers, type CommunityPlayer } from '../../lib/communityData'
import {
  getMyConversations,
  getOrCreateConversation,
  type DmConversation,
} from '../../lib/directMessages'

export default function MessagesInboxScreen({
  userId,
  onBack,
  onOpenChat,
}: {
  userId: string
  onBack: () => void
  onOpenChat: (conversationId: string, otherUserId: string) => void
}) {
  const [conversations, setConversations] = useState<DmConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CommunityPlayer[]>([])
  const [searching, setSearching] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getMyConversations(userId).then((list) => {
      setConversations(list)
      setLoading(false)
    })
  }, [userId])

  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      const results = await searchPlayers(query, [userId])
      setSearchResults(results)
      setSearching(false)
    }, 350)
    return () => clearTimeout(t)
  }, [query, userId])

  async function startChat(otherUserId: string) {
    if (starting) return
    setStarting(otherUserId)
    const result = await getOrCreateConversation(userId, otherUserId)
    setStarting(null)
    if (result.success && result.conversationId) {
      onOpenChat(result.conversationId, otherUserId)
    } else {
      alert(result.error || 'Não foi possível abrir a conversa')
    }
  }

  function timeLabel(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diffH = (now.getTime() - d.getTime()) / 3600000
    if (diffH < 24) return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    if (diffH < 168) return d.toLocaleDateString('pt-PT', { weekday: 'short' })
    return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-4">
        <button onClick={onBack} className="flex items-center gap-1 text-gray-600 hover:text-red-600 transition-colors mb-3">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Voltar</span>
        </button>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageCircle className="w-7 h-7 text-red-600" />
          Mensagens
        </h1>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nova mensagem — pesquisa um jogador"
          className="w-full pl-9 pr-3 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white"
        />
      </div>

      {query.trim().length >= 2 && (
        <div className="mb-4 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {searching ? (
            <p className="text-center text-sm text-gray-400 py-4">A pesquisar…</p>
          ) : searchResults.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-4">Nenhum jogador encontrado</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {searchResults.map((p) => {
                const colors = levelColors(p.level)
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={starting === p.user_id}
                    onClick={() => startChat(p.user_id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 disabled:opacity-60"
                  >
                    <div className="w-11 h-11 rounded-full bg-gray-900 text-white text-sm font-bold flex items-center justify-center overflow-hidden flex-shrink-0">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : getInitials(p.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                      {p.level != null && (
                        <span className={`inline-block mt-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                          Nv {p.level}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-red-600">Mensagem</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600">Ainda não tens mensagens</p>
          <p className="text-xs text-gray-400 mt-1">Pesquisa um jogador em cima para começar uma conversa.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
          {conversations.map((c) => {
            const colors = levelColors(c.otherLevel)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpenChat(c.id, c.otherUserId)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
              >
                <div className="w-12 h-12 rounded-full bg-gray-900 text-white text-sm font-bold flex items-center justify-center overflow-hidden flex-shrink-0">
                  {c.otherAvatar ? <img src={c.otherAvatar} alt="" className="w-full h-full object-cover" /> : getInitials(c.otherName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.otherName}</p>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">{timeLabel(c.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {c.otherLevel != null && (
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                        Nv {c.otherLevel}
                      </span>
                    )}
                    <p className={`text-xs truncate ${c.unreadCount > 0 ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                      {c.lastMessagePreview || 'Conversa'}
                    </p>
                  </div>
                </div>
                {c.unreadCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {c.unreadCount > 9 ? '9+' : c.unreadCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
