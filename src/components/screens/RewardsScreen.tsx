import { useState, useEffect } from 'react'
import { ArrowLeft, Gift, ShoppingBag, CheckCircle, AlertCircle, Star, X, Building2 } from 'lucide-react'
import type { PlayerAccount } from '../../lib/supabase'
import { useI18n } from '../../lib/i18nContext'

export default function RewardsScreen({ player, onBack }: { player: PlayerAccount; onBack: () => void }) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog')
  const [catalogItems, setCatalogItems] = useState<import('../../lib/openGames').CatalogItem[]>([])
  const [pointsByClub, setPointsByClub] = useState<Map<string, number>>(new Map())
  const [redemptions, setRedemptions] = useState<import('../../lib/openGames').RedemptionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState<string | null>(null) // catalog item id being redeemed
  const [confirmItem, setConfirmItem] = useState<import('../../lib/openGames').CatalogItem | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [showHowToEarn, setShowHowToEarn] = useState(false)

  // Total points across all clubs
  const totalPoints = Array.from(pointsByClub.values()).reduce((s, p) => s + p, 0)
  const getRewardTier = (pts: number) => {
    if (pts >= 1000) return { name: 'Diamond', emoji: '💎', bgColor: 'bg-gradient-to-br from-cyan-50 to-cyan-100', textColor: 'text-cyan-700' }
    if (pts >= 500) return { name: 'Platinum', emoji: '🏅', bgColor: 'bg-gradient-to-br from-purple-50 to-purple-100', textColor: 'text-purple-700' }
    if (pts >= 200) return { name: 'Gold', emoji: '🥇', bgColor: 'bg-gradient-to-br from-yellow-50 to-amber-100', textColor: 'text-amber-700' }
    return { name: 'Silver', emoji: '🥈', bgColor: 'bg-gradient-to-br from-gray-100 to-gray-200', textColor: 'text-gray-700' }
  }
  const tier = getRewardTier(totalPoints)

  const CATEGORY_LABELS: Record<string, { emoji: string; label: string }> = {
    drink: { emoji: '🍺', label: 'Bebidas' },
    food: { emoji: '🍕', label: 'Comida' },
    court: { emoji: '🏟️', label: t.games.court },
    merchandise: { emoji: '👕', label: 'Merchandise' },
    lesson: { emoji: '🎓', label: 'Aulas' },
    discount: { emoji: '💰', label: 'Descontos' },
    experience: { emoji: '✨', label: 'Experiências' },
    other: { emoji: '🎁', label: 'Outros' },
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const { fetchRewardCatalog, fetchMyRedemptions } = await import('../../lib/openGames')
      const [catalogResult, redemptionResult] = await Promise.all([
        fetchRewardCatalog(player.id),
        fetchMyRedemptions(player.id),
      ])
      setCatalogItems(catalogResult.items)
      setPointsByClub(catalogResult.pointsByClub)
      setRedemptions(redemptionResult)
    } catch (err) {
      console.error('[Rewards] Error loading data:', err)
    }
    setLoading(false)
  }

  const handleRedeem = async (item: import('../../lib/openGames').CatalogItem) => {
    setRedeeming(item.id)
    setConfirmItem(null)
    try {
      const { redeemReward } = await import('../../lib/openGames')
      const result = await redeemReward(item.id, player.id)
      if (result.success) {
        setSuccessMessage(`✅ Resgataste "${result.itemTitle}"! Gastaste ${result.pointsSpent} pontos. Restam ${result.remainingPoints} pontos.`)
        // Refresh data
        await loadData()
        // Auto-dismiss after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        alert(result.error || t.common.redeemError)
      }
    } catch (err) {
      alert(t.common.connectionError)
    }
    setRedeeming(null)
  }

  const filteredItems = filterCategory === 'all' 
    ? catalogItems 
    : catalogItems.filter(i => i.category === filterCategory)

  // Group items by club
  const itemsByClub = new Map<string, import('../../lib/openGames').CatalogItem[]>()
  filteredItems.forEach(item => {
    const list = itemsByClub.get(item.club_id) || []
    list.push(item)
    itemsByClub.set(item.club_id, list)
  })

  const STATUS_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
    pending: { label: 'Pendente', color: 'text-yellow-600 bg-yellow-50', emoji: '⏳' },
    approved: { label: 'Aprovado', color: 'text-green-600 bg-green-50', emoji: '✅' },
    used: { label: 'Utilizado', color: 'text-blue-600 bg-blue-50', emoji: '🎉' },
    cancelled: { label: 'Cancelado', color: 'text-red-600 bg-red-50', emoji: '❌' },
  }

  return (
    <div className="space-y-5 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          🎁 Gastar os meus pontos
        </h1>
      </div>

      {/* Points Summary Card */}
      <div className={`rounded-xl shadow-sm p-5 ${tier.bgColor}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-medium mb-1 flex items-center gap-1.5 ${tier.textColor}`}>
              <span className="text-lg">{tier.emoji}</span> {tier.name}
            </p>
            <p className={`text-4xl font-bold ${tier.textColor}`}>{totalPoints}</p>
            <p className={`text-xs mt-1 ${tier.textColor} opacity-70`}>pontos disponíveis</p>
          </div>
          {pointsByClub.size > 1 && (
            <div className="text-right space-y-1">
              {Array.from(pointsByClub.entries()).map(([clubId, pts]) => {
                const clubItem = catalogItems.find(i => i.club_id === clubId)
                return (
                  <p key={clubId} className={`text-xs ${tier.textColor} opacity-80`}>
                    {clubItem?.club_name || 'Clube'}: {pts} pts
                  </p>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Botão Como Ganhar Pontos */}
      <button
        onClick={() => setShowHowToEarn(true)}
        className="w-full py-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
      >
        <span className="text-lg">💡</span>
        <span className="text-sm font-semibold text-amber-700">Como ganhar pontos?</span>
      </button>

      {/* Modal Como Ganhar Pontos */}
      {showHowToEarn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={() => setShowHowToEarn(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                💡 Como ganhar pontos
              </h2>
              <button onClick={() => setShowHowToEarn(false)} className="p-1.5 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { emoji: '🎾', action: 'Criar um jogo aberto', points: 15, desc: 'Organiza um jogo e convida outros jogadores' },
                { emoji: '🤝', action: 'Entrar num jogo', points: 10, desc: 'Junta-te a um jogo criado por outro jogador' },
                { emoji: '📝', action: 'Submeter resultado', points: 5, desc: 'Regista o resultado do jogo após terminar' },
                { emoji: '✅', action: 'Disputar resultado', points: 0, desc: 'Contestação de um resultado incorreto pela equipa adversária' },
                { emoji: '🏆', action: 'Participar num torneio', points: 20, desc: 'Inscreve-te e participa num torneio' },
                { emoji: '🍺', action: 'Consumo no bar', points: 5, desc: 'Por cada 10€ gastos no bar do clube' },
                { emoji: '⭐', action: 'Primeiro jogo', points: 25, desc: 'Bónus pelo teu primeiro jogo na plataforma' },
                { emoji: '🔥', action: '3 jogos seguidos', points: 15, desc: 'Joga 3 jogos consecutivos numa semana' },
                { emoji: '💪', action: '7 jogos seguidos', points: 30, desc: 'Joga 7 jogos consecutivos' },
              ].map((rule, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <span className="text-2xl mt-0.5">{rule.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">{rule.action}</p>
                      <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                        +{rule.points} pts
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{rule.desc}</p>
                  </div>
                </div>
              ))}

              {/* Tiers info */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-bold text-gray-800 mb-3">🏅 Níveis de Recompensa</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'Silver', emoji: '🥈', min: 0, color: 'bg-gray-100 text-gray-700' },
                    { name: 'Gold', emoji: '🥇', min: 200, color: 'bg-amber-50 text-amber-700' },
                    { name: 'Platinum', emoji: '🏅', min: 500, color: 'bg-purple-50 text-purple-700' },
                    { name: 'Diamond', emoji: '💎', min: 1000, color: 'bg-cyan-50 text-cyan-700' },
                  ].map(t => (
                    <div key={t.name} className={`p-3 rounded-xl ${t.color} text-center`}>
                      <span className="text-xl">{t.emoji}</span>
                      <p className="text-xs font-bold mt-1">{t.name}</p>
                      <p className="text-[10px] opacity-70">{t.min}+ pontos</p>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-gray-400 text-center mt-3">
                Os pontos por ação podem variar conforme o clube. Valores acima são os valores padrão.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">{successMessage}</p>
            <button onClick={() => setSuccessMessage(null)} className="text-xs text-green-600 mt-1 underline">Fechar</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-gray-100 rounded-xl p-1.5 flex gap-1">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'catalog' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          🎁 Recompensas ({catalogItems.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          📋 Histórico ({redemptions.length})
        </button>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">{t.common.loadingRewards}</p>
        </div>
      )}

      {/* ===== Catalog Tab ===== */}
      {activeTab === 'catalog' && !loading && (
        <div className="space-y-4">
          {/* Category Filter */}
          <div className="overflow-x-auto pb-2 -mx-4 px-4">
            <div className="flex gap-2" style={{ width: 'max-content' }}>
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filterCategory === 'all' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Todos
              </button>
              {Object.entries(CATEGORY_LABELS).map(([key, { emoji, label }]) => {
                const count = catalogItems.filter(i => i.category === key).length
                if (count === 0) return null
                return (
                  <button
                    key={key}
                    onClick={() => setFilterCategory(key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                      filterCategory === key ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {emoji} {label} ({count})
                  </button>
                )
              })}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhuma recompensa disponível</p>
              <p className="text-xs text-gray-400 mt-1">Joga mais para acumular pontos e desbloquear recompensas!</p>
            </div>
          ) : (
            // Render items grouped by club
            Array.from(itemsByClub.entries()).map(([clubId, items]) => {
              const clubPoints = pointsByClub.get(clubId) || 0
              const clubName = items[0]?.club_name || 'Clube'

              return (
                <div key={clubId} className="space-y-3">
                  {/* Club header */}
                  {itemsByClub.size > 1 && (
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        {items[0]?.club_logo_url ? (
                          <img src={items[0].club_logo_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <Building2 className="w-5 h-5 text-gray-400" />
                        )}
                        <p className="text-sm font-bold text-gray-800">{clubName}</p>
                      </div>
                      <p className="text-xs font-medium text-gray-500">{clubPoints} pts disponíveis</p>
                    </div>
                  )}

                  {/* Items grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {items.map(item => {
                      const catInfo = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.other
                      const canAfford = clubPoints >= item.cost_points
                      const isRedeeming = redeeming === item.id

                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border overflow-hidden transition-all ${
                            canAfford ? 'border-gray-200 bg-white hover:shadow-md' : 'border-gray-100 bg-gray-50 opacity-70'
                          }`}
                        >
                          {/* Image or emoji fallback */}
                          {item.image_url ? (
                            <div className="h-28 overflow-hidden">
                              <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="h-28 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                              <span className="text-5xl">{catInfo.emoji}</span>
                            </div>
                          )}

                          <div className="p-3 space-y-2">
                            <div>
                              <p className="text-sm font-bold text-gray-900 leading-tight">{item.title}</p>
                              {item.description && (
                                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{item.description}</p>
                              )}
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                                <Star className="w-3.5 h-3.5" /> {item.cost_points} pts
                              </span>
                              {item.stock !== null && (
                                <span className="text-[10px] text-gray-400">Stock: {item.stock}</span>
                              )}
                            </div>

                            <button
                              onClick={() => canAfford ? setConfirmItem(item) : null}
                              disabled={!canAfford || isRedeeming}
                              className={`w-full py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                                isRedeeming
                                  ? 'bg-gray-200 text-gray-400 cursor-wait'
                                  : canAfford
                                    ? 'bg-red-600 text-white hover:bg-red-700 active:scale-95'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              {isRedeeming ? (
                                <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div> A resgatar...</>
                              ) : canAfford ? (
                                <><ShoppingBag className="w-3.5 h-3.5" /> Resgatar</>
                              ) : (
                                <><AlertCircle className="w-3.5 h-3.5" /> Pontos insuficientes</>
                              )}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ===== History Tab ===== */}
      {activeTab === 'history' && !loading && (
        <div className="space-y-3">
          {redemptions.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhum resgate ainda</p>
              <p className="text-xs text-gray-400 mt-1">Quando resgatares uma recompensa, aparecerá aqui.</p>
            </div>
          ) : (
            redemptions.map(r => {
              const status = STATUS_LABELS[r.status] || STATUS_LABELS.pending
              return (
                <div key={r.id} className="card p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
                    {status.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{r.item_title}</p>
                    <p className="text-[11px] text-gray-500">{r.club_name} · {new Date(r.redeemed_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-red-600">-{r.points_spent} pts</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ===== Confirm Modal ===== */}
      {confirmItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4" onClick={() => setConfirmItem(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
            {/* Item preview */}
            {confirmItem.image_url ? (
              <div className="h-40 overflow-hidden">
                <img src={confirmItem.image_url} alt={confirmItem.title} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
                <span className="text-6xl">{(CATEGORY_LABELS[confirmItem.category] || CATEGORY_LABELS.other).emoji}</span>
              </div>
            )}

            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{confirmItem.title}</h3>
                {confirmItem.description && (
                  <p className="text-sm text-gray-600 mt-1">{confirmItem.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">{confirmItem.club_name}</p>
              </div>

              <div className="bg-red-50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-red-700 font-medium">Custo:</span>
                <span className="text-lg font-bold text-red-600">{confirmItem.cost_points} pontos</span>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">Pontos após resgate:</span>
                <span className="text-lg font-bold text-gray-800">
                  {(pointsByClub.get(confirmItem.club_id) || 0) - confirmItem.cost_points}
                </span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmItem(null)}
                  className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={() => handleRedeem(confirmItem)}
                  disabled={redeeming !== null}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  {redeeming ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> A processar...</>
                  ) : (
                    <><Gift className="w-4 h-4" /> Confirmar resgate</>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-gray-400 text-center">
                Após o resgate, apresenta a confirmação no clube para receber a tua recompensa.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

