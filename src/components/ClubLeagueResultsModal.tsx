import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Save, Trophy, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  duoLabel,
  playerNameById,
  type ClubLeagueConfrontationRow,
  type ClubLeagueGameRow,
  type ClubLeagueLineupRow,
  type ClubLeagueTeamRow,
} from '../lib/clubLeagueData'
import {
  duoMatchSets,
  emptyDuoScores,
  needsStb,
  type DuoScores,
} from '../lib/clubLeagueStandings'

type Props = {
  confrontation: ClubLeagueConfrontationRow
  homeTeam: ClubLeagueTeamRow | null | undefined
  awayTeam: ClubLeagueTeamRow | null | undefined
  homeLineup?: ClubLeagueLineupRow | null
  awayLineup?: ClubLeagueLineupRow | null
  existingGames?: ClubLeagueGameRow[]
  onClose: () => void
  onSuccess: () => void
}

function ScoreRow({
  title,
  homeNames,
  awayNames,
  scores,
  setScores,
}: {
  title: string
  homeNames: string
  awayNames: string
  scores: DuoScores
  setScores: (d: DuoScores) => void
}) {
  const stb = needsStb(scores)
  const num = (v: number | '', key: keyof DuoScores) => (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      value={v}
      onChange={(e) =>
        setScores({
          ...scores,
          [key]: e.target.value === '' ? '' : Number(e.target.value),
        })
      }
      className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-center text-sm bg-white"
    />
  )

  return (
    <div className="border border-gray-100 rounded-xl p-3 space-y-2.5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600">{title}</p>
        <p className="text-sm font-medium text-gray-900 mt-0.5 leading-snug">{homeNames}</p>
        <p className="text-xs text-gray-400 my-0.5">vs</p>
        <p className="text-sm font-medium text-gray-900 leading-snug">{awayNames}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="w-16 text-gray-500 text-xs">Set 1</span>
        {num(scores.homeSet1, 'homeSet1')}
        <span className="text-gray-400">-</span>
        {num(scores.awaySet1, 'awaySet1')}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="w-16 text-gray-500 text-xs">Set 2</span>
        {num(scores.homeSet2, 'homeSet2')}
        <span className="text-gray-400">-</span>
        {num(scores.awaySet2, 'awaySet2')}
      </div>
      {stb && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-16 text-amber-700 text-xs font-medium">Super TB</span>
          {num(scores.homeStb, 'homeStb')}
          <span className="text-gray-400">-</span>
          {num(scores.awayStb, 'awayStb')}
        </div>
      )}
    </div>
  )
}

