import { useState, useEffect } from 'react'
import { ArrowLeft, CreditCard } from 'lucide-react'
import { supabase, type PlayerAccount } from '../../lib/supabase'
import { useI18n } from '../../lib/i18nContext'

export default function PaymentsScreen({ player, userId, onBack }: { player: PlayerAccount; userId: string | null; onBack: () => void }) {
  const { t, language } = useI18n()
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPayments()
  }, [])

  const loadPayments = async () => {
    setLoading(true)
    try {
      // Fetch payments for this player
      const { data, error } = await supabase
        .from('open_game_payments')
        .select(`
          id,
          game_id,
          amount,
          currency,
          payment_type,
          status,
          created_at,
          open_games (
            scheduled_at,
            club_id,
            duration_minutes
          )
        `)
        .or(`player_account_id.eq.${player.id}${userId ? `,user_id.eq.${userId}` : ''}`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error && data) {
        // Fetch club names for the games
        const clubIds = [...new Set(data.map((p: any) => (p.open_games as any)?.club_id).filter(Boolean))]
        let clubsMap: { [id: string]: string } = {}
        if (clubIds.length > 0) {
          const { data: clubs } = await supabase
            .from('clubs')
            .select('id, name')
            .in('id', clubIds)
          if (clubs) clubs.forEach((c: any) => { clubsMap[c.id] = c.name })
        }

        setPayments(data.map((p: any) => ({
          ...p,
          club_name: clubsMap[(p.open_games as any)?.club_id] || 'Clube',
          game_date: (p.open_games as any)?.scheduled_at || null,
        })))
      }
    } catch (e) {
      console.error('Error loading payments:', e)
    }
    setLoading(false)
  }

  const statusLabel = (s: string) => {
    switch (s) {
      case 'succeeded': return { text: t.payments.paid, color: 'bg-green-100 text-green-700' }
      case 'pending': return { text: t.payments.pending, color: 'bg-amber-100 text-amber-700' }
      case 'failed': return { text: t.payments.failed, color: 'bg-red-100 text-red-700' }
      case 'refunded': return { text: t.payments.refunded, color: 'bg-blue-100 text-blue-700' }
      default: return { text: s, color: 'bg-gray-100 text-gray-600' }
    }
  }

  const typeLabel = (type: string) => type === 'full_court' ? t.payments.fullCourt : t.payments.perPlayer

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">{t.payments.title}</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16">
            <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t.payments.noPayments}</h3>
            <p className="text-sm text-gray-500">{t.payments.noPaymentsMessage}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary card */}
            {(() => {
              const totalPaid = payments.filter(p => p.status === 'succeeded').reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0)
              const totalPending = payments.filter(p => p.status === 'pending').reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0)
              return (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 text-white mb-2">
                  <p className="text-xs font-medium text-blue-200 mb-1">{t.payments.totalPaid}</p>
                  <p className="text-2xl font-bold">{totalPaid.toFixed(2)}€</p>
                  {totalPending > 0 && (
                    <p className="text-xs text-blue-200 mt-1">{totalPending.toFixed(2)}€ {t.payments.pending}</p>
                  )}
                  <p className="text-xs text-blue-200 mt-2">{payments.length} {payments.length > 1 ? t.payments.transactionsPlural : t.payments.transactions}</p>
                </div>
              )
            })()}

            {/* Payments list */}
            {payments.map((p: any) => {
              const st = statusLabel(p.status)
              const gameDate = p.game_date ? new Date(p.game_date) : null
              const payDate = new Date(p.created_at)
              return (
                <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{p.club_name}</p>
                      {gameDate && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {t.payments.game}: {gameDate.toLocaleDateString(language === 'pt' ? 'pt-PT' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'en-GB')} {language === 'pt' ? 'às' : language === 'es' ? 'a las' : language === 'fr' ? 'à' : 'at'} {gameDate.getHours().toString().padStart(2, '0')}:{gameDate.getMinutes().toString().padStart(2, '0')}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.color}`}>
                          {st.text}
                        </span>
                        <span className="text-[10px] text-gray-400">{typeLabel(p.payment_type)}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {payDate.toLocaleDateString('pt-PT')} {payDate.getHours().toString().padStart(2, '0')}:{payDate.getMinutes().toString().padStart(2, '0')}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-lg font-bold ${p.status === 'succeeded' ? 'text-green-600' : p.status === 'pending' ? 'text-amber-600' : 'text-gray-600'}`}>
                        {parseFloat(p.amount).toFixed(2)}€
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

