/**
 * Padel One Rating Engine v4
 * Sistema ELO adaptado para Padel em Duplas
 *
 * Escala: 0.5 (iniciante), sem limite superior (M1/F1 aberto)
 * Fiabilidade: 0% (0 jogos) a 100% (75+ jogos rated)
 *
 * v4:
 * - Piso K em torneios (K_TOURNAMENT_FLOOR = 0.12) — evita estagnação de veteranos
 * - Bónus fixo de pódio no encerramento (+0.10 campeão / +0.05 finalista)
 * - Transparência UI: delta_base, k_factor_used, is_tournament_boost, bonus_applied
 *
 * v3 Fixes:
 * - K-Factor SIGNIFICATIVAMENTE aumentado para jogadores novos (0.5 vs 0.12)
 * - Fórmula ELO com divisor ajustado (1.2 vs 2.0) para maior sensibilidade
 * - Intensidade do resultado melhorada (3 sets, vitória dominante, etc.)
 * - Fiabilidade protegida: nunca cai mais de 2% por jogo (preserva avaliação do clube)
 * - Empate (1-1 sets) tratado com base em games totais
 */

import { supabase } from './supabase'
import { reverseRatingForSource } from './levelHistory'

// ============================================
// Constants
// ============================================

/** Piso mínimo de K-factor em partidas de torneio (veteranos casuais descem a 0.06). */
export const K_TOURNAMENT_FLOOR = 0.12

/** Bónus ELO directo no encerramento do torneio. */
export const PODIUM_BONUS_CHAMPION = 0.10
export const PODIUM_BONUS_FINALIST = 0.05

/** Pontos do ranking deslizante 12 meses (expiram via vista SQL). */
export const RANKING_POINTS = {
  tournament_winner: 100,
  tournament_finalist: 60,
  friendly_win: 10,
} as const

// ============================================
// Types
// ============================================

export interface PlayerRating {
  id: string           // player_accounts.id
  user_id: string      // auth user id
  name: string
  rating: number       // level (ex: 2.5, 4.1)
  matches: number      // total rated matches played
}

export interface MatchScore {
  sets1: number        // sets won by team 1
  sets2: number        // sets won by team 2
  gamesTotal1: number  // total games won by team 1 (across all sets)
  gamesTotal2: number  // total games won by team 2
}

/** Campos de transparência do cálculo ELO (UI / histórico). */
export interface RatingTransparency {
  delta_base: number
  k_factor_used: number
  is_tournament_boost: boolean
  bonus_applied: number
}

export type RatedPlayerResult = PlayerRating & {
  delta: number
  won: boolean | null
} & RatingTransparency

export interface RatingResult {
  skipped?: boolean
  message?: string
  team1?: {
    p1: RatedPlayerResult
    p2: RatedPlayerResult
  }
  team2?: {
    p3: RatedPlayerResult
    p4: RatedPlayerResult
  }
}

export interface CalculateRatingsOptions {
  /** true = torneio (aplica K_TOURNAMENT_FLOOR). false/omitido = casual/amigável. */
  isTournament?: boolean
}

// ============================================
// Core Algorithm
// ============================================

/**
 * K-factor base por jogos rated (casual pode descer até 0.06).
 */
export function getBaseKFactor(matches: number): number {
  if (matches < 5) return 0.50
  if (matches < 10) return 0.35
  if (matches < 20) return 0.25
  if (matches < 40) return 0.15
  if (matches < 60) return 0.10
  return 0.06
}

/**
 * K-factor efectivo: em torneio impõe piso K_TOURNAMENT_FLOOR.
 */
export function getKFactor(matches: number, isTournament = false): {
  k: number
  base: number
  is_tournament_boost: boolean
} {
  const base = getBaseKFactor(matches)
  if (!isTournament) {
    return { k: base, base, is_tournament_boost: false }
  }
  const k = Math.max(base, K_TOURNAMENT_FLOOR)
  return { k, base, is_tournament_boost: k > base }
}