export default function ClubLeagueResultsModal({
  confrontation,
  homeTeam,
  awayTeam,
  homeLineup = null,
  awayLineup = null,
  existingGames = [],
  onClose,
  onSuccess,
}: Props) {
  const [duo1, setDuo1] = useState<DuoScores>(emptyDuoScores())
  const [duo2, setDuo2] = useState<DuoScores>(emptyDuoScores())
  const [duo3, setDuo3] = useState<DuoScores>(emptyDuoScores())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const names = useMemo(
    () => playerNameById([homeTeam, awayTeam].filter(Boolean) as ClubLeagueTeamRow[]),
    [homeTeam, awayTeam]
  )

  const duoTitles = useMemo(() => {
    const label = (which: 1 | 2 | 3, side: 'home' | 'away') => {
      const lineup = side === 'home' ? homeLineup : awayLineup
      return duoLabel(lineup ?? undefined, names, which)
    }
    return {
      1: { home: label(1, 'home'), away: label(1, 'away') },
      2: { home: label(2, 'home'), away: label(2, 'away') },
      3: { home: label(3, 'home'), away: label(3, 'away') },
    }
  }, [homeLineup, awayLineup, names])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        let games = existingGames
        if (games.length === 0) {
          const { data } = await supabase
            .from('club_league_games')
            .select('*')
            .eq('confrontation_id', confrontation.id)
          games = (data || []) as ClubLeagueGameRow[]
        }
        const apply = (g: ClubLeagueGameRow, setter: (d: DuoScores) => void) => {
          setter({
            homeSet1: g.home_set1 ?? '',
            awaySet1: g.away_set1 ?? '',
            homeSet2: g.home_set2 ?? '',
            awaySet2: g.away_set2 ?? '',
            homeStb: g.home_stb ?? '',
            awayStb: g.away_stb ?? '',
          })
        }
        for (const g of games) {
          if (g.game_type === 'duo1') apply(g, setDuo1)
          if (g.game_type === 'duo2') apply(g, setDuo2)
          if (g.game_type === 'duo3') apply(g, setDuo3)
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [confrontation.id, existingGames])

  const parseDuo = (d: DuoScores, label: string) => {
    if (d.homeSet1 === '' || d.awaySet1 === '' || d.homeSet2 === '' || d.awaySet2 === '') {
      throw new Error(`Preenche os 2 sets de ${label}`)
    }
    const stbNeeded = needsStb(d)
    if (stbNeeded && (d.homeStb === '' || d.awayStb === '')) {
      throw new Error(`Preenche o Super TB de ${label}`)
    }
    const result = duoMatchSets(
      Number(d.homeSet1),
      Number(d.awaySet1),
      Number(d.homeSet2),
      Number(d.awaySet2),
      stbNeeded ? Number(d.homeStb) : null,
      stbNeeded ? Number(d.awayStb) : null
    )
    if (!result.winner) throw new Error(`Resultado incompleto em ${label}`)
    return result
  }

  const handleSave = async () => {
    setError('')
    if (!homeTeam || !awayTeam) {
      setError('Equipas em falta')
      return
    }

    try {
      parseDuo(duo1, 'Dupla 1')
      parseDuo(duo2, 'Dupla 2')
      parseDuo(duo3, 'Dupla 3')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Resultado inválido')
      return
    }

    const stbNull = (d: DuoScores) => (needsStb(d) ? Number(d.homeStb) : null)
    const stbNullA = (d: DuoScores) => (needsStb(d) ? Number(d.awayStb) : null)

    setSaving(true)
    try {
      const { error: rpcError } = await supabase.rpc('submit_club_league_results', {
        p_confrontation_id: confrontation.id,
        p_d1_h1: Number(duo1.homeSet1),
        p_d1_a1: Number(duo1.awaySet1),
        p_d1_h2: Number(duo1.homeSet2),
        p_d1_a2: Number(duo1.awaySet2),
        p_d1_hstb: stbNull(duo1),
        p_d1_astb: stbNullA(duo1),
        p_d2_h1: Number(duo2.homeSet1),
        p_d2_a1: Number(duo2.awaySet1),
        p_d2_h2: Number(duo2.homeSet2),
        p_d2_a2: Number(duo2.awaySet2),
        p_d2_hstb: stbNull(duo2),
        p_d2_astb: stbNullA(duo2),
        p_d3_h1: Number(duo3.homeSet1),
        p_d3_a1: Number(duo3.awaySet1),
        p_d3_h2: Number(duo3.homeSet2),
        p_d3_a2: Number(duo3.awaySet2),
        p_d3_hstb: stbNull(duo3),
        p_d3_astb: stbNullA(duo3),
      })
      if (rpcError) throw rpcError
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('not_authorized')) {
        setError('Só jogadores das duas equipas deste jogo podem submeter o resultado.')
      } else if (msg.includes('stb_required')) {
        setError('Falta o Super Tie-Break (sets 1-1).')
      } else if (msg.includes('sets_incomplete')) {
        setError('Preenche os 2 sets das 3 duplas.')
      } else if (msg.includes('set_tie_not_allowed') || msg.includes('stb_tie_not_allowed')) {
        setError('Não pode haver empate num set / Super TB.')
      } else {
        setError(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-[60] p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-24 sm:pb-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[min(92vh,calc(100dvh-5.5rem))] overflow-y-auto my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="min-w-0 pr-2">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
              Resultado
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              {homeTeam?.name || 'Casa'} vs {awayTeam?.name || 'Fora'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Melhor de 2 sets + Super TB se 1-1 · atualiza a classificação
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl">{error}</div>}
          <div className="grid grid-cols-2 text-[11px] text-gray-500 px-0.5 gap-2">
            <span className="truncate">Casa: {homeTeam?.name}</span>
            <span className="truncate text-right">Fora: {awayTeam?.name}</span>
          </div>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-red-600" />
            </div>
          ) : (
            <>
              <ScoreRow
                title="Dupla 1"
                homeNames={duoTitles[1].home}
                awayNames={duoTitles[1].away}
                scores={duo1}
                setScores={setDuo1}
              />
              <ScoreRow
                title="Dupla 2"
                homeNames={duoTitles[2].home}
                awayNames={duoTitles[2].away}
                scores={duo2}
                setScores={setDuo2}
              />
              <ScoreRow
                title="Dupla 3"
                homeNames={duoTitles[3].home}
                awayNames={duoTitles[3].away}
                scores={duo3}
                setScores={setDuo3}
              />
            </>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border font-medium">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void handleSave()}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
