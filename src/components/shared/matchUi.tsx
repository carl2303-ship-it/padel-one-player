import { useState, useEffect, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { Building2, Calendar, ChevronRight, MapPin, Search, TrendingUp, Trophy, UserPlus, X } from 'lucide-react'
import { useI18n } from '../../lib/i18nContext'
import { levelColors, getInitials } from '../../lib/communityData'
import { getCachedPlayerData } from '../../lib/playerDataCache'
import { resolveFourPlayerNames, isLikelyTeamLabel } from '../../lib/matchPlayerNames'
import { fetchPlayerPreview, type PlayerPreviewData } from '../../lib/playerPreview'
import type { EnrolledItem, EnrolledPlayer } from '../../lib/clubAndTournaments'
import type { PlayerMatch } from '../../lib/playerDashboardData'

export type PlayerMatchForCard = PlayerMatch

export type TournamentForCard = {
  name: string
  start_date: string
  status?: string
  enrolled_count?: number
}

export function formatDate(s: string) {
  const d = new Date(s)
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}
export function formatDateTime(s: string) {
  const d = new Date(s)
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export function formatDateWithTime(s: string) {
  const d = new Date(s)
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${date} | ${time}`
}
export function initialFor(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  // Display names like "Carlos/Padel1/BoostPadel" — use first segment only for initials
  const primary = t.split(/\s*\/\s*/)[0]?.trim() || t
  const words = primary.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase().slice(0, 2)
  return primary.slice(0, 2).toUpperCase()
}

/** Short label under bubble — avoid showing "Carlos/Padel1/BoostPadel" as if it were 3 players */
export function shortPlayerLabel(name: string): string {
  const t = (name || '').trim()
  if (!t || t === '?') return t || '?'
  const primary = t.split(/\s*\/\s*/)[0]?.trim() || t
  const words = primary.split(/\s+/).filter(Boolean)
  if (words.length <= 2) return primary
  return `${words[0]} ${words[words.length - 1][0]}.`
}

// Tipos para os dados integrados do Tour (PlayerMatch = formato do dashboardData)
export function OpenGameResultScores({ result }: { result: import('../../lib/openGames').OpenGameResult }) {
  const s1 = [result.team1_score_set1 || 0, result.team2_score_set1 || 0]
  const s2 = [result.team1_score_set2 || 0, result.team2_score_set2 || 0]
  const s3 = [result.team1_score_set3 || 0, result.team2_score_set3 || 0]
  const sets1 = (s1[0] > s1[1] ? 1 : 0) + (s2[0] > s2[1] ? 1 : 0) + (s3[0] > s3[1] ? 1 : 0)
  const sets2 = (s1[1] > s1[0] ? 1 : 0) + (s2[1] > s2[0] ? 1 : 0) + (s3[1] > s3[0] ? 1 : 0)
  const team1Won = sets1 > sets2
  const sets = [s1, s2, ...(s3[0] > 0 || s3[1] > 0 ? [s3] : [])]

  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className={`flex-1 text-center ${team1Won ? 'font-bold text-green-700' : 'text-gray-500'}`}>
          <span className="text-xs">Eq. 1 {team1Won ? '🏆' : ''}</span>
        </div>
        <div className="w-8" />
        <div className={`flex-1 text-center ${!team1Won ? 'font-bold text-green-700' : 'text-gray-500'}`}>
          <span className="text-xs">Eq. 2 {!team1Won ? '🏆' : ''}</span>
        </div>
      </div>
      <div className="flex items-center justify-center gap-3">
        {sets.map((s, i) => (
          <div key={i} className="text-center">
            <p className="text-[9px] text-gray-400">Set {i + 1}</p>
            <p className="text-sm font-bold text-gray-800">{s[0]} - {s[1]}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 text-center mt-1">Submetido pela Equipa {result.submitted_by_team}</p>
    </div>
  )
}

export function ActionButton({ icon: Icon, label, color, onClick, emoji }: {
  icon: any
  label: string
  color: 'lime' | 'blue' | 'amber' | 'purple' | 'emerald' | 'rose'
  onClick?: () => void
  emoji?: string
}) {
  const colorClasses = {
    lime: 'bg-lime-400',
    blue: 'bg-blue-400',
    amber: 'bg-amber-400',
    purple: 'bg-purple-400',
    emerald: 'bg-emerald-400',
    rose: 'bg-rose-400',
  }
  return (
    <button type="button" onClick={onClick} className="action-btn">
      <div className={`action-btn-icon ${colorClasses[color]} flex items-center justify-center`}>
        {emoji ? <span className="text-2xl">{emoji}</span> : <Icon className="w-6 h-6 text-white" />}
      </div>
      <span className="text-xs font-medium text-gray-700">{label}</span>
    </button>
  )
}

export function MatchCard({ match }: { match: PlayerMatchForCard }) {
  const { t } = useI18n()
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900">{match.tournament_name}</p>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {match.start_time ? formatDate(match.start_time) : '-'}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {t.common.court} {match.court || '-'}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{match.team1_name} vs {match.team2_name}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </div>
  )
}

/** Parseia "6-2" em [6, 2] para exibir sets ao estilo Playtomic */
export function parseSetScores(setStr: string): [string, string] | null {
  if (!setStr?.includes('-')) return null
  const [a, b] = setStr.split('-').map((s) => s.trim())
  return a != null && b != null ? [a, b] : null
}

export function isCurrentPlayer(playerName: string, currentName?: string): boolean {
  if (!currentName) return false
  const p = (playerName || '').trim().toLowerCase()
  const c = (currentName || '').trim().toLowerCase()
  if (!p || !c) return false
  if (p === c) return true
  const pPrimary = p.split(/\s*\/\s*/)[0]
  const cPrimary = c.split(/\s*\/\s*/)[0]
  if (pPrimary === cPrimary) return true
  // Match parcial: "Guilherme" vs "Guilherme Silva" ou vice-versa
  return p.startsWith(c) || c.startsWith(p) || pPrimary.startsWith(cPrimary) || cPrimary.startsWith(pPrimary)
}

export function PlayerCircle({ name, bgClass, textClass, avatarUrl, currentPlayerName, onClick }: {
  name: string
  bgClass: string
  textClass: string
  avatarUrl?: string | null
  currentPlayerName?: string
  onClick?: () => void
}) {
  // Sempre mostrar avatar se existir, independentemente de ser o jogador atual
  const showAvatar = !!avatarUrl
  return (
    <div 
      className={`w-16 h-16 rounded-full flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden ${!showAvatar ? bgClass : ''} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
      title={name}
      onClick={onClick}
    >
      {showAvatar ? (
        <img src={avatarUrl!} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className={textClass}>{initialFor(name)}</span>
      )}
    </div>
  )
}

export function enrolledPlayersOf(item: EnrolledItem): EnrolledPlayer[] {
  if (item.players?.length) return item.players.filter((p) => p?.name)
  const fromPair = [item.player1_name, item.player2_name].filter(Boolean).map((name) => ({ name: name as string }))
  if (fromPair.length) return fromPair
  if (item.player_names?.length) return item.player_names.filter(Boolean).map((name) => ({ name }))
  return item.name ? [{ name: item.name }] : []
}

export function EnrolledItemRow({
  item,
  index,
  onPlayerClick,
}: {
  item: EnrolledItem
  index: number
  onPlayerClick?: (player: EnrolledPlayer) => void
}) {
  const players = enrolledPlayersOf(item)
  return (
    <div className="flex items-start gap-3 py-2.5 px-3 bg-gray-50 rounded-xl">
      <span className="text-xs font-semibold text-gray-400 w-5 text-right pt-5">{index + 1}</span>
      <div className="flex flex-wrap gap-x-5 gap-y-2 flex-1">
        {players.map((p, i) => {
          const isPlaceholder = !p.name || p.name === '?' || isLikelyTeamLabel(p.name)
          const cached = !isPlaceholder ? getCachedPlayerData(p.name) : null
          const avatarUrl = p.avatar_url || cached?.avatar_url || null
          const canOpen = Boolean(onPlayerClick && !isPlaceholder)
          const openProfile = canOpen ? () => onPlayerClick!(p) : undefined
          return (
            <div key={`${item.id}-${i}-${p.name}`} className="flex flex-col items-center min-h-[96px]">
              <PlayerCircle
                name={isPlaceholder ? '?' : p.name}
                bgClass={i % 2 === 0 ? 'bg-orange-400' : 'bg-sky-200'}
                textClass={i % 2 === 0 ? 'text-xl font-bold text-white' : 'text-xl font-bold text-sky-800'}
                avatarUrl={avatarUrl}
                onClick={openProfile}
              />
              <button
                type="button"
                disabled={!canOpen}
                onClick={openProfile}
                className={`text-[11px] text-gray-700 font-medium truncate max-w-[90px] mt-1.5 text-center leading-tight ${canOpen ? 'hover:text-red-600 cursor-pointer' : ''}`}
                title={isPlaceholder ? undefined : p.name}
              >
                {isPlaceholder ? '—' : shortPlayerLabel(p.name)}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PlayerPreviewPopup({
  player,
  onClose,
}: {
  player: EnrolledPlayer | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const [data, setData] = useState<PlayerPreviewData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!player) {
      setData(null)
      return
    }
    let active = true
    setLoading(true)
    fetchPlayerPreview({
      accountId: player.account_id,
      userId: player.user_id,
      nameHint: player.name,
    })
      .then((preview) => {
        if (active) setData(preview)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [player])

  if (!player) return null

  const colors = levelColors(data?.level)
  const totalMatches = (data?.wins ?? 0) + (data?.losses ?? 0)
  const winRate = totalMatches > 0 ? Math.round(((data?.wins ?? 0) / totalMatches) * 100) : 0
  const avatarUrl = data?.avatar_url || player.avatar_url || getCachedPlayerData(player.name)?.avatar_url || null
  const displayName = data?.name || player.name

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-900 flex-shrink-0 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-lg">{getInitials(displayName)}</span>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 truncate">{displayName}</h3>
                {loading ? (
                  <div className="h-4 w-16 bg-gray-100 rounded animate-pulse mt-1" />
                ) : data?.level != null ? (
                  <p className="text-sm font-semibold text-red-600 mt-0.5">Nível {data.level.toFixed(2)}</p>
                ) : (
                  <p className="text-sm text-gray-400 mt-0.5">Nível —</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {data?.level != null && (
                <div
                  className="rounded-xl p-4 mb-4 text-center"
                  style={
                    colors?.hex
                      ? { background: `linear-gradient(135deg, ${colors.hex} 0%, ${colors.hexTo} 100%)` }
                      : undefined
                  }
                >
                  <p className={`text-3xl font-bold ${colors?.hex ? 'text-white' : 'text-red-600'}`}>
                    {data.level.toFixed(2)}
                  </p>
                  <p className={`text-xs mt-1 ${colors?.hex ? 'text-white/90' : 'text-gray-500'}`}>
                    {t.home?.level || 'Nível'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-gray-900">{totalMatches}</p>
                  <p className="text-[10px] text-gray-500 font-medium">Jogos</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-green-600">{data?.wins ?? 0}</p>
                  <p className="text-[10px] text-gray-500 font-medium">Vitórias</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-gray-900">{winRate}%</p>
                  <p className="text-[10px] text-gray-500 font-medium">Taxa</p>
                </div>
              </div>

              <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-medium text-gray-700">{t.home?.rankings || 'Ranking'}</span>
                </div>
                <span className="text-lg font-bold text-amber-700">
                  {data?.rankingPosition != null ? `#${data.rankingPosition}` : '—'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Card ao estilo Playtomic: layout vertical – equipa 1 em cima, resultado no meio, equipa 2 em baixo; nomes abaixo de cada bolinha; troféu ao lado do resultado da equipa vencedora */
export function GameCardPlaytomic({
  match, 
  fullWidth, 
  currentPlayerAvatar, 
  currentPlayerName,
  onPlayerClick 
}: { 
  match: PlayerMatchForCard
  fullWidth?: boolean
  currentPlayerAvatar?: string | null
  currentPlayerName?: string
  onPlayerClick?: (playerName: string) => void
}) {
  const { t } = useI18n()
  const [n1, n2, n3, n4] = resolveFourPlayerNames(match)
  const matchAvatars = [
    (match as any).player1_avatar as string | null | undefined,
    (match as any).player2_avatar as string | null | undefined,
    (match as any).player3_avatar as string | null | undefined,
    (match as any).player4_avatar as string | null | undefined,
  ]
  
  const setStrings = [match.set1, match.set2, match.set3].filter(Boolean) as string[]
  const parsedSets = setStrings.map(parseSetScores)
  const hasSets = parsedSets.some(Boolean)
  const isTournament = Boolean(match.tournament_id && match.tournament_name)
  const team1Scores = parsedSets.map((p) => (p ? p[0] : '-'))
  const team2Scores = parsedSets.map((p) => (p ? p[1] : '-'))
  const team1Won = match.status === 'completed' && match.score1 != null && match.score2 != null && match.score1 > match.score2
  const team2Won = match.status === 'completed' && match.score1 != null && match.score2 != null && match.score2 > match.score1
  const numSets = setStrings.length
  const scoreContainerW = numSets >= 3 ? 'min-w-[100px]' : 'w-[80px]'
  const scoreFontSize = numSets >= 3 ? 'text-base' : 'text-2xl'
  
  // Função para renderizar jogador com nível (dados do cache global — sem queries)
  const renderPlayer = (name: string, bgClass: string, textClass: string, matchAvatar?: string | null) => {
    const isPlaceholder = !name || name === '?' || isLikelyTeamLabel(name)
    const cached = !isPlaceholder ? getCachedPlayerData(name) : null
    const level = cached?.level ?? undefined
    const colors = levelColors(level)
    const avatarUrl =
      matchAvatar ||
      cached?.avatar_url ||
      (!isPlaceholder && isCurrentPlayer(name, currentPlayerName) ? currentPlayerAvatar : null) ||
      null
    const canOpenProfile = Boolean(onPlayerClick && !isPlaceholder)

    return (
      <div className="flex flex-col items-center min-h-[96px]">
        <PlayerCircle 
          name={isPlaceholder ? '?' : name} 
          bgClass={bgClass} 
          textClass={textClass} 
          avatarUrl={avatarUrl} 
          currentPlayerName={currentPlayerName}
          onClick={canOpenProfile ? () => onPlayerClick!(name) : undefined}
        />
        <span className="text-[11px] text-gray-700 font-medium truncate max-w-[90px] mt-1.5 text-center leading-tight" title={isPlaceholder ? undefined : name}>
          {isPlaceholder ? '—' : shortPlayerLabel(name)}
        </span>
        {level !== undefined && (
          <div 
            className="mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: colors?.hex || '#9ca3af' }}
            title={`Nível ${level.toFixed(2)}`}
          >
            {level.toFixed(2)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`rounded-2xl bg-white border border-gray-100 shadow-md overflow-hidden ${fullWidth ? 'w-full' : 'flex-shrink-0 w-[360px] sm:w-[400px]'}`}>
      <div className="p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-medium text-gray-500">
            {match.start_time ? formatDateWithTime(match.start_time) : '-'}
          </span>
          {match.is_open_game && match.club_name ? (
            <span className="flex items-center gap-1 text-blue-600" title={match.club_name}>
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium truncate max-w-[120px]">{match.club_name}</span>
            </span>
          ) : isTournament && (
            <span className="flex items-center gap-1 text-amber-600" title={match.tournament_name}>
              <Trophy className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium truncate max-w-[120px]">{match.tournament_name}</span>
            </span>
          )}
        </div>

        {/* Layout: grid 2x2 bolinhas alinhadas no topo; resultados à direita; linha fina divide equipas */}
        <div className="flex flex-col">
          {/* Equipa 1 – laranja */}
          <div className="flex items-start justify-between gap-4">
            <div className="grid grid-cols-2 gap-x-5 gap-y-0 flex-1 items-start">
              {renderPlayer(n1, 'bg-orange-400', 'text-2xl font-bold text-white', matchAvatars[0])}
              {renderPlayer(n2, 'bg-orange-400', 'text-2xl font-bold text-white', matchAvatars[1])}
            </div>
            {match.status === 'completed' && (hasSets || match.score1 != null) && (
              <div className={`flex items-center gap-1 flex-shrink-0 ${scoreContainerW} justify-end whitespace-nowrap`}>
                <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                  {team1Won && <span className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center text-xs" title={t.games.winnerTeam}>🏆</span>}
                </span>
                <span className={team1Won ? `${scoreFontSize} font-bold text-gray-900` : `${scoreFontSize} font-medium text-gray-400`}>
                  {hasSets ? team1Scores.join(' ') : match.score1}
                </span>
              </div>
            )}
          </div>

          {/* Linha fina a dividir equipa 1 da equipa 2 */}
          <div className="border-t border-gray-200/60 my-2" />

          {/* Equipa 2 – azul claro (grid igual para alinhar com equipa 1) */}
          <div className="flex items-start justify-between gap-4">
            <div className="grid grid-cols-2 gap-x-5 gap-y-0 flex-1 items-start">
              {renderPlayer(n3, 'bg-sky-200', 'text-2xl font-bold text-sky-800', matchAvatars[2])}
              {renderPlayer(n4, 'bg-sky-200', 'text-2xl font-bold text-sky-800', matchAvatars[3])}
            </div>
            {match.status === 'completed' && (hasSets || match.score1 != null) && (
              <div className={`flex items-center gap-1 flex-shrink-0 ${scoreContainerW} justify-end whitespace-nowrap`}>
                <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                  {team2Won && <span className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center text-xs" title={t.games.winnerTeam}>🏆</span>}
                </span>
                <span className={team2Won ? `${scoreFontSize} font-bold text-gray-900` : `${scoreFontSize} font-medium text-gray-400`}>
                  {hasSets ? team2Scores.join(' ') : match.score2}
                </span>
              </div>
            )}
          </div>

          {/* Para jogos por jogar: hora/court centrado se não há resultados */}
          {match.status !== 'completed' && (
            <div className="text-xs text-gray-500 text-center mt-1">
              {match.start_time ? formatDateWithTime(match.start_time).split(' | ')[1] : ''}
              {match.court ? ` · ${t.games.courtShort}${match.court}` : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function TournamentCard({
  tournament,
  onClick,
}: {
  tournament: TournamentForCard
  onClick?: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="card overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={onClick}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 line-clamp-1">{tournament.name}</h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(tournament.start_date)}
              </span>
              {tournament.enrolled_count !== undefined && (
                <span className="text-xs text-red-600">{tournament.enrolled_count} inscritos</span>
              )}
            </div>
          </div>
          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
            tournament.status === 'active' || tournament.status === 'in_progress'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {tournament.status === 'active' || tournament.status === 'in_progress' ? t.games.inProgress : tournament.status}
          </span>
        </div>
      </div>
    </div>
  )
}

// ==================== OPEN GAME CARD (for upcoming matches) ====================

export function OpenGameCard({ 
  gameId, 
  match, 
  userId, 
  playerAccountId, 
  onRefresh,
  fullWidth 
}: { 
  gameId: string
  match: PlayerMatchForCard
  userId?: string | null
  playerAccountId?: string | null
  onRefresh: () => Promise<void>
  fullWidth?: boolean
}) {
  const { t } = useI18n()
  const [game, setGame] = useState<import('../../lib/openGames').OpenGame | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [addPlayerTargetPosition, setAddPlayerTargetPosition] = useState<number | null>(null)
  const [addPlayerSearch, setAddPlayerSearch] = useState('')
  const [addPlayerResults, setAddPlayerResults] = useState<{ id: string; name: string; avatar_url: string | null; level: number | null; player_category: string | null }[]>([])
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    const fetchGame = async () => {
      const { supabase } = await import('../../lib/supabase')
      const { data } = await supabase
        .from('open_games')
        .select('*')
        .eq('id', gameId)
        .maybeSingle()

      if (data) {
        // Fetch players
        const { data: playersData } = await supabase
          .from('open_game_players')
          .select('*')
          .eq('game_id', gameId)
          .eq('status', 'confirmed')
          .order('position')

        // Fetch player account details — buscar por user_id E por player_account_id
        const userIds = [...new Set((playersData || []).map((p: any) => p.user_id).filter(Boolean))]
        const playerAccountIds = [...new Set((playersData || []).map((p: any) => p.player_account_id).filter(Boolean))]
        let playerAccountsMap: { [key: string]: any } = {}

        if (userIds.length > 0 || playerAccountIds.length > 0) {
          const allIds = [...new Set([...playerAccountIds])]
          const queries: Promise<any>[] = []

          if (allIds.length > 0) {
            queries.push(
              supabase.from('player_accounts').select('id, user_id, name, avatar_url, level, player_category').in('id', allIds)
            )
          }
          if (userIds.length > 0) {
            queries.push(
              supabase.from('player_accounts').select('id, user_id, name, avatar_url, level, player_category').in('user_id', userIds)
            )
          }

          const results = await Promise.all(queries)
          results.forEach(({ data: accounts }) => {
            if (accounts) {
              accounts.forEach((a: any) => {
                if (a.user_id) playerAccountsMap[a.user_id] = a
                playerAccountsMap[a.id] = a
              })
            }
          })
        }

        // Enrich players data
        const enrichedPlayers = (playersData || []).map((p: any) => {
          const account = playerAccountsMap[p.player_account_id] || playerAccountsMap[p.user_id]
          return {
            ...p,
            name: account?.name || p.name || t.common.player,
            avatar_url: account?.avatar_url || null,
            level: account?.level || null,
            player_category: account?.player_category || null,
          }
        })

        // Fetch club data
        const { data: clubData } = await supabase
          .from('clubs')
          .select('name, logo_url, city, payment_method')
          .eq('id', data.club_id)
          .single()

        // Fetch court data
        let courtData = null
        if (data.court_id) {
          const { data: courtResult } = await supabase
            .from('club_courts')
            .select('name, type')
            .eq('id', data.court_id)
            .single()
          courtData = courtResult
        }

        setGame({
          ...data,
          club_name: clubData?.name || '',
          club_logo_url: clubData?.logo_url || null,
          club_city: clubData?.city || null,
          court_name: courtData?.name || null,
          court_type: courtData?.type || null,
          players: enrichedPlayers,
          club_payment_method: clubData?.payment_method || 'at_club',
        })
      }
      setLoading(false)
    }

    fetchGame()
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchGame()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [gameId])

  if (loading || !game) {
    return (
      <div className={`border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm ${fullWidth ? 'w-full' : 'flex-shrink-0 w-[360px] sm:w-[400px]'}`}>
        <div className="p-5 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
          <div className="flex gap-3 justify-center mb-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-16 h-16 bg-gray-200 rounded-full"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const confirmedPlayers = game.players.filter(p => p.status === 'confirmed')
  const isInGame = game.players.some(p => p.user_id === userId || p.player_account_id === playerAccountId)
  const isCreator = game.creator_user_id === userId || game.players.some(p => p.position === 1 && (p.user_id === userId || p.player_account_id === playerAccountId))

  const refetchGame = async () => {
    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase.from('open_games').select('*').eq('id', gameId).maybeSingle()
    if (data) {
      const { data: playersData } = await supabase
        .from('open_game_players')
        .select('*')
        .eq('game_id', gameId)
        .eq('status', 'confirmed')
        .order('position')
      const uIds = [...new Set((playersData || []).map((p2: any) => p2.user_id).filter(Boolean))]
      const paIds = [...new Set((playersData || []).map((p2: any) => p2.player_account_id).filter(Boolean))]
      let acctMap: { [key: string]: any } = {}
      if (uIds.length > 0 || paIds.length > 0) {
        const rQueries: Promise<any>[] = []
        if (paIds.length > 0) rQueries.push(supabase.from('player_accounts').select('id, user_id, name, avatar_url, level, player_category').in('id', paIds))
        if (uIds.length > 0) rQueries.push(supabase.from('player_accounts').select('id, user_id, name, avatar_url, level, player_category').in('user_id', uIds))
        const rResults = await Promise.all(rQueries)
        rResults.forEach(({ data: accts }) => { if (accts) accts.forEach((a: any) => { if (a.user_id) acctMap[a.user_id] = a; acctMap[a.id] = a }) })
      }
      const enriched = (playersData || []).map((p2: any) => {
        const acct = acctMap[p2.player_account_id] || acctMap[p2.user_id]
        return { ...p2, name: acct?.name || t.common.player, avatar_url: acct?.avatar_url || null, level: acct?.level || null, player_category: acct?.player_category || null }
      })
      const { data: clubData } = await supabase.from('clubs').select('name, logo_url, city, payment_method').eq('id', data.club_id).single()
      let courtData2 = null
      if (data.court_id) {
        const { data: cr } = await supabase.from('club_courts').select('name, type').eq('id', data.court_id).single()
        courtData2 = cr
      }
      setGame({
        ...data,
        club_name: clubData?.name || '',
        club_logo_url: clubData?.logo_url || null,
        club_city: clubData?.city || null,
        court_name: courtData2?.name || null,
        court_type: courtData2?.type || null,
        players: enriched,
        club_payment_method: clubData?.payment_method || 'at_club',
      })
    }
  }

  const handleRemovePlayerFromGame = async (p: any) => {
    const playerName = (p.name || '').split(' ')[0] || t.common.player
    if (!confirm((t.games.removePlayerConfirm || 'Remover {name} do jogo?').replace('{name}', playerName))) return
    setActionLoading(true)
    const { removePlayerFromOpenGame } = await import('../../lib/openGames')
    const success = await removePlayerFromOpenGame({
      gameId: game.id,
      playerId: p.id,
      playerAccountId: p.player_account_id,
      playerName: p.name,
    })
    setActionLoading(false)
    if (success) {
      await refetchGame()
      await onRefresh()
    } else {
      alert(t.games.removePlayerError || 'Erro ao remover jogador')
    }
  }

  const handleLeaveGame = async () => {
    if (!confirm(t.games.leaveConfirm)) return
    setActionLoading(true)
    const { leaveOpenGame } = await import('../../lib/openGames')
    const success = await leaveOpenGame(game.id, userId || '')
    setActionLoading(false)
    if (success) {
      await onRefresh()
    } else {
      alert(t.common.leaveGameError)
    }
  }

  const handleCancelGame = async () => {
    if (!confirm(t.games.cancelConfirm)) return
    setActionLoading(true)
    const { cancelOpenGame } = await import('../../lib/openGames')
    const success = await cancelOpenGame(game.id)
    setActionLoading(false)
    if (success) {
      await onRefresh()
    } else {
      alert(t.common.cancelGameError)
    }
  }

  const handleLeaveGameCreator = async () => {
    if (!confirm(t.games.leaveConfirmCreator)) return
    setActionLoading(true)
    const { leaveOpenGame } = await import('../../lib/openGames')
    const success = await leaveOpenGame(game.id, userId || '')
    setActionLoading(false)
    if (success) {
      await onRefresh()
    } else {
      alert(t.common.leaveGameError)
    }
  }

  const handleSearchPlayer = async (query: string) => {
    setAddPlayerSearch(query)
    if (query.length < 2) {
      setAddPlayerResults([])
      return
    }
    setSearchLoading(true)
    const { searchPlayerAccounts } = await import('../../lib/openGames')
    const results = await searchPlayerAccounts(query)
    // Filter out players already in the game
    const existingIds = new Set(game.players.map(p => p.player_account_id).filter(Boolean))
    setAddPlayerResults(results.filter(r => !existingIds.has(r.id)))
    setSearchLoading(false)
  }

  const handleAddPlayer = async (paId: string) => {
    const selectedPlayer = addPlayerResults.find(r => r.id === paId)
    setAddingPlayer(true)
    const { addPlayerToOpenGame } = await import('../../lib/openGames')
    const result = await addPlayerToOpenGame({ gameId: game.id, playerAccountId: paId, position: addPlayerTargetPosition ?? undefined })
    setAddingPlayer(false)
    if (result.success) {
      setShowAddPlayer(false)
      setAddPlayerTargetPosition(null)
      setAddPlayerSearch('')
      setAddPlayerResults([])
      await refetchGame()
      await onRefresh()
    } else {
      alert(result.error || t.common.addPlayerError)
    }
  }

  const formatGameDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const isTomorrow = d.toDateString() === new Date(now.getTime() + 86400000).toDateString()

    const dayStr = isToday ? 'Hoje' : isTomorrow ? 'Amanhã' : d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
    const timeStr = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    return `${dayStr}, ${timeStr}`
  }

  return (
    <div className={`border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm ${fullWidth ? 'w-full' : 'flex-shrink-0 w-[360px] sm:w-[400px]'}`}>
      <div className="p-5">
        {/* Date & Time */}
        <p className="font-bold text-gray-900 text-sm mb-1">
          {formatGameDate(game.scheduled_at)}
        </p>
        
        {/* Game Type & Level Range */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 flex-wrap">
          <span className="flex items-center gap-1">
            {game.game_type === 'competitive' ? '🏆' : '🤝'}
          </span>
          <span className="flex items-center gap-1">
            📊 {game.level_min.toFixed(2)}-{game.level_max.toFixed(2)}
          </span>
        </div>

        {/* Player circles */}
        <div className="flex items-start gap-3 mb-3">
          {/* Left team - Positions 1 and 2 */}
          <div className="flex gap-3 flex-1 justify-center">
            {[1, 2].map(pos => {
              const p = confirmedPlayers.find(pl => pl.position === pos)
              if (p) {
                const pColors = levelColors(p.level)
                const isMe = p.user_id === userId || p.player_account_id === playerAccountId
                const canRemove = isCreator && !isMe && !actionLoading
                return (
                  <div key={p.id} className="flex flex-col items-center relative group">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    {canRemove && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemovePlayerFromGame(p) }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                        title={t.games.removePlayer}
                      >
                        ✕
                      </button>
                    )}
                    <span className="text-[11px] text-gray-700 font-medium mt-1.5 truncate max-w-[70px] text-center leading-tight" title={p.name}>{p.name || ''}</span>
                    {p.level != null && (
                      <div className="mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: pColors?.hex || '#9ca3af' }}>
                        {p.level.toFixed(2)}
                      </div>
                    )}
                  </div>
                )
              } else {
                return (
                  <div 
                    key={`empty-${pos}`} 
                    className={`flex flex-col items-center ${isInGame ? 'cursor-pointer' : ''}`}
                    onClick={isInGame ? () => { setAddPlayerTargetPosition(pos); setShowAddPlayer(true) } : undefined}
                  >
                    <div className={`w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-colors ${isInGame ? 'border-blue-400 hover:border-blue-500 hover:bg-blue-50' : 'border-gray-300'}`}>
                      <UserPlus className={`w-6 h-6 ${isInGame ? 'text-blue-500' : 'text-gray-400'}`} />
                    </div>
                    <span className={`text-[10px] font-medium mt-1.5 ${isInGame ? 'text-blue-600' : 'text-gray-400'}`}>{isInGame ? t.common.add : t.common.free}</span>
                  </div>
                )
              }
            })}
          </div>
          
          {/* Divider */}
          <div className="w-px h-20 bg-gray-200 self-center" />
          
          {/* Right team - Positions 3 and 4 */}
          <div className="flex gap-3 flex-1 justify-center">
            {[3, 4].map(pos => {
              const p = confirmedPlayers.find(pl => pl.position === pos)
              if (p) {
                const pColors = levelColors(p.level)
                const isMe = p.user_id === userId || p.player_account_id === playerAccountId
                const canRemove = isCreator && !isMe && !actionLoading
                return (
                  <div key={p.id} className="flex flex-col items-center relative group">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    {canRemove && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemovePlayerFromGame(p) }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                        title={t.games.removePlayer}
                      >
                        ✕
                      </button>
                    )}
                    <span className="text-[11px] text-gray-700 font-medium mt-1.5 truncate max-w-[70px] text-center leading-tight" title={p.name}>{p.name || ''}</span>
                    {p.level != null && (
                      <div className="mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: pColors?.hex || '#9ca3af' }}>
                        {p.level.toFixed(2)}
                      </div>
                    )}
                  </div>
                )
              } else {
                return (
                  <div 
                    key={`empty-${pos}`} 
                    className={`flex flex-col items-center ${isInGame ? 'cursor-pointer' : ''}`}
                    onClick={isInGame ? () => { setAddPlayerTargetPosition(pos); setShowAddPlayer(true) } : undefined}
                  >
                    <div className={`w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-colors ${isInGame ? 'border-blue-400 hover:border-blue-500 hover:bg-blue-50' : 'border-gray-300'}`}>
                      <UserPlus className={`w-6 h-6 ${isInGame ? 'text-blue-500' : 'text-gray-400'}`} />
                    </div>
                    <span className={`text-[10px] font-medium mt-1.5 ${isInGame ? 'text-blue-600' : 'text-gray-400'}`}>{isInGame ? t.common.add : t.common.free}</span>
                  </div>
                )
              }
            })}
          </div>
        </div>
      </div>

      {/* Add Player Search Panel */}
      {showAddPlayer && (
        <div className="border-t border-gray-100 px-4 py-3 bg-blue-50/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700">
              {t.games.addPlayer ?? 'Adicionar jogador'}
              {addPlayerTargetPosition != null && (
                <span className="ml-1 text-blue-600">
                  ({addPlayerTargetPosition <= 2 ? t.games.team1 ?? 'Equipa 1' : t.games.team2 ?? 'Equipa 2'})
                </span>
              )}
            </p>
            <button 
              onClick={() => { setShowAddPlayer(false); setAddPlayerTargetPosition(null); setAddPlayerSearch(''); setAddPlayerResults([]) }}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar por nome..."
              value={addPlayerSearch}
              onChange={(e) => handleSearchPlayer(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              autoFocus
            />
          </div>
          {searchLoading && (
            <p className="text-xs text-gray-500 mt-2 text-center">{t.games.searching}</p>
          )}
          {addPlayerResults.length > 0 && (
            <div className="mt-2 max-h-[150px] overflow-y-auto space-y-1">
              {addPlayerResults.map(r => {
                const rColors = levelColors(r.level)
                return (
                  <button
                    key={r.id}
                    onClick={() => handleAddPlayer(r.id)}
                    disabled={addingPlayer}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-blue-100 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {r.avatar_url ? (
                        <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-gray-600">{r.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                    </div>
                    {r.level != null && (
                      <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: rColors?.hex || '#9ca3af' }}>
                        {r.level.toFixed(2)}
                      </span>
                    )}
                    <UserPlus className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  </button>
                )
              })}
            </div>
          )}
          {addPlayerSearch.length >= 2 && !searchLoading && addPlayerResults.length === 0 && (
            <p className="text-xs text-gray-500 mt-2 text-center">{t.games.noPlayersFound}</p>
          )}
        </div>
      )}

      {/* Club & Price footer */}
      <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-2">
          {game.club_logo_url ? (
            <img src={game.club_logo_url} alt="" className="w-6 h-6 rounded-lg object-cover" />
          ) : (
            <div className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center">
              <Building2 className="w-3 h-3 text-gray-400" />
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-gray-900 truncate max-w-[120px]">{game.club_name}</p>
          </div>
        </div>
        <div className="text-right">
          {game.price_per_player > 0 && (
            <p className="text-sm font-bold text-blue-600">{game.price_per_player.toFixed(2)}€</p>
          )}
          {(() => {
            const myP = game.players.find(p => p.user_id === userId || p.player_account_id === playerAccountId)
            if (myP?.payment_status === 'paid') {
              return <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">✅ Pago</span>
            }
            if (game.club_payment_method && game.club_payment_method !== 'at_club' && game.price_per_player > 0) {
              return <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">💳 Online</span>
            }
            return null
          })()}
        </div>
      </div>

      {/* Pay online button */}
      {isInGame && (() => {
        const myP = game.players.find(p => p.user_id === userId || p.player_account_id === playerAccountId)
        return myP?.payment_status !== 'paid' && game.club_payment_method && game.club_payment_method !== 'at_club' && game.price_per_player > 0
      })() && (
        <div className="px-4 pb-2 pt-0">
          <button
            onClick={async () => {
              if (!playerAccountId) return
              try {
                const { supabase } = await import('../../lib/supabase')
                const { data: checkoutData, error: checkoutErr } = await supabase.functions.invoke('create-game-checkout', {
                  body: {
                    gameId: game.id,
                    paymentType: 'per_player',
                    playerAccountId,
                    successUrl: window.location.origin,
                    cancelUrl: window.location.origin,
                  },
                })
                if (!checkoutErr && checkoutData?.url) {
                  window.location.href = checkoutData.url
                } else {
                  alert(t.common.paymentError)
                }
              } catch (e) {
                alert('Erro ao iniciar pagamento.')
              }
            }}
            className="w-full py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            💳 Pagar {game.price_per_player.toFixed(2)}€
          </button>
        </div>
      )}

      {/* Actions */}
      {isInGame && (
        <div className="px-4 pb-3 pt-0 bg-gray-50/50 space-y-2">
          {/* Everyone can leave */}
          <button
            onClick={isCreator ? handleLeaveGameCreator : handleLeaveGame}
            disabled={actionLoading}
            className="w-full py-2 rounded-xl text-sm font-semibold text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors disabled:opacity-50"
          >
            {actionLoading ? '...' : '🚪 Sair do jogo'}
          </button>
          {/* Creator can also cancel */}
          {isCreator && (
            <button
              onClick={handleCancelGame}
              disabled={actionLoading}
              className="w-full py-1.5 rounded-xl text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              ❌ Cancelar jogo
            </button>
          )}
        </div>
      )}
    </div>
  )
}

