import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Image as ImageIcon, Send, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getInitials, levelColors } from '../../lib/communityData'
import {
  getConversationMessages,
  markConversationRead,
  sendDirectMessage,
  subscribeToConversation,
  uploadDmImage,
  type DirectMessage,
} from '../../lib/directMessages'

export default function DirectChatScreen({
  conversationId,
  myUserId,
  otherUserId,
  onBack,
}: {
  conversationId: string
  myUserId: string
  otherUserId: string
  onBack: () => void
}) {
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [otherName, setOtherName] = useState('Jogador')
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null)
  const [otherLevel, setOtherLevel] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('player_accounts')
        .select('name, avatar_url, level')
        .eq('user_id', otherUserId)
        .maybeSingle()
      if (active && data) {
        setOtherName(data.name || 'Jogador')
        setOtherAvatar(data.avatar_url || null)
        setOtherLevel(data.level ?? null)
      }
    })()
    return () => {
      active = false
    }
  }, [otherUserId])

  useEffect(() => {
    let active = true
    setLoading(true)
    getConversationMessages(conversationId, myUserId).then((list) => {
      if (!active) return
      setMessages(list)
      setLoading(false)
      markConversationRead(conversationId, myUserId)
    })

    const unsub = subscribeToConversation(
      conversationId,
      (msg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          return [msg, ...prev]
        })
        if (!msg.is_mine) markConversationRead(conversationId, myUserId)
      },
      myUserId
    )

    return () => {
      active = false
      unsub()
    }
  }, [conversationId, myUserId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, loading])

  async function handleSend() {
    if (sending) return
    if (!text.trim() && !imageFile) return
    setSending(true)
    let imageUrl: string | undefined
    if (imageFile) {
      imageUrl = (await uploadDmImage(imageFile, myUserId)) || undefined
      if (!imageUrl) {
        alert('Falha ao enviar a imagem')
        setSending(false)
        return
      }
    }
    const result = await sendDirectMessage({
      conversationId,
      senderId: myUserId,
      content: text,
      imageUrl,
      recipientUserId: otherUserId,
    })
    if (result.success) {
      setText('')
      setImageFile(null)
      setImagePreview(null)
      // Optimistic: realtime may also deliver; refresh if needed
      const list = await getConversationMessages(conversationId, myUserId)
      setMessages(list)
    } else {
      alert(result.error || 'Erro ao enviar')
    }
    setSending(false)
  }

  const colors = levelColors(otherLevel)
  const chronological = [...messages].reverse()

  return (
    <div className="animate-fade-in flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100 mb-2 flex-shrink-0">
        <button onClick={onBack} className="p-1 text-gray-600 hover:text-red-600">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="w-10 h-10 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center overflow-hidden">
          {otherAvatar ? <img src={otherAvatar} alt="" className="w-full h-full object-cover" /> : getInitials(otherName)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{otherName}</p>
          {otherLevel != null && (
            <span className={`inline-block text-[10px] font-black px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
              Nv {otherLevel}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 py-2 px-1">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
          </div>
        ) : chronological.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">Diz olá — envia a primeira mensagem.</p>
        ) : (
          chronological.map((m) => (
            <div key={m.id} className={`flex ${m.is_mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.is_mine
                    ? 'bg-red-600 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-900 rounded-bl-md'
                }`}
              >
                {m.image_url && (
                  <img
                    src={m.image_url}
                    alt=""
                    className="rounded-lg mb-1 max-h-48 w-full object-cover"
                  />
                )}
                {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                <p className={`text-[10px] mt-1 ${m.is_mine ? 'text-white/70' : 'text-gray-400'}`}>
                  {new Date(m.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {imagePreview && (
        <div className="relative mb-2 inline-block">
          <img src={imagePreview} alt="" className="h-20 rounded-lg object-cover" />
          <button
            type="button"
            onClick={() => {
              setImageFile(null)
              setImagePreview(null)
            }}
            className="absolute -top-1 -right-1 bg-black/60 text-white rounded-full p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 pt-2 border-t border-gray-100 flex-shrink-0">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="p-2.5 text-gray-500 hover:text-red-600"
          aria-label="Anexar imagem"
        >
          <ImageIcon className="w-5 h-5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) return
            setImageFile(f)
            setImagePreview(URL.createObjectURL(f))
          }}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder="Escreve uma mensagem…"
          className="flex-1 max-h-28 px-3 py-2.5 bg-gray-100 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <button
          type="button"
          disabled={sending || (!text.trim() && !imageFile)}
          onClick={handleSend}
          className="p-2.5 bg-red-600 text-white rounded-xl disabled:opacity-40 hover:bg-red-700"
          aria-label="Enviar"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
