/**
 * Player Data Cache
 * Carrega TODOS os player_accounts uma única vez e fornece
 * acesso instantâneo por nome (fuzzy match) — sem queries adicionais.
 * 
 * Usado por GameCardPlaytomic e outros componentes que precisam
 * de avatar, nível e categoria dos jogadores.
 */

import { supabase } from './supabase'

export interface CachedPlayerData {
  id: string
  name: string
  avatar_url: string | null
  level: number | null
  player_category: string | null
  user_id: string | null
}

// Cache global (module-level singleton)
let cache: Map<string, CachedPlayerData> | null = null
let loadingPromise: Promise<void> | null = null

function normalize(name: string): string {
  return name.toLowerCase().trim()
}

/**
 * Carrega todos os player_accounts em memória.
 * Chamado uma vez na inicialização da app.
 * É idempotente — chamadas subsequentes não refazem a query.
 */
export async function preloadAllPlayerData(): Promise<void> {
  if (cache) return // já carregado
  if (loadingPromise) return loadingPromise // já a carregar

  loadingPromise = (async () => {
    console.time('[PlayerCache] Load all player_accounts')
    const { data, error } = await supabase
      .from('player_accounts')
      .select('id, name, avatar_url, level, player_category, user_id')

    cache = new Map()
    if (data && !error) {
      for (const d of data) {
        if (d.name) {
          cache.set(normalize(d.name), {
            id: d.id,
            name: d.name,
            avatar_url: d.avatar_url,
            level: d.level,
            player_category: d.player_category,
            user_id: d.user_id,
          })
        }
      }
    }
    console.timeEnd('[PlayerCache] Load all player_accounts')
    console.log(`[PlayerCache] ${cache.size} jogadores carregados`)
  })()

  return loadingPromise
}

/**
 * Busca dados de um jogador pelo nome (fuzzy match em memória).
 * Retorna null se não encontrado ou se o cache não foi carregado.
 * 
 * Ordem de matching:
 * 1. Nome exato (case-insensitive)
 * 2. Primeiro + último nome
 * 3. Primeiro nome (se único match)
 */
export function getCachedPlayerData(name: string): CachedPlayerData | null {
  if (!cache || !name || name === 'TBD') return null
  const norm = normalize(name)

  // 1. Match exato
  const exact = cache.get(norm)
  if (exact) return exact

  // 2. Primeiro + último nome
  const parts = norm.split(/\s+/)
  if (parts.length >= 2) {
    const first = parts[0]
    const last = parts[parts.length - 1]
    for (const [key, val] of cache) {
      if (key.startsWith(first) && key.includes(last)) return val
    }
  }

  // 3. Primeiro nome (se resultado único)
  if (parts.length >= 1) {
    const first = parts[0]
    const matches: CachedPlayerData[] = []
    for (const [key, val] of cache) {
      if (key.startsWith(first + ' ') || key === first) matches.push(val)
    }
    if (matches.length === 1) return matches[0]
  }

  return null
}

/**
 * Força recarga do cache (ex: após atualização de perfil).
 */
export function invalidatePlayerCache(): void {
  cache = null
  loadingPromise = null
}

/**
 * Verifica se o cache está carregado.
 */
export function isPlayerCacheLoaded(): boolean {
  return cache !== null
}