/**
 * Calcula os novos ratings de 4 jogadores após um jogo de duplas.
 * Baseado no sistema ELO com adaptações para padel.
 *
 * Escala 0.5-7.0 (range = 6.5). ELO clássico usa range ~2000.
 * K-Factor proporcional: K_classic=40 → K_padel = 40*(6.5/2000) ≈ 0.13 para veteranos.
 * Para novos jogadores: K muito mais alto para convergência rápida.
 * Em torneio: K mínimo = K_TOURNAMENT_FLOOR (0.12).
 */
export function calculateNewRatings(
  team1: { p1: PlayerRating; p2: PlayerRating },
  team2: { p3: PlayerRating; p4: PlayerRating },
  score: MatchScore,
  options?: CalculateRatingsOptions,
): RatingResult {
  const { p1, p2 } = team1
  const { p3, p4 } = team2
  const isTournament = !!options?.isTournament

  // 1. Médias de Nível das Equipas
  const avg1 = (p1.rating + p2.rating) / 2
  const avg2 = (p3.rating + p4.rating) / 2


  // 2. Verificação de Disparidade (Regra do 2.0)
  // Aumentado de 1.5 para 2.0 para permitir mais jogos entre níveis diferentes
  if (Math.abs(avg1 - avg2) > 2.0) {
    return {
      skipped: true,
      message: `Disparidade demasiado alta (${Math.abs(avg1 - avg2).toFixed(2)} > 2.0), nível inalterado`,
    }
  }

  // 3. Probabilidade de Vitória (Expected Outcome)
  // Divisor 1.2 (vs 2.0 anterior) — torna a fórmula mais sensível a diferenças de nível
  // Com divisor 1.2: diferença de 0.5 → expected ≈ 0.27 (antes era 0.36)
  const expected1 = 1 / (1 + Math.pow(10, (avg2 - avg1) / 1.2))

  // 4. Resultado Actual
  // Se empate em sets (1-1), usar diferença de games para desempatar
  let actual1: number
  if (score.sets1 > score.sets2) {
    actual1 = 1
  } else if (score.sets1 < score.sets2) {
    actual1 = 0
  } else {
    // Empate em sets — usar games totais para determinar vencedor parcial
    if (score.gamesTotal1 > score.gamesTotal2) {
      actual1 = 0.6  // Ligeira vantagem (não vitória completa)
    } else if (score.gamesTotal1 < score.gamesTotal2) {
      actual1 = 0.4
    } else {
      actual1 = 0.5  // Empate verdadeiro
    }
  }

  // 5. Intensidade do Resultado (Multiplicador)
  let intensity = 1.0
  const gameDiff = Math.abs(score.gamesTotal1 - score.gamesTotal2)

  if (score.sets1 + score.sets2 === 3) {
    // Jogo de 3 sets — verificar se foi renhido
    if (gameDiff <= 3) {
      intensity = 0.6   // Muito renhido (ex: 6-4, 4-6, 7-6)
    } else {
      intensity = 0.8   // 3 sets mas com margem
    }
  } else if (gameDiff > 8) {
    intensity = 1.3   // Vitória dominante (ex: 6-1, 6-2)
  } else if (gameDiff > 5) {
    intensity = 1.15  // Vitória clara (ex: 6-3, 6-3)
  }

  // 6–7. K-Factor + Delta (com piso de torneio)
  const calcPlayer = (
    player: PlayerRating,
    actual: number,
    expected: number,
    won: boolean | null,
  ): RatedPlayerResult => {
    const { k, is_tournament_boost } = getKFactor(player.matches, isTournament)
    const delta_base = parseFloat((k * (actual - expected) * intensity).toFixed(4))
    const bonus_applied = 0
    const delta = delta_base + bonus_applied
    const clamp = (val: number) => Math.max(0.5, Math.min(7.0, parseFloat(val.toFixed(2))))
    return {
      ...player,
      rating: clamp(player.rating + delta),
      delta,
      matches: player.matches + 1,
      won,
      delta_base,
      k_factor_used: k,
      is_tournament_boost,
      bonus_applied,
    }
  }

  // 8. Determinar quem ganhou/perdeu
  const team1Won = actual1 >= 0.6 ? true : actual1 <= 0.4 ? false : null

  return {
    team1: {
      p1: calcPlayer(p1, actual1, expected1, team1Won),
      p2: calcPlayer(p2, actual1, expected1, team1Won),
    },
    team2: {
      p3: calcPlayer(p3, 1 - actual1, 1 - expected1, team1Won === null ? null : !team1Won),
      p4: calcPlayer(p4, 1 - actual1, 1 - expected1, team1Won === null ? null : !team1Won),
    },
  }
}

