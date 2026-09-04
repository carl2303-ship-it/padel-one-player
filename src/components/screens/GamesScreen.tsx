import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useI18n } from '../../lib/i18nContext'
import type { PlayerAccount } from '../../lib/supabase'
import type { PlayerDashboardData } from '../../lib/playerDashboardData'
import { GameCardPlaytomic, OpenGameCard } from '../shared/matchUi'

export default function GamesScreen({
  player,
  dashboardData,
  onRefresh,
  onBack,
  onOpenPlayerProfile,
  onOpenFindGame,
  onOpenGameResults,
  initialTab,
  isLiteMode = false,
  canFindGame = true,
}: {
  player: PlayerAccount | null
  dashboardData: PlayerDashboardData | null
  onRefresh: () => Promise<void>
  onBack: () => void
  onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
  onOpenFindGame: () => void
  onOpenGameResults: () => void
  initialTab?: 'upcoming' | 'history'
  isLiteMode?: boolean
  canFindGame?: boolean
}) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>(initialTab || 'upcoming')
  
  // Update tab when initialTab changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])
  
  const d = dashboardData
  const upcoming = d?.upcomingMatches ?? []
  const recent = d?.recentMatches ?? []
  const list = activeTab === 'upcoming' ? upcoming : recent

  const handlePlayerClick = async (playerName: string) => {
    if (!playerName || isLikelyTeamLabel(playerName)) return
    const { findPlayerAccountByName } = await import('../../lib/classes')
    const acc = await findPlayerAccountByName(playerName)
    if (acc?.user_id) {
      onOpenPlayerProfile(acc.user_id, { accountId: acc.id, nameHint: playerName })
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900">{t.games.title}</h1>

      {(isLiteMode || !canFindGame) && (
        <button
          onClick={onOpenGameResults}
          className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl text-sm font-bold hover:from-green-700 hover:to-emerald-700 transition-all shadow-md flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t.common.quickResult}
        </button>
      )}

      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'upcoming' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          {t.games.upcoming}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          {t.games.history}
        </button>
      </div>

      {list.length > 0 ? (
        <div className="space-y-3">
          {list.map((match) => (
            <div key={match.id} className="w-full">
              {match.is_open_game && match.open_game_id && (match.status === 'completed' || (match.score1 != null && match.score2 != null)) ? (
                // For completed open games with results, use GameCardPlaytomic (same as tournaments)
                <GameCardPlaytomic 
                  match={match} 
                  fullWidth 
                  currentPlayerAvatar={player?.avatar_url} 
                  currentPlayerName={player?.name}
                  onPlayerClick={handlePlayerClick}
                />
              ) : match.is_open_game && match.open_game_id ? (
                // For upcoming open games, use OpenGameCard (with action buttons)
                <OpenGameCard
                  gameId={match.open_game_id}
                  match={match}
                  userId={player?.user_id}
                  playerAccountId={player?.id}
                  onRefresh={onRefresh}
                  fullWidth
                />
              ) : (
                // Tournament matches
                <GameCardPlaytomic 
                  match={match} 
                  fullWidth 
                  currentPlayerAvatar={player?.avatar_url} 
                  currentPlayerName={player?.name}
                  onPlayerClick={handlePlayerClick}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <span className="text-4xl mb-2 block">🎾</span>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Sem jogos</h3>
          <p className="text-gray-500 text-sm mb-4">
            {canFindGame ? 'Cria um jogo ou inscreve-te num torneio para começar' : 'Inscreve-te num torneio ou regista um resultado para começar'}
          </p>
          {canFindGame && (
          <button onClick={onOpenFindGame} className="px-6 py-3 btn-primary">Criar Jogo</button>
          )}
        </div>
      )}
    </div>
  )
}

/** Extrai nomes de jogadores de um match (excluindo o jogador atual). */
function getOtherPlayersFromMatch(match: { player1_name?: string; player2_name?: string; player3_name?: string; player4_name?: string; team1_name?: string; team2_name?: string; my_side?: 1 | 2 }, currentName?: string): string[] {
  return getPartnerNamesFromMatch(match, currentName)
}

