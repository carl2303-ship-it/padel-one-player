/**
 * Padel One Rating Engine
 * Sistema ELO adaptado para Padel em Duplas
 * 
 * Escala: 0.5 (iniciante) a 7.0 (profissional)
 * Fiabilidade: 0% (0 jogos) a 100% (50+ jogos)
 */

import { supabase } from './supabase'

// ============================================
// Types
// ============================================

export interface PlayerRating {
  id: string           // player_accounts.id
  user_id: string      // auth user id
  name: string
  rating: number       // level (ex: 2.5, 4.1)
  matches: number      // total matches played (wins + losses)
}

export interface MatchScore {
  sets1: number        // sets won by team 1
  sets2: number        // sets won by team 2
  gamesTotal1: number  // total games won by team 1 (across all sets)
  gamesTotal2: number  // total games won by team 2
}

export interface RatingResult {
  skipped?: boolean
  message?: string
  team1?: {
    p1: PlayerRating & { delta: number }
    p2: PlayerRating & { delta: number }
  }
  team2?: {
    p3: PlayerRating & { delta: number }
    p4: PlayerRating & { delta: number }
  }
}

// ============================================
// Core Algorithm
// ============================================

/**
 * Calcula os novos ratings de 4 jogadores após um jogo de duplas.
 * Baseado no sistema ELO com adaptações para padel.
 */
export function calculateNewRatings(
  team1: { p1: PlayerRating; p2: PlayerRating },
  team2: { p3: PlayerRating; p4: PlayerRating },
  score: MatchScore
): RatingResult {
  const { p1, p2 } = team1
  const { p3, p4 } = team2

  // 1. Médias de Nível das Equipas
  const avg1 = (p1.rating + p2.rating) / 2
  const avg2 = (p3.rating + p4.rating) / 2

  // 2. Verificação de Disparidade (Regra do 1.0)
  //    Se a diferença de médias for >1.0, o jogo não conta para o rating
  if (Math.abs(avg1 - avg2) > 1.0) {
    return {
      skipped: true,
      message: 'Disparidade demasiado alta (>' + Math.abs(avg1 - avg2).toFixed(2) + '), nível inalterado',
    }
  }

  // 3. Probabilidade de Vitória (Expected Outcome)
  //    Formula standard Elo: 1 / (1 + 10^((avg2 - avg1) / 2))
  //    Divisor 2 porque a escala é 0.5-7.0 (não 0-3000 como no xadrez)
  const expected1 = 1 / (1 + Math.pow(10, (avg2 - avg1) / 2))
  const actual1 = score.sets1 > score.sets2 ? 1 : (score.sets1 < score.sets2 ? 0 : 0.5)

  // 4. Intensidade do Resultado (Multiplicador)
  //    Jogo renhido (3 sets) → menor variação
  //    Vitória dominante (grande diferença de games) → maior variação
  let intensity = 1.0
  const gameDiff = Math.abs(score.gamesTotal1 - score.gamesTotal2)

  if (score.sets1 + score.sets2 === 3) {
    intensity = 0.6 // Jogo muito renhido (3 sets)
  } else if (gameDiff > 8) {
    intensity = 1.3 // Vitória muito clara
  }

  // 5. K-Factor: depende da experiência do jogador
  //    Novos jogadores (<10 jogos): oscilação rápida para encontrar o nível real
  //    Em transição (10-50 jogos): ajuste moderado
  //    Veteranos (50+ jogos): estabilidade
  const getKFactor = (matches: number): number => {
    if (matches < 10) return 0.15
    if (matches < 50) return 0.08
    return 0.04
  }

  // 6. Cálculo do Delta (variação de rating)
  const calculateDelta = (player: PlayerRating, actual: number, expected: number, intens: number): number => {
    const K = getKFactor(player.matches)
    const change = K * (actual - expected) * intens
    return parseFloat(change.toFixed(4))
  }

  const delta1 = calculateDelta(p1, actual1, expected1, intensity)
  const delta2 = calculateDelta(p2, actual1, expected1, intensity)
  const delta3 = calculateDelta(p3, 1 - actual1, 1 - expected1, intensity)
  const delta4 = calculateDelta(p4, 1 - actual1, 1 - expected1, intensity)

  // 7. Clamp para manter dentro da escala 0.5 - 7.0
  const clamp = (val: number) => Math.max(0.5, Math.min(7.0, parseFloat(val.toFixed(2))))

  return {
    team1: {
      p1: { ...p1, rating: clamp(p1.rating + delta1), delta: delta1, matches: p1.matches + 1 },
      p2: { ...p2, rating: clamp(p2.rating + delta2), delta: delta2, matches: p2.matches + 1 },
    },
    team2: {
      p3: { ...p3, rating: clamp(p3.rating + delta3), delta: delta3, matches: p3.matches + 1 },
      p4: { ...p4, rating: clamp(p4.rating + delta4), delta: delta4, matches: p4.matches + 1 },
    },
  }
}