// ============================================
// Fiabilidade (Reliability)
// ============================================

/**
 * Calcula a fiabilidade baseada em jogos rated.
 * 0 jogos = 0%, 75+ jogos = 100%
 */
export function calculateReliability(totalMatches: number): number {
  if (totalMatches <= 0) return 0
  if (totalMatches >= 75) return 100
  const reliability = Math.min(100, Math.round(100 * (Math.log(totalMatches + 1) / Math.log(76))))
  return reliability
}

/**
 * Calcula a fiabilidade "protegida" — nunca cai mais de 2% por jogo.
 * Isto preserva a avaliação feita pelo clube/management.
 * 
 * @param newReliability - fiabilidade calculada a partir dos rated_matches
 * @param currentReliability - fiabilidade actual no player_accounts
 * @returns fiabilidade a guardar (máximo entre fórmula e decaimento lento)
 */
export function calculateProtectedReliability(newReliability: number, currentReliability: number): number {
  // Se a fiabilidade pela fórmula é maior (normal progression), usa a fórmula
  // Se a fiabilidade pela fórmula é menor (ex: clube definiu 80%, rated_matches=2 → 25%),
  // usa decaimento lento: -2% por jogo para não destruir a avaliação do clube
  return Math.max(newReliability, currentReliability - 2)
}

export function calculateMatchesFromReliability(reliability: number): number {
  if (reliability <= 0) return 0
  if (reliability >= 100) return 75
  const matches = Math.round(Math.exp((reliability / 100) * Math.log(76)) - 1)
  return Math.max(0, Math.min(75, matches))
}

// ============================================
// Player Cache (para acumular durante batch)
// ============================================

export interface CachedPlayer {
  id: string
  user_id: string
  name: string
  rating: number
  matchCount: number
  currentReliability: number
}

export type PlayerCache = Map<string, CachedPlayer>

// ============================================
// Supabase Integration
// ============================================

