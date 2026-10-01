import { useEffect, useMemo, useState } from 'react'
import { Loader2, Save, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { ClubLeaguePlayerRow, ClubLeagueTeamRow, ClubLeagueConfrontationRow } from '../lib/clubLeagueData'

type Props = {
  confrontation: ClubLeagueConfrontationRow
  team: ClubLeagueTeamRow
  onClose: () => void
  onSuccess: () => void
}

type DuoSlot = [string, string]

function duoSum(players: ClubLeaguePlayerRow[], ids: DuoSlot): number {
  const a = players.find((p) => p.id === ids[0])
  const b = players.find((p) => p.id === ids[1])
  return (Number(a?.fpp_points) || 0) + (Number(b?.fpp_points) || 0)
}

export function lineupLockAt(scheduledTime: string | null | undefined): Date | null {
  if (!scheduledTime) return null
  const t = new Date(scheduledTime)
  if (Number.isNaN(t.getTime())) return null
  return new Date(t.getTime() - 30 * 60 * 1000)
}

export function isLineupLocked(scheduledTime: string | null | undefined, now = new Date()): boolean {
  const lock = lineupLockAt(scheduledTime)
  return lock ? now >= lock : false
}

export function isLineupPublic(scheduledTime: string | null | undefined, now = new Date()): boolean {
  if (!scheduledTime) return true
  return isLineupLocked(scheduledTime, now)
}

export default function ClubLeagueLineupModal({ confrontation, team, onClose, onSuccess }: Props) {
  const players = useMemo(
    () => [...(team.club_league_players || [])].sort((a, b) => a.player_order - b.player_order),
    [team.club_league_players]
  )

  const [duo1, setDuo1] = useState<DuoSlot>(['', ''])
  const [duo2, setDuo2] = useState<DuoSlot>(['', ''])
  const [duo3, setDuo3] = useState<DuoSlot>(['', ''])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const lockAt = lineupLockAt(confrontation.scheduled_time)
  const locked = isLineupLocked(confrontation.scheduled_time)
  const canEdit = !locked && players.length >= 6

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('club_league_lineups')
        .select('*')
        .eq('confrontation_id', confrontation.id)
        .eq('team_id', team.id)
        .maybeSingle()
      if (data) {
        setDuo1([data.duo1_player1_id || '', data.duo1_player2_id || ''])
        setDuo2([data.duo2_player1_id || '', data.duo2_player2_id || ''])
        setDuo3([data.duo3_player1_id || '', data.duo3_player2_id || ''])
        setSubmitted(Boolean(data.submitted_at || data.duo1_player1_id))
      }
      setLoading(false)
    }
    void load()
  }, [confrontation.id, team.id])

  const usedIds = new Set([...duo1, ...duo2, ...duo3].filter(Boolean))
  const optionsFor = (current: string) =>
    players.filter((p) => p.id === current || !usedIds.has(p.id))

  const sums = {
    d1: duoSum(players, duo1),
    d2: duoSum(players, duo2),
    d3: duoSum(players, duo3),
  }
  const fppOk =
    duo1.every(Boolean) &&
    duo2.every(Boolean) &&
    duo3.every(Boolean) &&
    sums.d1 > sums.d2 &&
    sums.d2 > sums.d3

  const PlayerSelect = ({
    value,
    onChange,
    label,
  }: {
    value: string
    onChange: (v: string) => void
    label: string
  }) => (
    <select
      value={value}
      disabled={!canEdit}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm disabled:bg-gray-50 bg-white"
    >
      <option value="">{label}</option>
      {optionsFor(value).map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({Number(p.fpp_points)} FPP)
        </option>
      ))}
    </select>
  )

  const handleSave = async () => {
    setError('')
    const all = [...duo1, ...duo2, ...duo3]
    if (all.some((id) => !id)) {
      setError('Seleciona exactamente 6 jogadores (3 duplas).')
      return
    }
    if (new Set(all).size !== 6) {
      setError('Os 6 jogadores têm de ser distintos.')
      return
    }
    if (!fppOk) {
      setError('A soma FPP tem de respeitar Dupla 1 > Dupla 2 > Dupla 3.')
      return
    }

    setSaving(true)
    try {
      const { error: rpcError } = await supabase.rpc('submit_club_league_lineup', {
        p_confrontation_id: confrontation.id,
        p_team_id: team.id,
        p_duo1_p1: duo1[0],
        p_duo1_p2: duo1[1],
        p_duo2_p1: duo2[0],
        p_duo2_p2: duo2[1],
        p_duo3_p1: duo3[0],
        p_duo3_p2: duo3[1],
        p_organizer_override: false,
      })
      if (rpcError) throw rpcError
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('fpp_order_invalid')) setError('Ordem FPP inválida (D1 > D2 > D3).')
      else if (msg.includes('lineup_locked')) setError('Lineup bloqueada (faltam menos de 30 min).')
      else if (msg.includes('not_authorized')) setError('Só o capitão pode submeter a lineup.')
      else if (msg.includes('need_six') || msg.includes('players_not_in_roster'))
        setError('Plantel incompleto — são precisos 6 jogadores inscritos.')
      else setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="min-w-0 pr-2">
            <h2 className="text-lg font-semibold text-gray-900">Lineup — {team.name}</h2>
            <p className="text-xs text-gray-500 mt-1">
              {locked
                ? 'Bloqueada (faltam menos de 30 min para o jogo).'
                : lockAt
                  ? `Secreta até ${lockAt.toLocaleString('pt-PT', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hourCycle: 'h23',
                    })} · só o capitão edita`
                  : 'Sem hora marcada — editável · secreta até haver hora'}
            </p>
            {submitted && !locked && (
              <p className="text-xs text-emerald-700 mt-1 font-medium">Já submetida (ainda secreta para adversários)</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl">{error}</div>}
          {players.length < 6 && (
            <div className="bg-amber-50 text-amber-800 text-sm px-3 py-2 rounded-xl">
              Plantel com {players.length}/6 jogadores. Pede ao organizador para completar o plantel.
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-red-600" />
            </div>
          ) : (
            <>
              {(
                [
                  ['Dupla 1 (mais forte)', duo1, setDuo1, sums.d1],
                  ['Dupla 2', duo2, setDuo2, sums.d2],
                  ['Dupla 3 (mais fraca)', duo3, setDuo3, sums.d3],
                ] as const
              ).map(([title, duo, setDuo, sum]) => (
                <div key={title} className="border border-gray-100 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span>{title}</span>
                    <span className="text-gray-500">Σ {sum || '—'} FPP</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <PlayerSelect value={duo[0]} label="Jogador A" onChange={(v) => setDuo([v, duo[1]])} />
                    <PlayerSelect value={duo[1]} label="Jogador B" onChange={(v) => setDuo([duo[0], v])} />
                  </div>
                </div>
              ))}
              {!fppOk && duo1.every(Boolean) && duo2.every(Boolean) && duo3.every(Boolean) && (
                <p className="text-sm text-amber-700">
                  Ajusta as duplas: precisa D1 ({sums.d1}) &gt; D2 ({sums.d2}) &gt; D3 ({sums.d3}).
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border font-medium">
            Fechar
          </button>
          {canEdit && (
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => void handleSave()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Submeter
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
