#!/usr/bin/env node
/**
 * Backfill retroativo do Ranking Deslizante de 12 Meses.
 *
 * Uso:
 *   node scripts/recalculate_12m_rankings.js
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/recalculate_12m_rankings.js
 *
 * 1) Limpa ranking_point_transactions
 * 2) Atribui pontos a torneios completed (12m) conforme tier + posição
 * 3) Atribui +15/+5 a jogos casuais validados (open_game_results confirmed)
 * 4) Imprime Top 5 da vista rolling_12m_rankings
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://rqiwnxcexsccguruiteq.supabase.co'

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxaXdueGNleHNjY2d1cnVpdGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3Njc5MzcsImV4cCI6MjA3NTM0MzkzN30.Dl05zPQDtPVpmvn_Y-JokT3wDq0Oh9uF3op5xcHZpkY'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const TIER_POINTS = {
  master: { first: 1000, second: 600, third_fourth: 360, quarters: 180, participation: 50 },
  regular: { first: 500, second: 300, third_fourth: 180, quarters: 90, participation: 25 },
  social: { first: 250, second: 150, third_fourth: 90, quarters: 45, participation: 15 },
}

const CASUAL_WIN = 15
const CASUAL_LOSS = 5

function resolveTier(t) {
  const name = String(t.name || '').toUpperCase()
  const format = String(t.format || '').toLowerCase()
  const rr = String(t.round_robin_type || '').toLowerCase()
  if (/\bMASTER\b/.test(name) || /\bOFICIAL\b/.test(name)) return 'master'
  if (/\bAPC\b/.test(name) && !/SOCIAL|AMERICANO/.test(name)) return 'master'
  if (format === 'mixed_american' || rr === 'individual' || /SOCIAL|AMERICANO|AMERICAN/.test(name)) {
    return 'social'
  }
  return 'regular'
}

function bucket(pos) {
  if (pos <= 1) return 'first'
  if (pos === 2) return 'second'
  if (pos === 3 || pos === 4) return 'third_fourth'
  if (pos >= 5 && pos <= 8) return 'quarters'
  return 'participation'
}

function reasonFor(pos) {
  const b = bucket(pos)
  if (b === 'first') return 'tournament_winner'
  if (b === 'second') return 'tournament_finalist'
  if (b === 'third_fourth') return 'tournament_semifinal'
  if (b === 'quarters') return 'tournament_quarters'
  return 'tournament_participation'
}

function pointsFor(tier, pos) {
  return TIER_POINTS[tier][bucket(pos)]
}

function monthsAgoIso(months) {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString()
}

async function insertRows(rows) {
  if (!rows.length) return 0
  let total = 0
  const chunk = 250
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk)
    const { data, error } = await supabase.rpc('insert_ranking_point_rows', {
      p_rows: slice,
    })
    if (error) {
      // Fallback: insert directo (service role)
      const { error: insErr } = await supabase.from('ranking_point_transactions').insert(slice)
      if (insErr) throw new Error(`insert failed: ${error.message} / ${insErr.message}`)
      total += slice.length
    } else {
      total += Number(data) || slice.length
    }
  }
  return total
}

async function resolveUserIds(playerIds) {
  if (!playerIds.length) return new Map()
  const map = new Map()
  const chunk = 200
  for (let i = 0; i < playerIds.length; i += chunk) {
    const ids = playerIds.slice(i, i + chunk)
    const { data } = await supabase
      .from('players')
      .select('id, user_id, player_account_id')
      .in('id', ids)
    const needAcct = []
    for (const p of data || []) {
      if (p.user_id) map.set(p.id, p.user_id)
      else if (p.player_account_id) needAcct.push(p)
    }
    if (needAcct.length) {
      const acctIds = [...new Set(needAcct.map((p) => p.player_account_id))]
      const { data: accts } = await supabase
        .from('player_accounts')
        .select('id, user_id')
        .in('id', acctIds)
      const byAcct = new Map((accts || []).map((a) => [a.id, a.user_id]))
      for (const p of needAcct) {
        const uid = byAcct.get(p.player_account_id)
        if (uid) map.set(p.id, uid)
      }
    }
  }
  return map
}

async function processTournaments(sinceIso) {
  console.log('\n== Torneios completed (12m) ==')
  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('id, name, format, round_robin_type, club_id, created_at, end_date, status')
    .eq('status', 'completed')
    .gte('created_at', sinceIso)
    .not('club_id', 'is', null)

  if (error) throw new Error(`tournaments: ${error.message}`)
  console.log(`Encontrados: ${(tournaments || []).length}`)

  let awarded = 0
  let withParticipants = 0

  for (const t of tournaments || []) {
    const tier = resolveTier(t)
    const eventAt = t.end_date
      ? `${t.end_date}T12:00:00.000Z`
      : t.created_at || new Date().toISOString()

    const bestByUser = new Map()

    const { data: placedPlayers } = await supabase
      .from('players')
      .select('id, user_id, player_account_id, final_position')
      .eq('tournament_id', t.id)
      .not('final_position', 'is', null)

    if (placedPlayers && placedPlayers.length > 0) {
      const need = []
      for (const p of placedPlayers) {
        if (p.user_id) {
          const prev = bestByUser.get(p.user_id)
          if (prev == null || p.final_position < prev) bestByUser.set(p.user_id, p.final_position)
        } else if (p.player_account_id) {
          need.push(p)
        }
      }
      if (need.length) {
        const acctIds = [...new Set(need.map((p) => p.player_account_id))]
        const { data: accts } = await supabase
          .from('player_accounts')
          .select('id, user_id')
          .in('id', acctIds)
        const byAcct = new Map((accts || []).map((a) => [a.id, a.user_id]))
        for (const p of need) {
          const uid = byAcct.get(p.player_account_id)
          if (!uid) continue
          const prev = bestByUser.get(uid)
          if (prev == null || p.final_position < prev) bestByUser.set(uid, p.final_position)
        }
      }
    } else {
      const { data: teams } = await supabase
        .from('teams')
        .select('player1_id, player2_id, final_position')
        .eq('tournament_id', t.id)
        .not('final_position', 'is', null)

      const playerIds = []
      const teamRows = []
      for (const team of teams || []) {
        const ids = [team.player1_id, team.player2_id].filter(Boolean)
        playerIds.push(...ids)
        teamRows.push({ ids, position: team.final_position })
      }
      const userByPlayer = await resolveUserIds([...new Set(playerIds)])
      for (const tr of teamRows) {
        for (const pid of tr.ids) {
          const uid = userByPlayer.get(pid)
          if (!uid) continue
          const prev = bestByUser.get(uid)
          if (prev == null || tr.position < prev) bestByUser.set(uid, tr.position)
        }
      }
    }

    if (bestByUser.size === 0) continue
    withParticipants++

    const rows = []
    for (const [userId, position] of bestByUser) {
      rows.push({
        user_id: userId,
        organization_id: t.club_id,
        points_awarded: pointsFor(tier, Number(position)),
        reason: reasonFor(Number(position)),
        reference_id: t.id,
        created_at: eventAt,
      })
    }
    awarded += await insertRows(rows)
    process.stdout.write('.')
  }

  console.log(`\nTorneios com participantes: ${withParticipants} | linhas inseridas: ${awarded}`)
  return awarded
}

async function processCasual(sinceIso) {
  console.log('\n== Jogos casuais validados (12m) ==')
  // "validated" na app = open_game_results.status = 'confirmed'
  // RPC SECURITY DEFINER evita RLS que bloqueia leitura anon
  const { data: results, error } = await supabase.rpc('list_confirmed_casual_results_12m', {
    p_since: sinceIso,
  })

  if (error) throw new Error(`casual RPC: ${error.message}`)

  console.log(`Resultados confirmados: ${(results || []).length}`)
  let awarded = 0

  for (const r of results || []) {
    if (!r.club_id || !r.game_id) continue

    const { data: players, error: rosterErr } = await supabase.rpc('list_open_game_roster', {
      p_game_id: r.game_id,
    })
    if (rosterErr) {
      console.warn(`\nroster ${r.game_id}:`, rosterErr.message)
      continue
    }
    if (!players || players.length < 4) continue

    const sets1 =
      ((r.team1_score_set1 ?? 0) > (r.team2_score_set1 ?? 0) ? 1 : 0) +
      ((r.team1_score_set2 ?? 0) > (r.team2_score_set2 ?? 0) ? 1 : 0) +
      ((r.team1_score_set3 ?? 0) > (r.team2_score_set3 ?? 0) ? 1 : 0)
    const sets2 =
      ((r.team2_score_set1 ?? 0) > (r.team1_score_set1 ?? 0) ? 1 : 0) +
      ((r.team2_score_set2 ?? 0) > (r.team1_score_set2 ?? 0) ? 1 : 0) +
      ((r.team2_score_set3 ?? 0) > (r.team1_score_set3 ?? 0) ? 1 : 0)

    const team1Won = sets1 > sets2
    const draw = sets1 === sets2
    const eventAt = r.created_at || new Date().toISOString()
    const rows = []

    for (const p of players) {
      const userId = p.user_id
      if (!userId) continue

      const pos = p.player_position ?? p.position
      const onTeam1 = pos === 1 || pos === 2
      const won = draw ? false : team1Won ? onTeam1 : !onTeam1
      rows.push({
        user_id: userId,
        organization_id: r.club_id,
        points_awarded: won ? CASUAL_WIN : CASUAL_LOSS,
        reason: won ? 'casual_win' : 'casual_loss',
        reference_id: r.game_id,
        created_at: eventAt,
      })
    }
    if (rows.length === 0) continue
    awarded += await insertRows(rows)
    process.stdout.write('.')
  }

  console.log(`\nLinhas casuais inseridas: ${awarded}`)
  return awarded
}

async function printTop5() {
  console.log('\n== Top 5 rolling_12m_rankings (Top 10 best / global agregado) ==')
  const { data, error } = await supabase
    .from('rolling_12m_rankings')
    .select('user_id, organization_id, total_points, counted_events, total_events, last_activity')
    .order('total_points', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Vista:', error.message)
    return
  }

  const agg = new Map()
  for (const r of data || []) {
    const prev = agg.get(r.user_id) || { points: 0, events: 0 }
    prev.points += Number(r.total_points) || 0
    prev.events += Number(r.counted_events ?? r.total_events) || 0
    agg.set(r.user_id, prev)
  }

  const top = [...agg.entries()]
    .sort((a, b) => b[1].points - a[1].points)
    .slice(0, 5)

  const userIds = top.map(([uid]) => uid)
  const { data: accounts } = await supabase
    .from('player_accounts')
    .select('user_id, name, level')
    .in('user_id', userIds)

  const byUser = new Map((accounts || []).map((a) => [a.user_id, a]))

  top.forEach(([uid, stats], i) => {
    const a = byUser.get(uid)
    console.log(
      `${i + 1}. ${(a?.name || uid).padEnd(28)} | ${String(stats.points).padStart(5)} pts | ${stats.events} eventos | ELO ${Number(a?.level || 0).toFixed(2)}`,
    )
  })
}

async function main() {
  console.log('Recalcular Ranking Deslizante 12 Meses')
  console.log('URL:', SUPABASE_URL)
  console.log('Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon/rpc')

  const since = monthsAgoIso(12)
  console.log('Desde:', since)

  const { data: cleared, error: clearErr } = await supabase.rpc('clear_ranking_point_transactions')
  if (clearErr) throw new Error(`Limpeza falhou: ${clearErr.message}`)
  console.log(`Limpeza: ${cleared} registos apagados`)

  const tPts = await processTournaments(since)
  const cPts = await processCasual(since)
  console.log(`\nTotal linhas inseridas: ${tPts + cPts}`)
  await printTop5()
  console.log('\nConcluído.')
}

main().catch((err) => {
  console.error('\nERRO:', err.message || err)
  process.exit(1)
})