export async function processMatchRating(
  matchId: string,
  cache?: PlayerCache,
  options?: { force?: boolean },
): Promise<RatingResult | null> {
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select(`
      id, team1_id, team2_id, status, rating_processed,
      tournament_id, round, category_id,
      team1_score_set1, team2_score_set1,
      team1_score_set2, team2_score_set2,
      team1_score_set3, team2_score_set3,
      player1_individual_id, player2_individual_id,
      player3_individual_id, player4_individual_id
    `)
    .eq('id', matchId)
    .single()

  if (matchErr || !match) {
    console.error('[RatingEngine] Match not found:', matchId, matchErr)
    return null
  }

  if (match.status !== 'completed') {
    return null
  }

  if (match.rating_processed && !options?.force) {
    return { skipped: true, message: 'Already processed' }
  }

  const s1 = [match.team1_score_set1 ?? 0, match.team2_score_set1 ?? 0] as [number, number]
  const s2 = [match.team1_score_set2 ?? 0, match.team2_score_set2 ?? 0] as [number, number]
  const s3 = [match.team1_score_set3 ?? 0, match.team2_score_set3 ?? 0] as [number, number]

  const sets1 = (s1[0] > s1[1] ? 1 : 0) + (s2[0] > s2[1] ? 1 : 0) + (s3[0] > s3[1] ? 1 : 0)
  const sets2 = (s1[1] > s1[0] ? 1 : 0) + (s2[1] > s2[0] ? 1 : 0) + (s3[1] > s3[0] ? 1 : 0)
  const gamesTotal1 = s1[0] + s2[0] + s3[0]
  const gamesTotal2 = s1[1] + s2[1] + s3[1]

  if (sets1 === 0 && sets2 === 0) {
    return null
  }

  const score: MatchScore = { sets1, sets2, gamesTotal1, gamesTotal2 }

  let playerIds: string[] = []
  const isIndividual = match.player1_individual_id || match.player2_individual_id
  if (isIndividual) {
    playerIds = [
      match.player1_individual_id,
      match.player2_individual_id,
      match.player3_individual_id,
      match.player4_individual_id,
    ].filter(Boolean)
  } else if (match.team1_id && match.team2_id) {
    const { data: teams } = await supabase
      .from('teams')
      .select('id, player1_id, player2_id')
      .in('id', [match.team1_id, match.team2_id])

    if (!teams || teams.length < 2) {
      console.error('[RatingEngine] Could not find teams for match:', matchId)
      return null
    }

    const t1 = teams.find((t: any) => t.id === match.team1_id)
    const t2 = teams.find((t: any) => t.id === match.team2_id)
    playerIds = [t1?.player1_id, t1?.player2_id, t2?.player1_id, t2?.player2_id].filter(Boolean)
  }

  if (playerIds.length < 4) {
    return null
  }

  const { data: playersData } = await supabase
    .from('players')
    .select('id, name, phone_number, user_id, player_account_id')
    .in('id', playerIds)

  if (!playersData || playersData.length < 4) {
    return null
  }

  const accountsMap = new Map<string, any>()
  const selectFields = 'id, user_id, name, level, rated_matches, wins, losses, level_reliability_percent'
  const normalizePhoneDigits = (phone: string) => {
    let cleaned = phone.replace(/[\s\-\(\)\.]/g, '')
    let hadPrefix = false
    if (cleaned.startsWith('+00')) { cleaned = cleaned.slice(3); hadPrefix = true }
    else if (cleaned.startsWith('+')) { cleaned = cleaned.slice(1); hadPrefix = true }
    else if (cleaned.startsWith('00')) { cleaned = cleaned.slice(2); hadPrefix = true }
    if (hadPrefix) {
      cleaned = cleaned.replace(/^351(?=\d{9})/, '')
    } else {
      cleaned = cleaned.replace(/^351(?=[29]\d{8}$)/, '')
    }
    return cleaned
  }

  for (const p of playersData) {
    let account: any = null

    // 1) Direct FK — most reliable
    if ((p as any).player_account_id) {
      const { data } = await supabase
        .from('player_accounts')
        .select(selectFields)
        .eq('id', (p as any).player_account_id)
        .maybeSingle()
      if (data) account = data
    }

    if (!account && p.user_id) {
      const { data } = await supabase
        .from('player_accounts')
        .select(selectFields)
        .eq('user_id', p.user_id)
        .maybeSingle()
      if (data) account = data
    }

    if (!account && p.phone_number) {
      const normalized = normalizePhoneDigits(p.phone_number)
      const { data } = await supabase
        .from('player_accounts')
        .select(selectFields)
        .eq('phone_number', normalized)
        .maybeSingle()
      if (data) account = data
      if (!account && normalized !== p.phone_number) {
        const { data: data2 } = await supabase
          .from('player_accounts')
          .select(selectFields)
          .eq('phone_number', p.phone_number)
          .maybeSingle()
        if (data2) account = data2
      }
    }

    // Name fallback last — exact match only (avoid collisions)
    if (!account && p.name) {
      const { data } = await supabase
        .from('player_accounts')
        .select(selectFields)
        .eq('name', p.name.trim())
        .maybeSingle()
      if (data) account = data
    }

    if (account) {
      accountsMap.set(p.id, account)
    }
  }

  // Guard: same account mapped to 2+ players in one match → wrong win/loss history
  const accountIds = Array.from(accountsMap.values()).map((a: any) => a.id)
  if (new Set(accountIds).size < accountIds.length) {
    console.error('[RatingEngine] Duplicate player_account mapping in match — skipping to avoid corrupt history:', matchId)
    return null
  }

  if (accountsMap.size < 4) {
    return null
  }

  const buildRating = (playerId: string): PlayerRating | null => {
    const acct = accountsMap.get(playerId)
    if (!acct) return null

    const cached = cache?.get(acct.id)
    if (cached) {
      return {
        id: cached.id,
        user_id: cached.user_id,
        name: cached.name,
        rating: cached.rating,
        matches: cached.matchCount,
      }
    }

    return {
      id: acct.id,
      user_id: acct.user_id || '',
      name: acct.name || '',
      rating: acct.level ?? 3.0,
      matches: acct.rated_matches ?? ((acct.wins ?? 0) + (acct.losses ?? 0)),
    }
  }

  const p1 = buildRating(playerIds[0])
  const p2 = buildRating(playerIds[1])
  const p3 = buildRating(playerIds[2])
  const p4 = buildRating(playerIds[3])

  if (!p1 || !p2 || !p3 || !p4) {
    return null
  }

  const isTournament = !!match.tournament_id
  const result = calculateNewRatings({ p1, p2 }, { p3, p4 }, score, { isTournament })

  if (result.skipped) {
    // Mark so we don't retry forever on disparity skips
    try {
      await supabase.rpc('mark_match_rating_processed', { p_match_id: matchId })
    } catch {
      /* ignore */
    }
    await supabase.from('matches').update({ rating_processed: true }).eq('id', matchId)
    return result
  }

  if (result.team1 && result.team2) {
    const allUpdatedPlayers = [result.team1.p1, result.team1.p2, result.team2.p3, result.team2.p4]
    const matchType = isTournament ? 'tournament' : 'open_game'

    for (const rp of allUpdatedPlayers) {
      const formulaReliability = calculateReliability(rp.matches)
      // Get current reliability from account or cache
      const acctData = Array.from(accountsMap.values()).find((a: any) => a.id === rp.id)
      const currentReliability = cache?.get(rp.id)?.currentReliability ?? acctData?.level_reliability_percent ?? 0
      const protectedReliability = calculateProtectedReliability(formulaReliability, currentReliability)

      const { error } = await supabase.rpc('update_player_rating', {
        p_player_account_id: rp.id,
        p_new_level: rp.rating,
        p_new_reliability: protectedReliability,
        p_match_won: rp.won,
        p_source_id: matchId,
        p_match_type: matchType,
      })

      if (error) {
        console.error('[RatingEngine] Error updating player:', rp.id, error)
      } else if (cache) {
        cache.set(rp.id, {
          id: rp.id,
          user_id: rp.user_id,
          name: rp.name,
          rating: rp.rating,
          matchCount: rp.matches,
          currentReliability: protectedReliability,
        })
      }
    }

    const { error: markError } = await supabase.rpc('mark_match_rating_processed', {
      p_match_id: matchId,
    })
    if (markError) {
      console.error('[RatingEngine] Error marking match as processed:', matchId, markError)
    }

    // Encerramento: final de torneio → bónus de pódio + pontos ranking 12m
    const round = String(match.round || '').toLowerCase()
    if (isTournament && (round === 'final' || round === 'mixed_final')) {
      try {
        await applyTournamentPodiumBonuses(match.tournament_id as string, match.category_id as string | null)
      } catch (err) {
        console.error('[RatingEngine] Podium bonus failed for tournament:', match.tournament_id, err)
      }
    }
  }

  return result
}

