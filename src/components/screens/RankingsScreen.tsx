import { useState, useEffect } from 'react'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import { useI18n } from '../../lib/i18nContext'
import { levelColors } from '../../lib/communityData'

export default function RankingsScreen({
  userId,
  playerAccountId,
  onBack,
  onOpenPlayerProfile,
}: {
  userId: string | null
  playerAccountId: string | null
  onBack: () => void
  onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
}) {
  const { t } = useI18n()
  const [scope, setScope] = useState<'general' | 'club'>('general')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [loading, setLoading] = useState(true)
  const [rankings, setRankings] = useState<import('../../lib/playerRankings').RankingsByGender>({ male: [], female: [] })
  const [club, setClub] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    import('../../lib/playerRankings').then(({ findDefaultRankingClub }) => {
      findDefaultRankingClub().then(setClub)
    })
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    const load = async () => {
      try {
        const { fetchGlobalRankings, fetchClubRankings } = await import('../../lib/playerRankings')
        const data = scope === 'general'
          ? await fetchGlobalRankings()
          : club
            ? await fetchClubRankings(club.id)
            : { male: [], female: [] }
        if (active) setRankings(data)
      } catch (err) {
        console.error('[RankingsScreen] load error:', err)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [scope, club?.id])

  const list = gender === 'male' ? rankings.male : rankings.female

  const positionBadge = (pos: number) => {
    if (pos === 1) return '🥇'
    if (pos === 2) return '🥈'
    if (pos === 3) return '🥉'
    return String(pos)
  }

  return (
    <div className="space-y-4 animate-fade-in pb-8">
      <button type="button" onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-5 h-5" /> {t.common.back}
      </button>

      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-rose-500" />
          {t.rankings.title}
        </h1>
        <p className="text-xs text-gray-500 mt-1">{t.rankings.basedOnLevel}</p>
      </div>

      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
        <button
          type="button"
          onClick={() => setScope('general')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${scope === 'general' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
        >
          {t.rankings.general}
        </button>
        <button
          type="button"
          onClick={() => setScope('club')}
          disabled={!club}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${scope === 'club' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'} disabled:opacity-40`}
        >
          {club ? club.name : t.rankings.byClub}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setGender('male')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${gender === 'male' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
        >
          👨 {t.rankings.male}
        </button>
        <button
          type="button"
          onClick={() => setGender('female')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${gender === 'female' ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-600 border-gray-200'}`}
        >
          👩 {t.rankings.female}
        </button>
      </div>

      {loading ? (
        <div className="card p-10 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-500">{t.rankings.loading}</p>
        </div>
      ) : list.length === 0 ? (
        <div className="card p-8 text-center">
          <span className="text-4xl block mb-2">📊</span>
          <p className="text-gray-600 font-medium">{t.rankings.noPlayers}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[3rem_1fr_4rem] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase">
            <span>{t.rankings.position}</span>
            <span>{t.rankings.player}</span>
            <span className="text-right">{t.rankings.level}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {list.map((entry) => {
              const isMe = entry.id === playerAccountId || (entry.user_id && entry.user_id === userId)
              return (
                <RankingRow
                  key={entry.id}
                  entry={entry}
                  isMe={!!isMe}
                  positionBadge={positionBadge(entry.position)}
                  onOpenPlayerProfile={onOpenPlayerProfile}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function RankingRow({
  entry,
  isMe,
  positionBadge,
  onOpenPlayerProfile,
}: {
  entry: import('../../lib/playerRankings').RankingEntry
  isMe: boolean
  positionBadge: string
  onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
}) {
  const colors = levelColors(entry.level)

  return (
    <button
      type="button"
      onClick={() => entry.user_id && onOpenPlayerProfile(entry.user_id)}
      disabled={!entry.user_id}
      className={`w-full grid grid-cols-[3rem_1fr_4rem] gap-2 px-4 py-3 items-center text-left transition-colors ${isMe ? 'bg-rose-50' : 'hover:bg-gray-50'} ${!entry.user_id ? 'cursor-default' : ''}`}
    >
      <span className={`text-sm font-bold ${entry.position <= 3 ? 'text-lg' : 'text-gray-500'}`}>
        {positionBadge}
      </span>
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
          {entry.avatar_url ? (
            <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200 text-xs font-bold text-gray-600">
              {(entry.name || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <span className={`text-sm font-medium truncate ${isMe ? 'text-rose-700' : 'text-gray-900'}`}>
          {entry.name}{isMe ? ' (tu)' : ''}
        </span>
      </div>
      <span
        className="text-sm font-bold text-right rounded-lg px-2 py-0.5 justify-self-end"
        style={{ color: colors.hex, backgroundColor: `${colors.hex}18` }}
      >
        {entry.level.toFixed(2)}
      </span>
    </button>
  )
}