// ============================================
// Fiabilidade (Reliability)
// ============================================

/**
 * Calcula a percentagem de fiabilidade do nível com base no número de jogos RATED.
 * Quanto mais jogos, maior a fiabilidade. Sempre monotonicamente crescente.
 * 
 * 0 jogos → 0%
 * 5 jogos → 25%
 * 10 jogos → 45%
 * 20 jogos → 65%
 * 30 jogos → 80%
 * 50 jogos → 95%
 * 75+ jogos → 100%
 */
export function calculateReliability(totalMatches: number): number {
  if (totalMatches <= 0) return 0
  if (totalMatches >= 75) return 100
  // Curva logarítmica mais suave: 100 * (ln(matches + 1) / ln(76))
  // Garante: monotonicamente crescente, 0→0%, 75→100%
  const reliability = Math.min(100, Math.round(100 * (Math.log(totalMatches + 1) / Math.log(76))))
  return reliability
}

// ============================================
// Player Cache (para acumular durante batch)
// ============================================

/**
 * Cache em memória que mantém ratings e contadores de jogos atualizados
 * durante o processamento de múltiplos jogos.
 * Sem isto, cada jogo leria os mesmos valores da BD.
 */
export interface CachedPlayer {
  id: string
  user_id: string
  name: string
  rating: number
  matchCount: number  // jogos RATED processados (acumulado)
}

export type PlayerCache = Map<string, CachedPlayer>  // key = player_accounts.id

// ============================================
// Supabase Integration
// ============================================

/**
 * Processa o rating de um jogo completado.
 * Busca os dados dos 4 jogadores, calcula os novos ratings, e atualiza no Supabase.
 * 
 * @param matchId - ID do jogo na tabela 'matches'
 * @param cache - Cache opcional de jogadores para acumular ratings entre jogos (batch mode)
 * @returns resultado do cálculo ou null se não foi possível processar
 */