/**
 * Undo previous rating for this match (via history), then apply rating for current scores.
 *
 * Segurança: se o jogo já tinha sido processado antes mas não foi possível
 * encontrar/desfazer o histórico correspondente (source_id em falta), o
 * reprocessamento é BLOQUEADO em vez de reaplicar um novo delta em cima do
 * nível já alterado (o que duplicaria/corromperia nível, jogos e V/D).
 */
export async function reprocessMatchRating(matchId: string): Promise<RatingResult | null> {
  const { data: match } = await supabase
    .from('matches')
    .select('id, rating_processed')
    .eq('id', matchId)
    .maybeSingle()

  const wasProcessed = !!match?.rating_processed
  const reversed = await reverseRatingForSource(matchId)

  if (wasProcessed && reversed === 0) {
    console.error(`[RatingEngine] BLOCKED reprocess for match ${matchId}: already rated but no history found to reverse safely.`)
    return { skipped: true, message: 'Reprocessamento bloqueado: histórico do jogo não encontrado para reverter em segurança.' }
  }

  await supabase
    .from('matches')
    .update({ rating_processed: false })
    .eq('id', matchId)

  return processMatchRating(matchId, undefined, { force: true })
}

// ============================================
// Pódio (encerramento de torneio)
// ============================================

export interface PodiumBonusResult {
  applied: boolean
  message?: string
  champions: Array<RatedPlayerResult & { player_account_id: string }>
  finalists: Array<RatedPlayerResult & { player_account_id: string }>
}

