import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronRight,
  Crown,
  History,
  Loader2,
  Lock,
  Trophy,
  Users,
} from 'lucide-react'
import {
  duoLabel,
  fetchClubLeagueBundle,
  formatDuoScore,
  playerNameById,
  type ClubLeagueBundle,
  type ClubLeagueConfrontationRow,
  type ClubLeagueTeamRow,
} from '../../lib/clubLeagueData'
import ClubLeagueLineupModal, {
  isLineupLocked,
  isLineupPublic,
  lineupLockAt,
} from '../ClubLeagueLineupModal'

type Tab = 'teams' | 'standings' | 'calendar' | 'history'
type CalendarMode = 'matchdays' | 'teams'

type Props = {
  tournamentId: string
  tournamentName: string
  categories?: { id: string; name: string }[]
  playerAccountId?: string | null
  onBack: () => void
}

function confrontationScore(c: ClubLeagueConfrontationRow): string {
  if (c.status !== 'completed') return c.status === 'scheduled' ? 'Agendado' : c.status
  return `${c.home_duos_won}–${c.away_duos_won}`
}

export default function ClubLeagueScreen({
  tournamentId,
  tournamentName,
  categories = [],
  playerAccountId = null,
  onBack,
}: Props) {
  const [tab, setTab] = useState<Tab>('calendar')
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('teams')
  const [calendarTeamId, setCalendarTeamId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bundle, setBundle] = useState<ClubLeagueBundle | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categories[0]?.id ?? null)
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null)
  const [expandedConfrontationId, setExpandedConfrontationId] = useState<string | null>(null)
  const [lineupCtx, setLineupCtx] = useState<{
    confrontation: ClubLeagueConfrontationRow
    team: ClubLeagueTeamRow
  } | null>(null)

  useEffect(() => {
    if (!selectedCategory && categories[0]?.id) setSelectedCategory(categories[0].id)
  }, [categories, selectedCategory])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchClubLeagueBundle(tournamentId, selectedCategory)
      setBundle(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar a liga')
    } finally {
      setLoading(false)
    }
  }, [tournamentId, selectedCategory])

  useEffect(() => {
    void load()
  }, [load])

  const teamById = useMemo(() => {
    const m = new Map<string, ClubLeagueTeamRow>()
    ;(bundle?.teams || []).forEach((t) => m.set(t.id, t))
    return m
  }, [bundle])

  const captainTeamIds = useMemo(() => {
    const ids = new Set<string>()
    if (!playerAccountId) return ids
    for (const team of bundle?.teams || []) {
      const roster = team.club_league_players || []
      const me = roster.find((p) => p.player_account_id === playerAccountId)
      const flaggedCaptain = roster.some(
        (p) => p.is_captain && p.player_account_id === playerAccountId
      )
      const captainByFk =
        Boolean(team.captain_player_id) &&
        roster.some(
          (p) => p.id === team.captain_player_id && p.player_account_id === playerAccountId
        )
      if (flaggedCaptain || captainByFk || (me?.is_captain ?? false)) ids.add(team.id)
    }
    return ids
  }, [bundle, playerAccountId])

  const myCaptainTeam = useMemo(() => {
    for (const id of captainTeamIds) {
      const t = teamById.get(id)
      if (t) return t
    }
    return null
  }, [captainTeamIds, teamById])

  useEffect(() => {
    if (myCaptainTeam && calendarMode === 'teams') {
      setCalendarTeamId(myCaptainTeam.id)
    }
  }, [myCaptainTeam?.id])

  const names = useMemo(() => playerNameById(bundle?.teams || []), [bundle])

  const rankedStandings = useMemo(() => {
    return [...(bundle?.standings || [])].sort((a, b) => {
      if ((a.position || 999) !== (b.position || 999)) return (a.position || 999) - (b.position || 999)
      return b.points - a.points
    })
  }, [bundle])

  const confrontationsByMatchday = useMemo(() => {
    const map = new Map<string, ClubLeagueConfrontationRow[]>()
    for (const c of bundle?.confrontations || []) {
      const key = c.matchday_id || 'none'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return map
  }, [bundle])

  const matchdayById = useMemo(() => {
    const m = new Map<string, NonNullable<typeof bundle>['matchdays'][number]>()
    ;(bundle?.matchdays || []).forEach((md) => m.set(md.id, md))
    return m
  }, [bundle])

  useEffect(() => {
    const teams = bundle?.teams || []
    if (teams.length === 0) {
      setCalendarTeamId(null)
      return
    }
    if (!calendarTeamId || !teams.some((t) => t.id === calendarTeamId)) {
      setCalendarTeamId(teams[0].id)
    }
  }, [bundle, calendarTeamId])

  const teamCalendar = useMemo(() => {
    if (!calendarTeamId || !bundle) return []
    return bundle.confrontations
      .filter((c) => c.home_team_id === calendarTeamId || c.away_team_id === calendarTeamId)
      .map((c) => {
        const md = c.matchday_id ? matchdayById.get(c.matchday_id) : undefined
        const isHome = c.home_team_id === calendarTeamId
        const opponentId = isHome ? c.away_team_id : c.home_team_id
        const sortTime = c.scheduled_time
          ? new Date(c.scheduled_time).getTime()
          : md?.matchday_date
            ? new Date(md.matchday_date + 'T12:00:00').getTime()
            : (md?.matchday_number || 0) * 1e12
        return { c, md, isHome, opponentId, sortTime }
      })
      .sort((a, b) => {
        if (a.sortTime !== b.sortTime) return a.sortTime - b.sortTime
        return (a.md?.matchday_number || 0) - (b.md?.matchday_number || 0)
      })
  }, [bundle, calendarTeamId, matchdayById])

  const gamesByConfrontation = useMemo(() => {
    const map = new Map<string, NonNullable<typeof bundle>['games']>()
    for (const g of bundle?.games || []) {
      if (!map.has(g.confrontation_id)) map.set(g.confrontation_id, [])
      map.get(g.confrontation_id)!.push(g)
    }
    for (const list of map.values()) list.sort((a, b) => a.game_order - b.game_order)
    return map
  }, [bundle])

  const lineupsByConfrontationTeam = useMemo(() => {
    const map = new Map<string, NonNullable<typeof bundle>['lineups'][number]>()
    for (const l of bundle?.lineups || []) {
      map.set(`${l.confrontation_id}:${l.team_id}`, l)
    }
    return map
  }, [bundle])

  const nextCaptainMatch = useMemo(() => {
    if (!myCaptainTeam || !bundle) return null
    const now = Date.now()
    const upcoming = bundle.confrontations
      .filter(
        (c) =>
          (c.home_team_id === myCaptainTeam.id || c.away_team_id === myCaptainTeam.id) &&
          c.status !== 'completed'
      )
      .map((c) => {
        const md = c.matchday_id ? matchdayById.get(c.matchday_id) : undefined
        const sortTime = c.scheduled_time
          ? new Date(c.scheduled_time).getTime()
          : md?.matchday_date
            ? new Date(md.matchday_date + 'T12:00:00').getTime()
            : Number.MAX_SAFE_INTEGER
        return { c, md, sortTime }
      })
      .sort((a, b) => a.sortTime - b.sortTime)

    const next =
      upcoming.find((x) => !x.c.scheduled_time || x.sortTime >= now - 3 * 60 * 60 * 1000) ||
      upcoming[0] ||
      null
    if (!next) return null
    const isHome = next.c.home_team_id === myCaptainTeam.id
    const opponentId = isHome ? next.c.away_team_id : next.c.home_team_id
    return {
      ...next,
      isHome,
      opponent: opponentId ? teamById.get(opponentId) : null,
      hasLineup: Boolean(lineupsByConfrontationTeam.get(`${next.c.id}:${myCaptainTeam.id}`)),
      locked: isLineupLocked(next.c.scheduled_time),
    }
  }, [myCaptainTeam, bundle, matchdayById, teamById, lineupsByConfrontationTeam])

  const completedMatchdays = useMemo(() => {
    return (bundle?.matchdays || []).filter((md) => {
      const list = confrontationsByMatchday.get(md.id) || []
      return list.some((c) => c.status === 'completed')
    })
  }, [bundle, confrontationsByMatchday])

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'teams', label: 'Equipas', icon: Users },
    { id: 'standings', label: 'Classificação', icon: Trophy },
    { id: 'calendar', label: 'Calendário', icon: Calendar },
    { id: 'history', label: 'Histórico', icon: History },
  ]

  const renderLineupStatus = (
    c: ClubLeagueConfrontationRow,
    teamId: string | null | undefined,
    sideLabel: string
  ) => {
    if (!teamId) return null
    const lineup = lineupsByConfrontationTeam.get(`${c.id}:${teamId}`)
    const publicNow = isLineupPublic(c.scheduled_time)
    const lock = lineupLockAt(c.scheduled_time)
    const iAmCaptain = captainTeamIds.has(teamId)

    if (lineup && (publicNow || iAmCaptain)) {
      return (
        <div className="text-xs text-gray-700 space-y-0.5">
          <p className="font-medium text-gray-900">
            {sideLabel}
            {!publicNow && iAmCaptain ? (
              <span className="ml-1 text-amber-700 font-normal">(secreta para adversários)</span>
            ) : null}
          </p>
          <p>D1: {duoLabel(lineup, names, 1)}</p>
          <p>D2: {duoLabel(lineup, names, 2)}</p>
          <p>D3: {duoLabel(lineup, names, 3)}</p>
        </div>
      )
    }

    if (!publicNow) {
      return (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          {sideLabel}: secreta
          {lock
            ? ` até ${lock.toLocaleString('pt-PT', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23',
              })}`
            : ''}
        </p>
      )
    }

    return <p className="text-xs text-gray-500">{sideLabel}: lineup ainda não submetida</p>
  }

  const renderCaptainLineupButton = (c: ClubLeagueConfrontationRow) => {
    const myTeamId = c.home_team_id && captainTeamIds.has(c.home_team_id)
      ? c.home_team_id
      : c.away_team_id && captainTeamIds.has(c.away_team_id)
        ? c.away_team_id
        : null
    if (!myTeamId) return null
    const team = teamById.get(myTeamId)
    if (!team) return null
    const hasLineup = Boolean(lineupsByConfrontationTeam.get(`${c.id}:${myTeamId}`))
    const locked = isLineupLocked(c.scheduled_time)

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setLineupCtx({ confrontation: c, team })
        }}
        className={`w-full mt-2 px-3 py-2.5 rounded-xl text-sm font-semibold ${
          locked
            ? 'bg-gray-100 text-gray-600 border border-gray-200'
            : 'bg-red-600 text-white shadow-sm'
        }`}
      >
        {locked
          ? hasLineup
            ? 'Ver lineup (bloqueada)'
            : 'Lineup bloqueada (T−30)'
          : hasLineup
            ? 'Editar / resubmeter duplas'
            : 'Montar duplas (lineup)'}
      </button>
    )
  }

  const renderConfrontationGames = (c: ClubLeagueConfrontationRow) => {
    const homeLineup = c.home_team_id
      ? lineupsByConfrontationTeam.get(`${c.id}:${c.home_team_id}`)
      : undefined
    const awayLineup = c.away_team_id
      ? lineupsByConfrontationTeam.get(`${c.id}:${c.away_team_id}`)
      : undefined
    const games = gamesByConfrontation.get(c.id) || []
    const publicNow = isLineupPublic(c.scheduled_time)

    return (
      <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-3">
        <div className="space-y-2">
          {renderLineupStatus(c, c.home_team_id, 'Casa')}
          {renderLineupStatus(c, c.away_team_id, 'Fora')}
        </div>
        {renderCaptainLineupButton(c)}
        {games.length === 0 ? (
          publicNow && homeLineup && awayLineup ? (
            <p className="text-xs text-gray-500 text-center py-1">Sem resultados de duplas ainda.</p>
          ) : null
        ) : (
          games.map((g) => {
            const which = g.game_type === 'duo2' ? 2 : g.game_type === 'duo3' ? 3 : 1
            return (
              <div key={g.id} className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wide">
                      Dupla {which}
                    </p>
                    <p className="text-xs text-gray-800">
                      <span className="text-gray-500">Casa:</span>{' '}
                      {duoLabel(homeLineup, names, which as 1 | 2 | 3)}
                    </p>
                    <p className="text-xs text-gray-800">
                      <span className="text-gray-500">Fora:</span>{' '}
                      {duoLabel(awayLineup, names, which as 1 | 2 | 3)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 shrink-0">{formatDuoScore(g)}</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    )
  }

  const renderConfrontationDetail = (c: ClubLeagueConfrontationRow) => {
    const home = c.home_team_id ? teamById.get(c.home_team_id) : null
    const away = c.away_team_id ? teamById.get(c.away_team_id) : null
    const expanded = expandedConfrontationId === c.id
    const isMyMatch =
      (c.home_team_id && captainTeamIds.has(c.home_team_id)) ||
      (c.away_team_id && captainTeamIds.has(c.away_team_id))

    return (
      <div key={c.id} className="border border-gray-100 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setExpandedConfrontationId(expanded ? null : c.id)}
          className="w-full p-3 flex items-center justify-between gap-2 text-left hover:bg-gray-50"
        >
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">
              {home?.name || '?'} <span className="text-gray-400 font-normal">vs</span> {away?.name || '?'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {c.scheduled_time
                ? new Date(c.scheduled_time).toLocaleString('pt-PT', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Sem hora'}
              {c.venue ? ` · ${c.venue}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`px-2 py-1 rounded-lg text-xs font-bold ${
                c.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {confrontationScore(c)}
            </span>
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </button>

        {isMyMatch && !expanded && (
          <div className="px-3 pb-3">{renderCaptainLineupButton(c)}</div>
        )}
        {expanded && renderConfrontationGames(c)}
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-5 h-5" /> Voltar
      </button>

      <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-2xl p-5 text-white">
        <p className="text-xs uppercase tracking-wide text-red-100 mb-1">Liga de Clubes</p>
        <h1 className="text-xl font-bold leading-tight">{tournamentName}</h1>
        <p className="text-sm text-red-100 mt-2">
          {(bundle?.teams || []).length} clubes inscritos
        </p>
        {myCaptainTeam && (
          <p className="text-xs text-red-50 mt-2 bg-white/10 rounded-lg px-3 py-2">
            És capitão de <strong>{myCaptainTeam.name}</strong>. A lineup fica secreta até 30 min
            antes do jogo.
          </p>
        )}
      </div>

      {!loading && myCaptainTeam && nextCaptainMatch && (
        <div className="card p-4 border-2 border-red-200 bg-red-50/40 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600">
              Próximo jogo · {myCaptainTeam.name}
            </p>
            <h2 className="text-base font-bold text-gray-900 mt-1">
              {nextCaptainMatch.isHome ? 'Casa' : 'Fora'} vs{' '}
              {nextCaptainMatch.opponent?.name || '?'}
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              {nextCaptainMatch.md?.label ||
                (nextCaptainMatch.md
                  ? `Jornada ${nextCaptainMatch.md.matchday_number}`
                  : 'Jornada')}
              {' · '}
              {nextCaptainMatch.c.scheduled_time
                ? new Date(nextCaptainMatch.c.scheduled_time).toLocaleString('pt-PT', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    hourCycle: 'h23',
                  })
                : 'Hora a definir'}
              {nextCaptainMatch.c.venue ? ` · ${nextCaptainMatch.c.venue}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setLineupCtx({ confrontation: nextCaptainMatch.c, team: myCaptainTeam })
            }
            className={`w-full px-4 py-3 rounded-xl text-sm font-bold ${
              nextCaptainMatch.locked
                ? 'bg-gray-200 text-gray-600'
                : 'bg-red-600 text-white shadow'
            }`}
          >
            {nextCaptainMatch.locked
              ? nextCaptainMatch.hasLineup
                ? 'Ver lineup (já bloqueada)'
                : 'Lineup bloqueada (T−30)'
              : nextCaptainMatch.hasLineup
                ? 'Editar / resubmeter as minhas duplas'
                : 'Montar as minhas duplas para este jogo'}
          </button>
        </div>
      )}

      {!loading && Boolean(playerAccountId) && !myCaptainTeam && (bundle?.teams || []).length > 0 && (
        <div className="bg-amber-50 text-amber-900 text-sm px-3 py-2 rounded-xl">
          Não foste detetado como capitão neste torneio. Se és capitão, pede ao organizador para
          ligar a tua conta ao plantel.
        </div>
      )}

      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 text-sm rounded-full font-medium ${
                selectedCategory === c.id
                  ? 'bg-red-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl whitespace-nowrap font-medium ${
              tab === id ? 'bg-red-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-red-600" />
        </div>
      ) : (
        <>
          {tab === 'teams' && (
            <div className="space-y-3">
              {(bundle?.teams || []).length === 0 ? (
                <div className="card p-6 text-center text-gray-500 text-sm">
                  Ainda sem clubes inscritos.
                </div>
              ) : (
                (bundle?.teams || []).map((team) => {
                  const roster = team.club_league_players || []
                  const open = expandedTeamId === team.id
                  return (
                    <div key={team.id} className="card overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedTeamId(open ? null : team.id)}
                        className="w-full p-4 flex items-center justify-between gap-3 text-left"
                      >
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{team.name}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {roster.length} jogadores
                            {roster.find((p) => p.is_captain)
                              ? ` · Capitão: ${roster.find((p) => p.is_captain)!.name}`
                              : ''}
                          </p>
                        </div>
                        {open ? (
                          <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                        )}
                      </button>
                      {open && (
                        <div className="border-t border-gray-100 px-4 pb-4 pt-2 space-y-2">
                          {roster.length === 0 ? (
                            <p className="text-sm text-gray-500">Plantel por completar.</p>
                          ) : (
                            roster.map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between gap-2 py-2 border-b border-gray-50 last:border-0"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {p.is_captain && (
                                    <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                                  )}
                                  <span className="text-sm font-medium text-gray-900 truncate">
                                    {p.name}
                                  </span>
                                </div>
                                <span className="text-sm font-bold text-red-600 shrink-0">
                                  {Number(p.fpp_points)} FPP
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {tab === 'standings' && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Classificação geral
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Vitória 3 pts · Derrota 1 pt · Desempate H2H
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Clube</th>
                      <th className="px-3 py-2 text-center">J</th>
                      <th className="px-3 py-2 text-center">V</th>
                      <th className="px-3 py-2 text-center">D</th>
                      <th className="px-3 py-2 text-center">Sets</th>
                      <th className="px-3 py-2 text-center">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedStandings.map((row) => (
                      <tr key={row.id} className="border-t border-gray-100">
                        <td className="px-3 py-2.5 font-semibold text-gray-500">
                          {row.position ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-900">
                          {teamById.get(row.team_id)?.name || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center">{row.played}</td>
                        <td className="px-3 py-2.5 text-center">{row.won}</td>
                        <td className="px-3 py-2.5 text-center">{row.lost}</td>
                        <td className="px-3 py-2.5 text-center">
                          {row.sets_won}-{row.sets_lost}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-red-600">
                          {row.points}
                        </td>
                      </tr>
                    ))}
                    {rankedStandings.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                          Sem classificação ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'calendar' && (
            <div className="space-y-4">
              {(bundle?.matchdays || []).length === 0 ? (
                <div className="card p-6 text-center text-gray-500 text-sm">
                  Calendário ainda não gerado.
                </div>
              ) : (
                <>
                  <div className="card p-3 space-y-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCalendarMode('teams')}
                        className={`flex-1 px-3 py-2 text-sm rounded-xl font-medium ${
                          calendarMode === 'teams'
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-50 text-gray-700 border border-gray-200'
                        }`}
                      >
                        Por equipa
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalendarMode('matchdays')}
                        className={`flex-1 px-3 py-2 text-sm rounded-xl font-medium ${
                          calendarMode === 'matchdays'
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-50 text-gray-700 border border-gray-200'
                        }`}
                      >
                        Por jornadas
                      </button>
                    </div>

                    {calendarMode === 'teams' && (
                      <div className="flex flex-wrap gap-2">
                        {(bundle?.teams || []).map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setCalendarTeamId(t.id)}
                            className={`px-3 py-1.5 text-xs rounded-full font-medium ${
                              calendarTeamId === t.id
                                ? 'bg-red-100 text-red-800 border border-red-300'
                                : 'bg-white text-gray-700 border border-gray-200'
                            }`}
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {calendarMode === 'teams' ? (
                    <div className="card p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {calendarTeamId ? teamById.get(calendarTeamId)?.name : 'Equipa'}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {teamCalendar.length} jogo{teamCalendar.length === 1 ? '' : 's'} · casa e fora
                        </p>
                      </div>
                      {teamCalendar.length === 0 ? (
                        <p className="text-sm text-gray-500">Sem jogos para esta equipa.</p>
                      ) : (
                        <div className="space-y-2">
                          {teamCalendar.map(({ c, md, isHome, opponentId }) => {
                            const opponent = opponentId ? teamById.get(opponentId) : null
                            const expanded = expandedConfrontationId === c.id
                            return (
                              <div
                                key={c.id}
                                className="border border-gray-100 rounded-xl overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedConfrontationId(expanded ? null : c.id)
                                  }
                                  className="w-full p-3 flex items-center justify-between gap-2 text-left hover:bg-gray-50"
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <span
                                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                          isHome
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-sky-100 text-sky-800'
                                        }`}
                                      >
                                        {isHome ? 'Casa' : 'Fora'}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {md?.label ||
                                          (md ? `Jornada ${md.matchday_number}` : 'Jornada')}
                                      </span>
                                    </div>
                                    <p className="font-semibold text-gray-900 text-sm truncate">
                                      vs {opponent?.name || '?'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {c.scheduled_time
                                        ? new Date(c.scheduled_time).toLocaleString('pt-PT', {
                                            day: '2-digit',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })
                                        : 'Sem hora'}
                                      {c.venue ? ` · ${c.venue}` : ''}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span
                                      className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                        c.status === 'completed'
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-gray-100 text-gray-600'
                                      }`}
                                    >
                                      {confrontationScore(c)}
                                    </span>
                                    {expanded ? (
                                      <ChevronDown className="w-4 h-4 text-gray-400" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-gray-400" />
                                    )}
                                  </div>
                                </button>
                                {calendarTeamId &&
                                  captainTeamIds.has(calendarTeamId) &&
                                  !expanded && (
                                    <div className="px-3 pb-3">{renderCaptainLineupButton(c)}</div>
                                  )}
                                {expanded && renderConfrontationGames(c)}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    (bundle?.matchdays || []).map((md) => {
                      const list = confrontationsByMatchday.get(md.id) || []
                      return (
                        <div key={md.id} className="card p-4 space-y-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {md.label || `Jornada ${md.matchday_number}`}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {md.matchday_date
                                ? new Date(md.matchday_date + 'T12:00:00').toLocaleDateString(
                                    'pt-PT',
                                    {
                                      weekday: 'short',
                                      day: '2-digit',
                                      month: 'short',
                                    }
                                  )
                                : 'Data a definir'}
                              {' · '}
                              {md.leg === 'away' ? 'Volta' : 'Ida'}
                            </p>
                          </div>
                          <div className="space-y-2">
                            {list.length === 0 ? (
                              <p className="text-xs text-gray-500">Sem confrontos nesta jornada.</p>
                            ) : (
                              list.map((c) => renderConfrontationDetail(c))
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-4">
              {completedMatchdays.length === 0 ? (
                <div className="card p-6 text-center text-gray-500 text-sm">
                  Ainda sem jornadas concluídas.
                </div>
              ) : (
                completedMatchdays.map((md) => {
                  const list = (confrontationsByMatchday.get(md.id) || []).filter(
                    (c) => c.status === 'completed'
                  )
                  return (
                    <div key={md.id} className="card p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {md.label || `Jornada ${md.matchday_number}`}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Resultados · {list.length} confronto{list.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="space-y-2">{list.map((c) => renderConfrontationDetail(c))}</div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </>
      )}

      {lineupCtx && (
        <ClubLeagueLineupModal
          confrontation={lineupCtx.confrontation}
          team={lineupCtx.team}
          onClose={() => setLineupCtx(null)}
          onSuccess={() => {
            setLineupCtx(null)
            void load()
          }}
        />
      )}
    </div>
  )
}
