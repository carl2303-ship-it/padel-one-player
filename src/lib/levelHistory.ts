import { supabase } from './supabase'

export interface LevelHistoryEntry {
  id: string
  player_account_id: string
  level_before: number
  level_after: number
  delta: number
  match_type: 'tournament' | 'open_game'
  match_won: boolean | null
  created_at: string
}

/**
 * Logs a level change after a rated match is processed.
 * Fire-and-forget — errors are logged but never block the caller.
 */
export async function logLevelChange(
  playerAccountId: string,
  levelBefore: number,
  levelAfter: number,
  delta: number,
  matchType: 'tournament' | 'open_game',
  matchWon: boolean | null,
): Promise<void> {
  try {
    const { error } = await supabase
      .from('player_level_history')
      .insert({
        player_account_id: playerAccountId,
        level_before: parseFloat(levelBefore.toFixed(2)),
        level_after: parseFloat(levelAfter.toFixed(2)),
        delta: parseFloat(delta.toFixed(4)),
        match_type: matchType,
        match_won: matchWon,
      })

    if (error) {
      console.warn('[LevelHistory] Insert failed (table may not exist yet):', error.message)
    }
  } catch (err) {
    console.warn('[LevelHistory] Unexpected error:', err)
  }
}

/**
 * Fetches level history for a player, ordered by most recent first.
 */
export async function fetchLevelHistory(
  playerAccountId: string,
  limit = 20,
): Promise<LevelHistoryEntry[]> {
  try {
    const { data, error } = await supabase
      .from('player_level_history')
      .select('*')
      .eq('player_account_id', playerAccountId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn('[LevelHistory] Fetch failed:', error.message)
      return []
    }

    return (data ?? []) as LevelHistoryEntry[]
  } catch {
    return []
  }
}