/**
 * Aplica bónus fixo de pódio no encerramento do torneio:
 * Campeão +0.10 / Finalista +0.05 no Rating ELO (sem incrementar rated_matches).
 * Regista também pontos no ranking deslizante de 12 meses.
 * Idempotente: se já houver transações de pódio para o torneio, não reaplica.
 */
export async function applyTournamentPodiumBonuses(
  tournamentId: string,
  categoryId?: string | null,
): Promise<PodiumBonusResult> {
  const empty: PodiumBonusResult = { applied: false, champions: [], finalists: [] }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, club_id')
    .eq('id', tournamentId)
    .maybeSingle()

  // No ecossistema Padel ONE, organization_id do ranking 12m = club_id do torneio
  const organizationId = (tournament?.club_id as string | null) || null

  // Resolver campeões (final_position=1) e finalistas (final_position=2)
  let championPlayerIds: string[] = []
  let finalistPlayerIds: string[] = []

  let teamsQuery = supabase
    .from('teams')
    .select('id, player1_id, player2_id, final_position, category_id')
    .eq('tournament_id', tournamentId)
    .in('final_position', [1, 2])

  if (categoryId) {
    teamsQuery = teamsQuery.eq('category_id', categoryId)
  }

  const { data: podiumTeams } = await teamsQuery

  if (podiumTeams && podiumTeams.length > 0) {
    for (const t of podiumTeams) {
      const ids = [t.player1_id, t.player2_id].filter(Boolean) as string[]
      if (t.final_position === 1) championPlayerIds.push(...ids)
      else if (t.final_position === 2) finalistPlayerIds.push(...ids)
    }
  }

  // Fallback: jogadores individuais com final_position
  if (championPlayerIds.length === 0 && finalistPlayerIds.length === 0) {
    let playersQuery = supabase
      .from('players')
      .select('id, final_position, category_id, player_account_id, user_id')
      .eq('tournament_id', tournamentId)
      .in('final_position', [1, 2])

    if (categoryId) {
      playersQuery = playersQuery.eq('category_id', categoryId)
    }

    const { data: podiumPlayers } = await playersQuery
    if (podiumPlayers) {
      for (const p of podiumPlayers) {
        if (p.final_position === 1) championPlayerIds.push(p.id)
        else if (p.final_position === 2) finalistPlayerIds.push(p.id)
      }
    }
  }

  // Fallback: resultado da final
  if (championPlayerIds.length === 0) {
    let finalQuery = supabase
      .from('matches')
      .select(`
        id, team1_id, team2_id, round, status,
        team1_score_set1, team2_score_set1,
        team1_score_set2, team2_score_set2,
        team1_score_set3, team2_score_set3,
        player1_individual_id, player2_individual_id,
        player3_individual_id, player4_individual_id
      `)
      .eq('tournament_id', tournamentId)
      .eq('status', 'completed')
      .in('round', ['final', 'mixed_final'])
      .limit(1)

    if (categoryId) {
      finalQuery = finalQuery.eq('category_id', categoryId)
    }

    const { data: finals } = await finalQuery
    const finalMatch = finals?.[0]
    if (finalMatch) {
      const s1 = (finalMatch.team1_score_set1 ?? 0) > (finalMatch.team2_score_set1 ?? 0) ? 1 : 0
      const s2 = (finalMatch.team1_score_set2 ?? 0) > (finalMatch.team2_score_set2 ?? 0) ? 1 : 0
      const s3 = (finalMatch.team1_score_set3 ?? 0) > (finalMatch.team2_score_set3 ?? 0) ? 1 : 0
      const s1b = (finalMatch.team2_score_set1 ?? 0) > (finalMatch.team1_score_set1 ?? 0) ? 1 : 0
      const s2b = (finalMatch.team2_score_set2 ?? 0) > (finalMatch.team1_score_set2 ?? 0) ? 1 : 0
      const s3b = (finalMatch.team2_score_set3 ?? 0) > (finalMatch.team1_score_set3 ?? 0) ? 1 : 0
      const sets1 = s1 + s2 + s3
      const sets2 = s1b + s2b + s3b
      const team1WonFinal = sets1 > sets2

      if (finalMatch.player1_individual_id || finalMatch.player3_individual_id) {
        const t1 = [finalMatch.player1_individual_id, finalMatch.player2_individual_id].filter(Boolean) as string[]
        const t2 = [finalMatch.player3_individual_id, finalMatch.player4_individual_id].filter(Boolean) as string[]
        championPlayerIds = team1WonFinal ? t1 : t2
        finalistPlayerIds = team1WonFinal ? t2 : t1
      } else if (finalMatch.team1_id && finalMatch.team2_id) {
        const { data: teams } = await supabase
          .from('teams')
          .select('id, player1_id, player2_id')
          .in('id', [finalMatch.team1_id, finalMatch.team2_id])
        const t1 = teams?.find((t: any) => t.id === finalMatch.team1_id)
        const t2 = teams?.find((t: any) => t.id === finalMatch.team2_id)
        const ids1 = [t1?.player1_id, t1?.player2_id].filter(Boolean) as string[]
        const ids2 = [t2?.player1_id, t2?.player2_id].filter(Boolean) as string[]
        championPlayerIds = team1WonFinal ? ids1 : ids2
        finalistPlayerIds = team1WonFinal ? ids2 : ids1
      }
    }
  }

  championPlayerIds = [...new Set(championPlayerIds)]
  finalistPlayerIds = [...new Set(finalistPlayerIds)].filter((id) => !championPlayerIds.includes(id))

  if (championPlayerIds.length === 0 && finalistPlayerIds.length === 0) {
    return { ...empty, message: 'Não foi possível determinar campeões/finalistas' }
  }

  const allPlayerIds = [...championPlayerIds, ...finalistPlayerIds]
  const { data: playersData } = await supabase
    .from('players')
    .select('id, name, user_id, player_account_id, phone_number')
    .in('id', allPlayerIds)

  if (!playersData || playersData.length === 0) {
    return { ...empty, message: 'Jogadores do pódio não encontrados' }
  }

  const accountByPlayer = new Map<string, any>()
  for (const p of playersData) {
    let account: any = null
    if ((p as any).player_account_id) {
      const { data } = await supabase
        .from('player_accounts')
        .select('id, user_id, name, level, rated_matches')
        .eq('id', (p as any).player_account_id)
        .maybeSingle()
      account = data
    }
    if (!account && p.user_id) {
      const { data } = await supabase
        .from('player_accounts')
        .select('id, user_id, name, level, rated_matches')
        .eq('user_id', p.user_id)
        .maybeSingle()
      account = data
    }
    if (account) accountByPlayer.set(p.id, account)
  }

  const champions: PodiumBonusResult['champions'] = []
  const finalists: PodiumBonusResult['finalists'] = []
  const pointRows: Array<{
    user_id: string
    organization_id: string
    points_awarded: number
    reason: string
    reference_id: string
  }> = []

  const applyBonus = async (
    playerId: string,
    bonus: number,
    reason: 'tournament_winner' | 'tournament_finalist',
    rankingPoints: number,
  ) => {
    const acct = accountByPlayer.get(playerId)
    if (!acct?.user_id) return null

    // Idempotência por jogador+torneio+delta de pódio
    const { data: already } = await supabase
      .from('player_level_history')
      .select('id')
      .eq('player_account_id', acct.id)
      .eq('source_id', tournamentId)
      .eq('delta', bonus)
      .limit(1)

    if (already && already.length > 0) {
      return null
    }

    const levelBefore = Number(acct.level ?? 3.0)
    const levelAfter = Math.max(0.5, Math.min(7.0, parseFloat((levelBefore + bonus).toFixed(2))))
    const matches = acct.rated_matches ?? 0

    // Bónus directo — NÃO incrementa rated_matches / wins / losses
    const { error: updErr } = await supabase
      .from('player_accounts')
      .update({ level: levelAfter, updated_at: new Date().toISOString() })
      .eq('id', acct.id)

    if (updErr) {
      console.error('[RatingEngine] Podium level update failed:', acct.id, updErr)
      return null
    }

    await supabase.from('player_level_history').insert({
      player_account_id: acct.id,
      level_before: parseFloat(levelBefore.toFixed(2)),
      level_after: parseFloat(levelAfter.toFixed(2)),
      delta: parseFloat(bonus.toFixed(4)),
      match_type: 'tournament',
      match_won: reason === 'tournament_winner' ? true : false,
      source_id: tournamentId,
    })

    if (organizationId) {
      pointRows.push({
        user_id: acct.user_id,
        organization_id: organizationId,
        points_awarded: rankingPoints,
        reason,
        reference_id: tournamentId,
      })
    }

    const { k, is_tournament_boost } = getKFactor(matches, true)
    return {
      id: acct.id,
      user_id: acct.user_id,
      name: acct.name || '',
      rating: levelAfter,
      matches,
      delta: bonus,
      won: reason === 'tournament_winner' ? true : false,
      delta_base: 0,
      k_factor_used: k,
      is_tournament_boost,
      bonus_applied: bonus,
      player_account_id: acct.id,
    }
  }

  for (const pid of championPlayerIds) {
    const row = await applyBonus(pid, PODIUM_BONUS_CHAMPION, 'tournament_winner', RANKING_POINTS.tournament_winner)
    if (row) champions.push(row)
  }
  for (const pid of finalistPlayerIds) {
    const row = await applyBonus(pid, PODIUM_BONUS_FINALIST, 'tournament_finalist', RANKING_POINTS.tournament_finalist)
    if (row) finalists.push(row)
  }

  if (pointRows.length > 0) {
    const { error: ptsErr } = await supabase.from('ranking_point_transactions').insert(pointRows)
    if (ptsErr) {
      console.error('[RatingEngine] ranking_point_transactions insert failed:', ptsErr)
    }
  }

  return {
    applied: champions.length + finalists.length > 0,
    champions,
    finalists,
    message: champions.length + finalists.length > 0
      ? `Pódio aplicado: ${champions.length} campeão(ões), ${finalists.length} finalista(s)`
      : 'Nenhum bónus aplicado',
  }
}

