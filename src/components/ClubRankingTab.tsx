import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Search, Trophy } from 'lucide-react'
import { levelColors } from '../lib/communityData'
import {
  fetchRolling12mRankings,
  type Rolling12mEntry,
} from '../lib/rankingEngine'
import { findDefaultRankingClub } from '../lib/playerRankings'
import { useI18n } from '../lib/i18nContext'

type Scope = 'club' | 'global'

const HELP_LEVELS_URL = 'https://padel1.app/help/#niveis'

export default function ClubRankingTab({
  organizationId: organizationIdProp,
  organizationName: organizationNameProp,
  userId,
  onOpenPlayerProfile,
}: {
  /** Club / organization scope. Se omitido, usa Albufeira Padel Clube. */
  organizationId?: string | null
  organizationName?: string | null
  userId?: string | null
  onOpenPlayerProfile?: (userId: string, opts?: { nameHint?: string | null }) => void
}) {
  const { t } = useI18n()
  const [scope, setScope] = useState<Scope>('club')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [club, setClub] = useState<{ id: string; name: string } | null>(
    organizationIdProp
      ? { id: organizationIdProp, name: organizationNameProp || 'Albufeira Padel Clube' }
      : null,
  )
  const [search, setSearch] = useState('')
  const [deferredSearch, setDeferredSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<Rolling12mEntry[]>([])

  useEffect(() => {
    if (organizationIdProp) {
      setClub({
        id: organizationIdProp,
        name: organizationNameProp || 'Albufeira Padel Clube',
      })
      return
    }
    findDefaultRankingClub().then((c) => {
      if (c) setClub(c)
    })
  }, [organizationIdProp, organizationNameProp])

  useEffect(() => {
    const tmr = window.setTimeout(() => setDeferredSearch(search), 200)
    return () => window.clearTimeout(tmr)
  }, [search])

  useEffect(() => {
    let active = true
    setLoading(true)
    const load = async () => {
      try {
        const data = await fetchRolling12mRankings({
          organizationId: scope === 'club' ? club?.id : null,
          global: scope === 'global',
          search: deferredSearch,
          gender,
          limit: 150,
        })
        if (active) setEntries(data)
      } catch (err) {
        console.error('[ClubRankingTab] load error:', err)
        if (active) setEntries([])
      } finally {
        if (active) setLoading(false)
      }
    }
    if (scope === 'club' && !club?.id) {
      setLoading(false)
      setEntries([])
      return () => {
        active = false
      }
    }
    load()
    return () => {
      active = false
    }
  }, [scope, club?.id, deferredSearch, gender])

  const clubRankingLabel = useMemo(() => {
    const name = club?.name || 'Albufeira Padel Clube'
    return `Ranking ${name}`
  }, [club?.name])

  const subtitle = useMemo(() => {
    if (scope === 'global') return 'Ranking Global Padel ONE — todos os torneios e jogos (12 meses)'
    return `${clubRankingLabel} — todos os torneios e jogos (12 meses)`
  }, [scope, clubRankingLabel])

  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
        <button
          type="button"
          onClick={() => setScope('club')}
          disabled={!club}
          className={`flex-1 py-2 px-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors disabled:opacity-40 leading-snug ${
            scope === 'club' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          {clubRankingLabel}
        </button>
        <button
          type="button"
          onClick={() => setScope('global')}
          className={`flex-1 py-2 px-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors leading-snug ${
            scope === 'global' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          Ranking Global Padel ONE
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setGender('male')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
            gender === 'male'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          👨 {t.rankings.male}
        </button>
        <button
          type="button"
          onClick={() => setGender('female')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
            gender === 'female'
              ? 'bg-pink-600 text-white border-pink-600'
              : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          👩 {t.rankings.female}
        </button>
      </div>

      <p className="text-xs text-gray-500 flex items-center gap-1.5">
        <Trophy className="w-3.5 h-3.5 text-amber-500" />
        {subtitle}
      </p>

      <a
        href={HELP_LEVELS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700"
      >
        Saber mais sobre os níveis
        <ExternalLink className="w-3.5 h-3.5" />
      </a>

      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por nome..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-300"
        />
      </div>

      {loading ? (
        <div className="card p-10 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-500">A carregar ranking 12 meses...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="card p-8 text-center">
          <span className="text-4xl block mb-2">📊</span>
          <p className="text-gray-600 font-medium">Sem pontos nos últimos 12 meses</p>
          <p className="text-xs text-gray-400 mt-1">
            Torneios e jogos validados geram pontos automaticamente.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[2.5rem_1fr_3.25rem_3.5rem_2.75rem] gap-1 px-3 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            <span>Pos.</span>
            <span>Jogador</span>
            <span className="text-right">ELO</span>
            <span className="text-right">Pts</span>
            <span className="text-right">Evt</span>
          </div>
          <div className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <RollingRow
                key={`${entry.user_id}-${entry.organization_id || 'g'}-${gender}`}
                entry={entry}
                isMe={!!userId && entry.user_id === userId}
                onOpenPlayerProfile={onOpenPlayerProfile}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RollingRow({
  entry,
  isMe,
  onOpenPlayerProfile,
}: {
  entry: Rolling12mEntry
  isMe: boolean
  onOpenPlayerProfile?: (userId: string, opts?: { nameHint?: string | null }) => void
}) {
  const colors = levelColors(entry.level || 0)
  const podium =
    entry.position === 1 ? '🥇' : entry.position === 2 ? '🥈' : entry.position === 3 ? '🥉' : null

  return (
    <button
      type="button"
      onClick={() => onOpenPlayerProfile?.(entry.user_id, { nameHint: entry.name })}
      className={`w-full grid grid-cols-[2.5rem_1fr_3.25rem_3.5rem_2.75rem] gap-1 px-3 py-3 items-center text-left transition-colors ${
        isMe ? 'bg-rose-50' : 'hover:bg-gray-50'
      } ${entry.position <= 3 ? 'bg-amber-50/40' : ''}`}
    >
      <span
        className={`text-sm font-bold ${
          entry.position <= 3 ? 'text-base' : 'text-gray-500'
        }`}
      >
        {podium || entry.position}
      </span>
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
          {entry.avatar_url ? (
            <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-600">
              {(entry.name || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <span className={`text-sm font-medium truncate ${isMe ? 'text-rose-700' : 'text-gray-900'}`}>
          {entry.name}
          {isMe ? ' (tu)' : ''}
        </span>
      </div>
      <span
        className="text-xs font-bold text-right rounded-md px-1.5 py-0.5 justify-self-end"
        style={{ color: colors.hex, backgroundColor: `${colors.hex}18` }}
      >
        {(entry.level || 0).toFixed(2)}
      </span>
      <span className="text-sm font-bold text-gray-900 text-right tabular-nums">
        {entry.total_points}
      </span>
      <span className="text-xs text-gray-500 text-right tabular-nums">{entry.total_events}</span>
    </button>
  )
}
