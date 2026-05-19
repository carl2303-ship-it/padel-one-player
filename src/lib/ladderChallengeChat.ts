/**
 * Grupo na Comunidade para os 4 jogadores de um desafio da escada combinarem o jogo.
 */
import { supabase } from './supabase'
import { createGroup, addMembersToCommunityGroup } from './communityGroups'
import { sendMessage } from './groupChat'
import type { LadderChallenge } from './ladderTournament'

export type LadderTeamForChat = {
  id: string
  name: string
  player1?: { user_id?: string | null } | null
  player2?: { user_id?: string | null } | null
}

function uuidLike(s: string): boolean {
  return typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s.trim())
}

/** user_id (auth) dos 4 jogadores das duas equipas, sem duplicados. */
export function ladderChallengeParticipantUserIds(t1: LadderTeamForChat, t2: LadderTeamForChat): string[] {
  const raw = [t1.player1?.user_id, t1.player2?.user_id, t2.player1?.user_id, t2.player2?.user_id]
  const out: string[] = []
  for (const x of raw) {
    if (typeof x === 'string' && uuidLike(x) && !out.includes(x)) out.push(x)
  }
  return out
}

export async function createLadderChallengeChatGroup(params: {
  challengerTeam: LadderTeamForChat
  challengedTeam: LadderTeamForChat
  tournamentName?: string | null
}): Promise<{ groupId: string | null; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { groupId: null, error: 'not_authenticated' }

  const t1n = (params.challengerTeam.name || 'Equipa').trim() || 'Equipa'
  const t2n = (params.challengedTeam.name || 'Equipa').trim() || 'Equipa'
  const tn = (params.tournamentName || '').trim() || 'Torneio escada'
  const name = `Escada · ${t1n.slice(0, 18)} vs ${t2n.slice(0, 18)}`.slice(0, 80)
  const description = `Combinar jogo — ${tn}. ${t1n} vs ${t2n}.`

  const created = await createGroup({ name, description })
  if (!created.success || !created.groupId) {
    return { groupId: null, error: created.error || 'create_group_failed' }
  }

  const gid = created.groupId
  const participantIds = ladderChallengeParticipantUserIds(params.challengerTeam, params.challengedTeam)
  await addMembersToCommunityGroup(gid, participantIds)

  await sendMessage({
    groupId: gid,
    content: 'Chat do desafio da escada — combinem aqui data, hora e local do jogo.',
    messageType: 'system',
  })

  return { groupId: gid }
}

export async function persistChallengeCommunityGroupId(
  tournamentId: string,
  categoryId: string,
  challengeId: string,
  groupId: string,
  pendingChallengesRaw: unknown
): Promise<boolean> {
  if (!Array.isArray(pendingChallengesRaw)) return false
  const next = pendingChallengesRaw.map((c: Record<string, unknown>) => {
    if (c && typeof c === 'object' && c.id === challengeId) {
      return { ...c, community_group_id: groupId }
    }
    return c
  })
  const { error } = await supabase
    .from('ladder_tournaments')
    .update({ pending_challenges: next })
    .eq('tournament_id', tournamentId)
    .eq('category_id', categoryId)
  if (error) {
    console.warn('[ladderChallengeChat] persist community_group_id failed', error)
    return false
  }
  return true
}

/** Garante que o desafio tem grupo na comunidade; devolve o id do grupo. */
export async function ensureLadderChallengeChatGroup(params: {
  tournamentId: string
  categoryId: string
  challenge: LadderChallenge
  challengerTeam: LadderTeamForChat
  challengedTeam: LadderTeamForChat
  tournamentName?: string | null
  pendingChallengesRaw: unknown
}): Promise<{ groupId: string | null; error?: string }> {
  const existing = params.challenge.community_group_id
  if (existing && typeof existing === 'string' && uuidLike(existing)) {
    return { groupId: existing }
  }

  const { groupId, error } = await createLadderChallengeChatGroup({
    challengerTeam: params.challengerTeam,
    challengedTeam: params.challengedTeam,
    tournamentName: params.tournamentName,
  })
  if (!groupId) return { groupId: null, error }

  await persistChallengeCommunityGroupId(
    params.tournamentId,
    params.categoryId,
    params.challenge.id,
    groupId,
    params.pendingChallengesRaw
  )

  return { groupId }
}