export async function processMatchRating(matchId: string, cache?: PlayerCache): Promise<RatingResult | null> {
  // 1) Buscar o jogo com os IDs das equipas
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select(`
      id, team1_id, team2_id, status,
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
    console.log('[RatingEngine] Match not completed, skipping:', matchId)
    return null
  }

  // 2) Calcular score dos sets e games totais
  const s1 = [match.team1_score_set1 ?? 0, match.team2_score_set1 ?? 0] as [number, number]
  const s2 = [match.team1_score_set2 ?? 0, match.team2_score_set2 ?? 0] as [number, number]
  const s3 = [match.team1_score_set3 ?? 0, match.team2_score_set3 ?? 0] as [number, number]

  const sets1 = (s1[0] > s1[1] ? 1 : 0) + (s2[0] > s2[1] ? 1 : 0) + (s3[0] > s3[1] ? 1 : 0)
  const sets2 = (s1[1] > s1[0] ? 1 : 0) + (s2[1] > s2[0] ? 1 : 0) + (s3[1] > s3[0] ? 1 : 0)
  const gamesTotal1 = s1[0] + s2[0] + s3[0]
  const gamesTotal2 = s1[1] + s2[1] + s3[1]

  if (sets1 === 0 && sets2 === 0) {
    console.log('[RatingEngine] No sets played, skipping:', matchId)
    return null
  }

  const score: MatchScore = { sets1, sets2, gamesTotal1, gamesTotal2 }

  // 3) Identificar os 4 jogadores
  //    Pode ser jogo por equipas (team1_id/team2_id → teams → players)
  //    ou jogo individual (player1_individual_id ... player4_individual_id)
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
    console.log('[RatingEngine] Less than 4 players found, skipping:', matchId, 'found:', playerIds.length)
    return null
  }

  // 4) Buscar dados dos jogadores na tabela 'players' (para ter phone_number/name)
  const { data: playersData } = await supabase
    .from('players')
    .select('id, name, phone_number, user_id')
    .in('id', playerIds)

  if (!playersData || playersData.length < 4) {
    console.log('[RatingEngine] Could not fetch all player entries:', matchId)
    return null
  }

  // 5) Mapear para player_accounts (onde está o rating real)
  //    Procurar por user_id OU phone_number OU name
  //    Se o cache tiver dados, usa o cache (rating + matchCount acumulados)
  const accountsMap = new Map<string, any>() // player.id → player_account

  for (const p of playersData) {
    let account: any = null

    // Tentar por user_id primeiro
    if (p.user_id) {
      const { data } = await supabase
        .from('player_accounts')
        .select('id, user_id, name, level, wins, losses, level_reliability_percent')
        .eq('user_id', p.user_id)
        .maybeSingle()
      if (data) account = data
    }

    // Se não encontrou, tentar por phone_number
    if (!account && p.phone_number) {
      const { data } = await supabase
        .from('player_accounts')
        .select('id, user_id, name, level, wins, losses, level_reliability_percent')
        .eq('phone_number', p.phone_number)
        .maybeSingle()
      if (data) account = data
    }

    // Se não encontrou, tentar por nome
    if (!account && p.name) {
      const { data } = await supabase
        .from('player_accounts')
        .select('id, user_id, name, level, wins, losses, level_reliability_percent')
        .ilike('name', p.name)
        .maybeSingle()
      if (data) account = data
    }

    if (account) {
      accountsMap.set(p.id, account)
    }
  }

  if (accountsMap.size < 4) {
    console.log('[RatingEngine] Could not map all players to accounts:', matchId, 'mapped:', accountsMap.size)
    return null
  }

  // 6) Construir PlayerRating para cada jogador
  //    Se temos cache, usar rating e matchCount do cache (acumulados de jogos anteriores)
  //    Se não, usar valores da BD como ponto de partida
  const buildRating = (playerId: string): PlayerRating | null => {
    const acct = accountsMap.get(playerId)
    if (!acct) return null

    // Verificar se este jogador já está no cache (com rating/matchCount acumulados)
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

    // Primeira vez: usar valores da BD
    // matchCount inicial = wins + losses (jogos existentes antes do processamento)
    return {
      id: acct.id,
      user_id: acct.user_id || '',
      name: acct.name || '',
      rating: acct.level ?? 3.0,
      matches: (acct.wins ?? 0) + (acct.losses ?? 0),
    }
  }

  // Equipa 1: player1_id, player2_id | Equipa 2: player3_id, player4_id
  const p1 = buildRating(playerIds[0])
  const p2 = buildRating(playerIds[1])
  const p3 = buildRating(playerIds[2])
  const p4 = buildRating(playerIds[3])

  if (!p1 || !p2 || !p3 || !p4) {
    console.log('[RatingEngine] Could not build all player ratings')
    return null
  }

  // 7) Calcular novos ratings
  const result = calculateNewRatings({ p1, p2 }, { p3, p4 }, score)

  if (result.skipped) {
    console.log('[RatingEngine] Match skipped:', result.message)
    return result
  }

  // 8) Atualizar cache e Supabase
  if (result.team1 && result.team2) {
    const allUpdatedPlayers = [result.team1.p1, result.team1.p2, result.team2.p3, result.team2.p4]

    for (const rp of allUpdatedPlayers) {
      const newReliability = calculateReliability(rp.matches)

      // Atualizar cache (para o próximo jogo usar valores acumulados)
      if (cache) {
        cache.set(rp.id, {
          id: rp.id,
          user_id: rp.user_id,
          name: rp.name,
          rating: rp.rating,
          matchCount: rp.matches,
        })
      }

      // Atualizar na BD via SECURITY DEFINER function (bypassa RLS)
      const { error } = await supabase.rpc('update_player_rating', {
        p_player_account_id: rp.id,
        p_new_level: rp.rating,
        p_new_reliability: newReliability,
      })

      if (error) {
        console.error('[RatingEngine] Error updating player:', rp.id, error)
      }
    }

    // Marcar jogo como processado via SECURITY DEFINER function
    const { error: markError } = await supabase.rpc('mark_match_rating_processed', {
      p_match_id: matchId,
    })
    if (markError) {
      console.error('[RatingEngine] Error marking match as processed:', matchId, markError)
    }

    console.log('[RatingEngine] Updated ratings for match:', matchId)
    console.log(`  ${result.team1.p1.name}: ${p1.rating.toFixed(2)} → ${result.team1.p1.rating.toFixed(2)} (${result.team1.p1.delta > 0 ? '+' : ''}${result.team1.p1.delta.toFixed(4)}) | jogos: ${result.team1.p1.matches} | fiab: ${calculateReliability(result.team1.p1.matches)}%`)
    console.log(`  ${result.team1.p2.name}: ${p2.rating.toFixed(2)} → ${result.team1.p2.rating.toFixed(2)} (${result.team1.p2.delta > 0 ? '+' : ''}${result.team1.p2.delta.toFixed(4)}) | jogos: ${result.team1.p2.matches} | fiab: ${calculateReliability(result.team1.p2.matches)}%`)
    console.log(`  ${result.team2.p3.name}: ${p3.rating.toFixed(2)} → ${result.team2.p3.rating.toFixed(2)} (${result.team2.p3.delta > 0 ? '+' : ''}${result.team2.p3.delta.toFixed(4)}) | jogos: ${result.team2.p3.matches} | fiab: ${calculateReliability(result.team2.p3.matches)}%`)
    console.log(`  ${result.team2.p4.name}: ${p4.rating.toFixed(2)} → ${result.team2.p4.rating.toFixed(2)} (${result.team2.p4.delta > 0 ? '+' : ''}${result.team2.p4.delta.toFixed(4)}) | jogos: ${result.team2.p4.matches} | fiab: ${calculateReliability(result.team2.p4.matches)}%`)
  }

  return result
}

/**
 * Processa todos os jogos completados de torneios concluídos.
 * Processa cronologicamente para que cada jogo use o rating atualizado do anterior.
 * 
 * IMPORTANTE: Usa um PlayerCache em memória para que:
 * - Ratings acumulem correctamente entre jogos
 * - matchCount incremente a cada jogo processado (fiabilidade sobe!)
 * - Não dependa de wins/losses da BD que não são atualizados aqui
 * 
 * @param since - Data mínima (ISO string). Se não especificado, processa todos.
 * @param onProgress - Callback opcional para reportar progresso
 * @returns resumo do processamento
 */
export async function processAllUnratedMatches(
  since?: string,
  onProgress?: (current: number, total: number, info: string) => void
): Promise<{ processed: number; skipped: number; errors: number; total: number }> {
  // Buscar jogos completados E não processados, ordenados cronologicamente
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
    console.log('[RatingEngine] No matches to process')
    return { processed: 0, skipped: 0, errors: 0, total: 0 }
  }

  console.log(`[RatingEngine] Found ${matches.length} completed matches to process`)
  onProgress?.(0, matches.length, 'A iniciar processamento...')

  // Cache partilhado entre todos os jogos - acumula ratings e matchCount
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

    // Reportar progresso a cada 5 jogos
    if ((i + 1) % 5 === 0 || i === matches.length - 1) {
      onProgress?.(i + 1, matches.length, `Processados: ${processed} | Saltados: ${skipped} | Erros: ${errors}`)
    }
  }

  // Resumo final com estatísticas do cache
  const uniquePlayers = playerCache.size
  const maxMatches = Math.max(0, ...Array.from(playerCache.values()).map(p => p.matchCount))
  const summary = `CONCLUÍDO: ${processed} processados, ${skipped} saltados, ${errors} erros de ${matches.length} total | ${uniquePlayers} jogadores atualizados (max ${maxMatches} jogos rated)`
  console.log(`[RatingEngine] ${summary}`)
  onProgress?.(matches.length, matches.length, summary)

  return { processed, skipped, errors, total: matches.length }
}
