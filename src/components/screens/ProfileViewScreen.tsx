import { useState, useEffect, useMemo } from 'react'
import { ChevronRight, TrendingUp, Target, Building2, Users } from 'lucide-react'
import { useI18n } from '../../lib/i18nContext'
import { supabase, type PlayerAccount } from '../../lib/supabase'
import type { PlayerDashboardData } from '../../lib/playerDashboardData'
import {
  getFollowingCount,
  getFollowersCount,
  levelColors,
  getInitials,
} from '../../lib/communityData'
import { getCachedPlayerData } from '../../lib/playerDataCache'
import { fetchClubById } from '../../lib/clubAndTournaments'
import { fetchLevelHistory, type LevelHistoryEntry } from '../../lib/levelHistory'
import { getPartnerNamesFromMatch, isLikelyTeamLabel } from '../../lib/matchPlayerNames'
import { GameCardPlaytomic, shortPlayerLabel } from '../shared/matchUi'

export default function ProfileViewScreen({
  player,
  dashboardData,
  userId,
  onOpenGames,
  onOpenFollowsList,
  onOpenPlayerProfile,
}: {
  player: PlayerAccount | null
  dashboardData: PlayerDashboardData | null
  userId: string | null
  onOpenGames: (tab?: 'upcoming' | 'history') => void
  onOpenFollowsList: (userId: string) => void
  onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
}) {
  const { t } = useI18n()
  const d = dashboardData
  const totalMatches = d?.stats?.totalMatches ?? 0
  const wins = d?.stats?.wins ?? 0
  const draws = d?.stats?.draws ?? 0
  const losses = d?.stats?.losses ?? 0
  const winRate = d?.stats?.winRate ?? 0
  const bio = player?.bio || ''
  const [followingCount, setFollowingCount] = useState(0)
  const [followersCount, setFollowersCount] = useState(0)
  useEffect(() => {
    if (!userId) return
    getFollowingCount(userId).then(setFollowingCount)
    getFollowersCount(userId).then(setFollowersCount)
  }, [userId])
  const truncatedBio = bio.length > 160 ? bio.substring(0, 160) + '...' : bio
  const recentMatches = (d?.recentMatches ?? []).slice(0, 5)
  const upcomingMatches = (d?.upcomingMatches ?? []).slice(0, 5)

  const handlePlayerClick = async (playerName: string) => {
    if (!playerName || isLikelyTeamLabel(playerName)) return
    const { findPlayerAccountByName } = await import('../../lib/classes')
    const acc = await findPlayerAccountByName(playerName)
    if (acc?.user_id) {
      onOpenPlayerProfile(acc.user_id, { accountId: acc.id, nameHint: playerName })
    }
  }

  // Jogadores com quem mais joga (extrair de todos os jogos recentes)
  const allRecentMatches = d?.recentMatches ?? []
  const playerCountMap = new Map<string, number>()
  allRecentMatches.forEach((match) => {
    getPartnerNamesFromMatch(match, player?.name).forEach((name) => {
      if (isLikelyTeamLabel(name)) return
      playerCountMap.set(name, (playerCountMap.get(name) || 0) + 1)
    })
  })
  const topPlayers = Array.from(playerCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))
  
  // Avatares dos top players (do cache global — sem queries adicionais)
  const topPlayersAvatars: Record<string, string | null> = {}
  topPlayers.forEach(({ name }) => {
    const cached = getCachedPlayerData(name)
    if (cached?.avatar_url) topPlayersAvatars[name] = cached.avatar_url
  })

  // Clubes onde joga (favorito + dos torneios)
  const [clubsWherePlays, setClubsWherePlays] = useState<ClubDetail[]>([])
  useEffect(() => {
    let active = true
    ;(async () => {
      const list: ClubDetail[] = []
      const seenIds = new Set<string>()

      // Clube favorito
      const favId = player?.favorite_club_id ?? localStorage.getItem('padel_one_player_favorite_club_id')
      if (favId && typeof favId === 'string') {
        const club = await fetchClubById(favId)
        if (club && active && !seenIds.has(club.id)) {
          list.push(club)
          seenIds.add(club.id)
        }
      }

      // Clubes dos torneios onde jogou
      const tournamentIds = new Set<string>()
      ;(d?.recentMatches ?? []).forEach((m) => m.tournament_id && tournamentIds.add(m.tournament_id))
      ;(d?.pastTournaments ?? []).forEach((t) => t.id && tournamentIds.add(t.id))
      ;(d?.upcomingTournaments ?? []).forEach((t) => t.id && tournamentIds.add(t.id))

      if (tournamentIds.size > 0) {
        const { data: tournaments } = await supabase
          .from('tournaments')
          .select('club_id')
          .in('id', Array.from(tournamentIds))
        const clubIds = [...new Set((tournaments || []).map((t: any) => t.club_id).filter(Boolean))]
        for (const cid of clubIds) {
          if (seenIds.has(cid)) continue
          const club = await fetchClubById(cid)
          if (club && active) {
            list.push(club)
            seenIds.add(club.id)
          }
        }
      }

      if (active) setClubsWherePlays(list)
    })()
    return () => { active = false }
  }, [player?.favorite_club_id, d?.recentMatches, d?.pastTournaments, d?.upcomingTournaments])

  // Categoria de idade (de 5 em 5 anos: +55, +60, etc.)
  const getAgeCategory = (): string | null => {
    const bd = player?.birth_date
    if (!bd) return null
    const birth = new Date(bd)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    if (age < 18) return null
    const cat = Math.floor(age / 5) * 5
    return `+${cat}`
  }
  const ageCategory = getAgeCategory()

  // --- Level Evolution Chart ---
  const [levelHistory, setLevelHistory] = useState<LevelHistoryEntry[]>([])

  useEffect(() => {
    if (!player?.id) return
    fetchLevelHistory(player.id, 50).then(setLevelHistory)
  }, [player?.id, player?.level, player?.rated_matches, recentMatches.length])

  const levelChartData = useMemo(() => {
    const currentLevel = player?.level ?? 3.0
    const TARGET = 5

    // Prefer last 5 completed matches so draws (is_winner === null) always appear.
    const completedMatches = [...recentMatches]
      .filter(m => m.status === 'completed' && (m.is_winner === true || m.is_winner === false || m.is_winner === null))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    const lastMatches = completedMatches.slice(-TARGET)

    const historyBySource = new Map<string, LevelHistoryEntry>()
    if (levelHistory.length > 0) {
      for (const h of [...levelHistory].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())) {
        if (h.source_id) historyBySource.set(String(h.source_id), h)
      }
    }

    if (lastMatches.length > 0) {
      const totalRated = (player?.wins ?? 0) + (player?.losses ?? 0)
      const K = totalRated < 5 ? 0.50 : totalRated < 10 ? 0.35 : totalRated < 20 ? 0.25 : totalRated < 40 ? 0.15 : totalRated < 60 ? 0.10 : 0.06
      const baseDelta = K * 0.4

      const points = lastMatches.map((m) => {
        const hist = m.id ? historyBySource.get(String(m.id).replace(/^open_result_/, '')) || historyBySource.get(String(m.id)) : undefined
        const openId = (m as any).open_game_id ? historyBySource.get(String((m as any).open_game_id)) : undefined
        const h = hist || openId
        const won = m.is_winner === true ? true : m.is_winner === false ? false : null
        const delta = h
          ? Number(h.delta)
          : won === true
            ? baseDelta
            : won === false
              ? -baseDelta
              : 0
        return {
          match: m,
          won,
          delta,
          levelAfter: h ? Number(h.level_after) : null as number | null,
          levelBefore: h ? Number(h.level_before) : null as number | null,
          date: new Date(m.start_time || h?.created_at || Date.now()),
          matchType: (m.is_open_game ? 'open_game' : 'tournament') as 'open_game' | 'tournament',
        }
      })

      // Walk levels backwards from current when history missing for some points
      let runLvl = currentLevel
      for (let i = points.length - 1; i >= 0; i--) {
        if (points[i].levelAfter == null) {
          points[i].levelAfter = runLvl
          points[i].levelBefore = Math.max(0.5, parseFloat((runLvl - points[i].delta).toFixed(2)))
          runLvl = points[i].levelBefore
        } else {
          runLvl = points[i].levelBefore ?? Math.max(0.5, parseFloat((Number(points[i].levelAfter) - points[i].delta).toFixed(2)))
        }
      }

      return points.map((p, i) => ({
        index: i,
        level: i === points.length - 1 ? currentLevel : Number(p.levelAfter),
        levelBefore: Number(p.levelBefore ?? p.levelAfter),
        delta: parseFloat(Number(p.delta).toFixed(4)),
        won: p.won,
        date: p.date,
        matchType: p.matchType,
      }))
    }

    // Fallback: levelHistory only (no recent match list)
    if (levelHistory.length > 0) {
      const bySource = new Map<string, LevelHistoryEntry>()
      const noSource: LevelHistoryEntry[] = []
      for (const h of [...levelHistory].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())) {
        if (h.source_id) bySource.set(`${h.source_id}:${h.player_account_id}`, h)
        else noSource.push(h)
      }
      const sorted = [...noSource, ...bySource.values()]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(-TARGET)

      return sorted.map((h, i) => ({
        index: i,
        level: i === sorted.length - 1 ? currentLevel : h.level_after,
        levelBefore: h.level_before,
        delta: h.delta,
        won: h.match_won,
        date: new Date(h.created_at),
        matchType: h.match_type,
      }))
    }

    return [{ index: 0, level: currentLevel, levelBefore: currentLevel, delta: 0, won: null as boolean | null, date: new Date(), matchType: 'tournament' as const }]
  }, [levelHistory, recentMatches, player?.level, player?.wins, player?.losses])

  const getHandLabel = (h?: string) => ({ right: 'Direita', left: 'Esquerda', ambidextrous: 'Ambidestro' }[h || ''] || '—')
  const getPositionLabel = (p?: string) => ({ right: 'Direita', left: 'Esquerda', both: 'Ambas' }[p || ''] || '—')
  const getGameTypeLabel = (g?: string) => ({ competitive: 'Competitivo', friendly: 'Amigável', both: 'Ambos' }[g || ''] || '—')
  const getTimeLabel = (timeStr?: string) => ({ morning: t.common.morning, afternoon: t.common.afternoon, evening: t.common.evening, all_day: t.common.allDay }[timeStr || ''] || '—')

  const splitName = (fullName: string): { firstName: string; lastName: string } => {
    const parts = fullName.trim().split(/\s+/)
    if (parts.length === 1) return { firstName: parts[0], lastName: '' }
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Profile Card - Foto + Nome + Bio (igual à Home) */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            {player?.avatar_url ? (
              <img src={player.avatar_url} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-4 border-red-100" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-padel flex items-center justify-center">
                <span className="text-white font-bold text-2xl">{player?.name?.charAt(0)?.toUpperCase() || 'P'}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-xl text-gray-900">{player?.name || 'Jogador'}</h2>
            {truncatedBio && <p className="text-sm text-gray-600 mt-1 leading-relaxed">{truncatedBio}</p>}
          </div>
        </div>
      </div>

      {/* Nível + Fiabilidade + Categoria + Idade */}
      {(() => {
        const colors = levelColors(player?.level)
        const hasGradient = colors && colors.hex !== '#e5e7eb'
        const bgStyle = hasGradient 
          ? { background: `linear-gradient(135deg, ${colors.hex} 0%, ${colors.hexTo} 100%)` }
          : {}

        return (
          <div 
            className={`rounded-xl shadow-sm overflow-hidden p-6 ${!hasGradient ? 'bg-gradient-to-br from-red-50 to-red-100' : ''}`}
            style={bgStyle}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className={`text-5xl font-bold ${hasGradient ? 'text-white' : 'text-red-600'}`}>
                  Nível {player?.level?.toFixed(2) || '3.00'}
                </p>
                <p className={`text-sm mt-2 flex items-center gap-1.5 ${hasGradient ? 'text-white/90' : 'text-gray-600'}`}>
                  <span>📊</span> Fiabilidade {player?.level_reliability_percent?.toFixed(0) ?? '85'}%
                </p>
              </div>
              <div className="flex flex-col gap-2 self-start">
                {ageCategory && (
                  <div className="px-4 py-2 bg-amber-500 rounded-lg shadow-sm">
                    <span className="text-sm font-bold text-white">{ageCategory}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Evolução do nível — gráfico inspirado no Playtomic */}
      {(() => {
        const data = levelChartData
        if (data.length === 0) return null

        const W = 320
        const H = 160
        const PAD_L = 42
        const PAD_R = 14
        const PAD_T = 16
        const PAD_B = 28
        const chartW = W - PAD_L - PAD_R
        const chartH = H - PAD_T - PAD_B

        const levels = data.map(d => d.level)
        const minLvl = Math.floor((Math.min(...levels) - 0.1) * 10) / 10
        const maxLvl = Math.ceil((Math.max(...levels) + 0.1) * 10) / 10
        const range = maxLvl - minLvl || 0.2

        const toX = (i: number) => PAD_L + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2)
        const toY = (lvl: number) => PAD_T + chartH - ((lvl - minLvl) / range) * chartH

        const gridLines: number[] = []
        const step = range <= 0.3 ? 0.05 : range <= 0.6 ? 0.1 : 0.2
        for (let v = Math.ceil(minLvl / step) * step; v <= maxLvl; v = parseFloat((v + step).toFixed(2))) gridLines.push(v)

        const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.level).toFixed(1)}`).join(' ')
        const areaD = pathD + ` L${toX(data.length - 1).toFixed(1)},${(PAD_T + chartH).toFixed(1)} L${toX(0).toFixed(1)},${(PAD_T + chartH).toFixed(1)} Z`

        const last = data[data.length - 1]
        const first = data[0]
        const totalDelta = last.level - first.levelBefore
        const isPositive = totalDelta >= 0

        return (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Evolução do nível
              </h3>
              {data.length > 1 && (
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {isPositive ? '+' : ''}{totalDelta.toFixed(2)}
                </span>
              )}
            </div>

            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 200 }}>
              <defs>
                <linearGradient id="levelAreaGradProfile" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {gridLines.map(v => (
                <g key={v}>
                  <line x1={PAD_L} y1={toY(v)} x2={W - PAD_R} y2={toY(v)} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3,3" />
                  <text x={PAD_L - 4} y={toY(v) + 3} textAnchor="end" fill="#9ca3af" fontSize="8" fontFamily="system-ui">{v.toFixed(2)}</text>
                </g>
              ))}

              {data.length > 1 && <path d={areaD} fill="url(#levelAreaGradProfile)" />}
              {data.length > 1 && <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}

              {data.map((d, i) => (
                <g key={i}>
                  <circle cx={toX(i)} cy={toY(d.level)} r={i === data.length - 1 ? 5 : 3} fill={d.won === true ? '#22c55e' : d.won === false ? '#ef4444' : '#f59e0b'} stroke="white" strokeWidth="1.5" />
                  {i === data.length - 1 && (
                    <>
                      <rect x={toX(i) - 16} y={toY(d.level) - 20} width="32" height="14" rx="4" fill="#3b82f6" />
                      <text x={toX(i)} y={toY(d.level) - 10.5} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="system-ui">{d.level.toFixed(2)}</text>
                    </>
                  )}
                </g>
              ))}

              {data.length > 1 && data.map((d, i) => {
                const dateStr = `${d.date.getDate()}/${d.date.getMonth() + 1}`
                return i % Math.max(1, Math.floor(data.length / 5)) === 0 || i === data.length - 1 ? (
                  <text key={`d${i}`} x={toX(i)} y={H - 4} textAnchor="middle" fill="#9ca3af" fontSize="7" fontFamily="system-ui">{dateStr}</text>
                ) : null
              })}
            </svg>

            {data.length > 1 && (
              <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Vitória</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Empate</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Derrota</span>
              </div>
            )}

            {levelHistory.length === 0 && recentMatches.length > 0 && (
              <p className="text-[10px] text-gray-400 text-center mt-1 italic">Valores estimados com base nos resultados recentes</p>
            )}
          </div>
        )
      })()}

      {/* Estatísticas - Jogos, Vitórias, %, Derrotas, Seguidores */}
      <div className="grid grid-cols-5 gap-2">
        <div className="card p-3 text-center">
          <p className="text-lg mb-0.5">🎾</p>
          <p className="text-xl font-bold text-gray-900">{totalMatches}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Jogos</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg mb-0.5">🏆</p>
          <p className="text-xl font-bold text-green-600">{wins}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Vitórias</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg mb-0.5">📊</p>
          <p className="text-xl font-bold text-blue-600">{winRate}%</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Vitórias %</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg mb-0.5">📉</p>
          <p className="text-xl font-bold text-red-600">{losses}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Derrotas</p>
        </div>
        <div className="card p-3 text-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => userId && onOpenFollowsList(userId)}>
          <p className="text-lg mb-0.5">❤️</p>
          <p className="text-xl font-bold text-red-600">{followersCount}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Seguidores</p>
        </div>
      </div>

      {/* Preferências do jogador */}
      <div className="card p-5">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-red-600" />
          Preferências de jogador
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-0.5">Mão dominante</p>
            <p className="font-medium text-gray-900">{getHandLabel(player?.preferred_hand)}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-0.5">Posição no campo</p>
            <p className="font-medium text-gray-900">{getPositionLabel(player?.court_position)}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-0.5">Tipo de jogo</p>
            <p className="font-medium text-gray-900">{getGameTypeLabel(player?.game_type)}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-0.5">Horário preferido</p>
            <p className="font-medium text-gray-900">{getTimeLabel(player?.preferred_time)}</p>
          </div>
        </div>
      </div>

      {/* Próximos Jogos */}
      {upcomingMatches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>📅</span> Próximos Jogos
            </h2>
            {upcomingMatches.length > 3 && (
              <button onClick={() => onOpenGames('upcoming')} className="text-red-600 text-sm font-medium flex items-center gap-1">
                Ver todos <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth games-horizontal-scroll">
            <div className="flex gap-4" style={{ width: 'max-content' }}>
              {upcomingMatches.map((match) => (
                <div key={match.id} className="snap-center">
                  <GameCardPlaytomic match={match} currentPlayerAvatar={player?.avatar_url} currentPlayerName={player?.name} onPlayerClick={handlePlayerClick} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5 Últimos Jogos - Resultados Recentes (igual à Home) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>📊</span> Resultados Recentes
          </h2>
          {recentMatches.length > 0 && (
            <button onClick={() => onOpenGames('history')} className="text-red-600 text-sm font-medium flex items-center gap-1">
              Ver todos <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
        {recentMatches.length > 0 ? (
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth games-horizontal-scroll">
            <div className="flex gap-4" style={{ width: 'max-content' }}>
              {recentMatches.map((match) => (
                <div key={match.id} className="snap-center">
                  <GameCardPlaytomic match={match} currentPlayerAvatar={player?.avatar_url} currentPlayerName={player?.name} onPlayerClick={handlePlayerClick} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-6 text-center">
            <span className="text-4xl mb-2 block">🎾</span>
            <p className="text-gray-700 font-medium">Sem jogos recentes</p>
            <p className="text-sm text-gray-500 mt-1">Os resultados aparecerão aqui</p>
          </div>
        )}
      </div>

      {/* Jogadores com quem mais joga */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-red-600" />
          {t.learn.playersYouPlayWith}
        </h2>
        {topPlayers.length > 0 ? (
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth">
            <div className="flex gap-3" style={{ width: 'max-content' }}>
              {topPlayers.map(({ name, count }) => {
                const display = shortPlayerLabel(name)
                return (
                <div 
                  key={name} 
                  className="snap-center flex-shrink-0 w-[100px] card p-3 text-center cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handlePlayerClick(name)}
                >
                  <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center mx-auto mb-2 overflow-hidden">
                    {topPlayersAvatars[name] ? (
                      <img src={topPlayersAvatars[name]!} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-sm">{getInitials(name)}</span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 text-xs leading-tight">{display}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{count} jogos</p>
                </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="card p-4 text-center">
            <p className="text-sm text-gray-500">Os jogadores com quem jogas aparecerão aqui</p>
          </div>
        )}
      </div>

      {/* Clubes onde joga [nome] */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-red-600" />
          {t.learn.clubsYouPlayAt} {player?.name?.split(' ')[0] || t.common.player.toLowerCase()}
        </h2>
        {clubsWherePlays.length > 0 ? (
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth">
            <div className="flex gap-3" style={{ width: 'max-content' }}>
              {clubsWherePlays.map((club) => (
                <div key={club.id} className={`snap-center flex-shrink-0 w-[160px] card overflow-hidden p-0 ${club.plan_type === 'preview' ? 'border-amber-200' : ''}`}>
                  <div className="h-20 bg-gray-100 flex items-center justify-center">
                    {club.logo_url ? (
                      <img src={club.logo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-10 h-10 text-gray-400" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-gray-900 text-sm truncate" title={club.name}>{club.name}</p>
                    {club.plan_type === 'preview' && (
                      <p className="text-[10px] text-amber-700 mt-1 leading-tight">Clube ainda não ativo na Padel One</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-4 text-center">
            <p className="text-sm text-gray-500">Os clubes onde jogas aparecerão aqui</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Perfil de Edição - Para Definições ----------