export async function processAllUnratedMatches(
  since?: string,
  onProgress?: (current: number, total: number, info: string) => void
): Promise<{ processed: number; skipped: number; errors: number; total: number }> {
  let query = supabase
    .from('matches')
    .select('id, scheduled_time, tournament_id')
    .eq('status', 'completed')
    .or('rating_processed.is.null,rating_processed.eq.false')
    .order('scheduled_time', { ascending: true })

  if (since) {
    query = query.gte('scheduled_time', since)
  }

  const { data: matches, error } = await query

  if (error) {
    console.error('[RatingEngine] Error fetching matches:', error)
    return { processed: 0, skipped: 0, errors: 1, total: 0 }
  }

  if (!matches || matches.length === 0) {
    return { processed: 0, skipped: 0, errors: 0, total: 0 }
  }

  onProgress?.(0, matches.length, 'A iniciar processamento...')

  const playerCache: PlayerCache = new Map()

  let processed = 0
  let skipped = 0
  let errors = 0

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    try {
      const result = await processMatchRating(match.id, playerCache)
      if (!result) {
        errors++
      } else if (result.skipped) {
        skipped++
      } else {
        processed++
      }
    } catch (err) {
      console.error('[RatingEngine] Error processing match:', match.id, err)
      errors++
    }

    if ((i + 1) % 5 === 0 || i === matches.length - 1) {
      onProgress?.(i + 1, matches.length, `Processados: ${processed} | Saltados: ${skipped} | Erros: ${errors}`)
    }
  }

  const uniquePlayers = playerCache.size
  const maxMatches = Math.max(0, ...Array.from(playerCache.values()).map(p => p.matchCount))
  const summary = `CONCLUÍDO: ${processed} processados, ${skipped} saltados, ${errors} erros de ${matches.length} total | ${uniquePlayers} jogadores atualizados (max ${maxMatches} jogos rated)`
  onProgress?.(matches.length, matches.length, summary)

  return { processed, skipped, errors, total: matches.length }
}
