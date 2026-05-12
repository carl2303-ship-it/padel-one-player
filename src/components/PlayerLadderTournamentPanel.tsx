import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18nContext'
import {
  LadderRow,
  parsePositions,
  validateChallenge,
  reorderAfterChallengerWin,
  parsePending,
  teamHasOpenChallenge,
  type LadderChallenge,
} from '../lib/ladderTournament'

type TeamRow = {
  id: string
  name: string
  player1_id: string
  player2_id: string
  player1?: { id: string; name: string; user_id?: string | null }
  player2?: { id: string; name: string; user_id?: string | null }
}

export default function PlayerLadderTournamentPanel({
  tournamentId,
  categoryId,
  authUserId,
}: {
  tournamentId: string
  categoryId: string
  authUserId: string | null
}) {
  const { t } = useI18n()
  const L = t.ladder

  const [loading, setLoading] = useState(true)
  const [ladder, setLadder] = useState<LadderRow | null>(null)
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [resultModal, setResultModal] = useState<LadderChallenge | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [ladderRes, teamsRes] = await Promise.all([
      supabase
        .from('ladder_tournaments')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('category_id', categoryId)
        .maybeSingle(),
      supabase
        .from('teams')
        .select(
          'id, name, player1_id, player2_id, player1:players!teams_player1_id_fkey(id, name, user_id), player2:players!teams_player2_id_fkey(id, name, user_id)'
        )
        .eq('tournament_id', tournamentId)
        .eq('category_id', categoryId)
        .order('seed', { ascending: true }),
    ])
    if (ladderRes.data) setLadder(ladderRes.data as LadderRow)
    else setLadder(null)
    setTeams(((teamsRes.data || []) as TeamRow[]) ?? [])
    setLoading(false)
  }, [tournamentId, categoryId])

  useEffect(() => {
    void load()
  }, [load])

  const myPlayerIds = useMemo(() => {
    const ids = new Set<string>()
    if (!authUserId) return ids
    for (const tm of teams) {
      if (tm.player1?.user_id === authUserId) ids.add(tm.player1_id)
      if (tm.player2?.user_id === authUserId) ids.add(tm.player2_id)
    }
    return ids
  }, [teams, authUserId])

  const myTeamIds = useMemo(() => {
    return new Set(
      teams.filter((x) => myPlayerIds.has(x.player1_id) || myPlayerIds.has(x.player2_id)).map((x) => x.id)
    )
  }, [teams, myPlayerIds])

  const positions = useMemo(() => parsePositions(ladder?.positions), [ladder?.positions])
  const pending = useMemo(() => parsePending(ladder?.pending_challenges), [ladder?.pending_challenges])

  const teamById = useMemo(() => new Map(teams.map((x) => [x.id, x])), [teams])

  const rankByTeamId = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of positions) m.set(p.team_id, p.rank)
    return m
  }, [positions])

  const orderedRows = useMemo(() => {
    if (positions.length > 0) return positions
    return teams.map((x, i) => ({ rank: i + 1, team_id: x.id }))
  }, [positions, teams])

  const showRanking =
    Boolean(ladder) && (ladder!.ladder_status === 'active' || ladder!.ladder_status === 'completed')

  const createChallenge = async (challengedTeamId: string, challengedRank: number) => {
    if (!ladder || ladder.ladder_status !== 'active') {
      alert(L.mustPublishFirst)
      return
    }
    const challengerTeamId = [...myTeamIds][0]
    if (!challengerTeamId) {
      alert(L.notInTeamHint)
      return
    }
    const challengerRank = rankByTeamId.get(challengerTeamId)
    if (challengerRank == null) return
    if (!validateChallenge(challengerRank, challengedRank, ladder.challenge_limit)) return

    const allPending = parsePending(ladder.pending_challenges)
    if (teamHasOpenChallenge(allPending, challengerTeamId) || teamHasOpenChallenge(allPending, challengedTeamId)) {
      alert(L.alreadyPending)
      return
    }

    const now = new Date()
    const deadline = new Date(now.getTime() + ladder.challenge_window_days * 86400000)
    const ch: LadderChallenge = {
      id: crypto.randomUUID(),
      challenger_team_id: challengerTeamId,
      challenged_team_id: challengedTeamId,
      challenger_rank: challengerRank,
      challenged_rank: challengedRank,
      created_at: now.toISOString(),
      deadline_at: deadline.toISOString(),
      status: 'pending',
    }
    const next = [...allPending, ch]
    setBusy(true)
    const { error } = await supabase
      .from('ladder_tournaments')
      .update({ pending_challenges: next })
      .eq('tournament_id', tournamentId)
      .eq('category_id', categoryId)
    setBusy(false)
    if (error) alert(L.errorGeneric + ': ' + error.message)
    else {
      alert(L.challengeCreated)
      void load()
    }
  }

  const submitChallengeResult = async (winnerTeamId: string) => {
    if (!ladder || !resultModal) return
    const all = (Array.isArray(ladder.pending_challenges) ? ladder.pending_challenges : []) as LadderChallenge[]
    const updated = all.map((c) =>
      c.id === resultModal.id ? { ...c, status: 'completed' as const, winner_team_id: winnerTeamId } : c
    )
    let newPositions = parsePositions(ladder.positions)
    if (winnerTeamId === resultModal.challenger_team_id) {
      newPositions = reorderAfterChallengerWin(
        newPositions,
        resultModal.challenger_team_id,
        resultModal.challenged_team_id
      )
    }
    setBusy(true)
    const { error } = await supabase
      .from('ladder_tournaments')
      .update({
        pending_challenges: updated.filter((c) => c.status === 'pending'),
        positions: newPositions,
      })
      .eq('tournament_id', tournamentId)
      .eq('category_id', categoryId)
    setBusy(false)
    setResultModal(null)
    if (error) alert(L.errorGeneric + ': ' + error.message)
    else void load()
  }

  if (loading) {
    return (
      <div className="card p-6 flex justify-center">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!ladder) {
    return (
      <div className="card p-4 border border-amber-100 bg-amber-50/50">
        <p className="text-sm text-amber-900">{L.noLadderData}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <h3 className="text-base font-bold text-gray-900 mb-1">{L.title}</h3>
        <p className="text-xs text-gray-500">
          {ladder.ladder_status === 'active'
            ? L.ladderActive
            : ladder.ladder_status === 'completed'
              ? L.ladderCompleted
              : L.ladderSetup}
        </p>
      </div>

      {ladder.ladder_status === 'setup' && (
        <div className="card p-4 border border-amber-200 bg-amber-50/60 text-sm text-amber-900">{L.ladderSetup}</div>
      )}

      {showRanking && (
        <div className="card p-4 space-y-3">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">{L.rank}</th>
                  <th className="py-2 pr-4">{L.team}</th>
                  <th className="py-2">{myTeamIds.size > 0 && ladder.ladder_status === 'active' ? L.challenge : ''}</th>
                </tr>
              </thead>
              <tbody>
                {orderedRows.map((row) => {
                  const tm = teamById.get(row.team_id)
                  const challengerTeamId = [...myTeamIds][0]
                  const myRank = challengerTeamId ? rankByTeamId.get(challengerTeamId) : undefined
                  const canShowChallenge =
                    ladder.ladder_status === 'active' &&
                    myTeamIds.size > 0 &&
                    challengerTeamId &&
                    row.team_id !== challengerTeamId &&
                    myRank != null &&
                    validateChallenge(myRank, row.rank, ladder.challenge_limit)
                  return (
                    <tr key={row.team_id} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-mono">{row.rank}</td>
                      <td className="py-2 pr-4">
                        <div className="font-medium text-gray-900">{tm?.name ?? row.team_id}</div>
                        <div className="text-xs text-gray-500">
                          {tm ? `${tm.player1?.name || '?'} / ${tm.player2?.name || '?'}` : ''}
                        </div>
                      </td>
                      <td className="py-2">
                        {canShowChallenge ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void createChallenge(row.team_id, row.rank)}
                            className="px-2 py-1 text-xs bg-orange-500 text-white rounded-md"
                          >
                            {L.challenge}
                          </button>
                        ) : ladder.ladder_status === 'active' && myTeamIds.size > 0 ? (
                          <span className="text-gray-300">{L.notEligible}</span>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {ladder.ladder_status === 'active' && myTeamIds.size === 0 && (
            <p className="text-xs text-gray-600">{L.notInTeamHint}</p>
          )}
        </div>
      )}

      {pending.length > 0 && (
        <div className="card p-4 space-y-2">
          <h3 className="font-semibold text-gray-900">{L.pending}</h3>
          <ul className="space-y-2">
            {pending.map((c) => {
              const t1 = teamById.get(c.challenger_team_id)
              const t2 = teamById.get(c.challenged_team_id)
              const canRecord = myTeamIds.has(c.challenger_team_id) || myTeamIds.has(c.challenged_team_id)
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-lg p-3">
                  <div>
                    <div className="text-sm">
                      <span className="font-medium">{t1?.name}</span> vs <span className="font-medium">{t2?.name}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {L.deadline}: {new Date(c.deadline_at).toLocaleString()}
                    </div>
                  </div>
                  {canRecord && (
                    <button
                      type="button"
                      onClick={() => setResultModal(c)}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg"
                    >
                      {L.recordResult}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {resultModal && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
          onClick={() => setResultModal(null)}
        >
          <div className="bg-white rounded-xl max-w-sm w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-bold text-lg">{L.resultTitle}</h4>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitChallengeResult(resultModal.challenger_team_id)}
                className="py-2 px-3 rounded-lg bg-orange-100 text-orange-900 font-medium"
              >
                {L.challengerWon}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitChallengeResult(resultModal.challenged_team_id)}
                className="py-2 px-3 rounded-lg bg-slate-100 text-slate-900 font-medium"
              >
                {L.defenderWon}
              </button>
              <button type="button" onClick={() => setResultModal(null)} className="text-sm text-gray-500">
                {L.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
