/**
 * Open Games (Encontrar Jogo) - Data layer
 * Functions to fetch/create/join open games and get club availability.
 */
import { supabase } from './supabase'

// ============================
// Types
// ============================

export interface OpenGamePlayer {
  id: string
  user_id: string
  player_account_id: string | null
  status: 'confirmed' | 'pending' | 'rejected'
  position: number | null
  name?: string
  avatar_url?: string | null
  level?: number | null
  player_category?: string | null
}

export interface OpenGame {
  id: string
  creator_user_id: string
  club_id: string
  club_name: string
  club_logo_url: string | null
  club_city: string | null
  court_id: string | null
  court_name: string | null
  court_type: 'indoor' | 'outdoor' | 'covered' | null
  scheduled_at: string
  duration_minutes: number
  game_type: 'competitive' | 'friendly'
  gender: 'all' | 'male' | 'female' | 'mixed'
  level_min: number
  level_max: number
  price_per_player: number
  max_players: number
  status: 'open' | 'full' | 'cancelled' | 'completed'
  notes: string | null
  players: OpenGamePlayer[]
  created_at: string
}

export interface ClubWithAvailability {
  id: string
  name: string
  logo_url: string | null
  city: string | null
  address: string | null
  courts: { id: string; name: string; hourly_rate: number; peak_rate: number }[]
  operating_hours: { start: string; end: string }
  // Key = date string (YYYY-MM-DD), Value = list of available time slots
  availability: { [date: string]: TimeSlot[] }
}

export interface CourtSlot {
  court_id: string
  court_name: string
  court_type: 'indoor' | 'outdoor' | 'covered' | null // indoor, outdoor, covered
  durations: number[] // available durations in minutes (60, 90)
  price_90: number // price for 90min
  price_60: number // price for 60min
}

export interface TimeSlot {
  time: string // HH:MM
  courts: CourtSlot[] // all available courts at this time
  // Legacy: first court shortcut
  durations: number[]
  court_id: string
  court_name: string
  price_90: number
  price_60: number
}

// ============================
// Fetch open games
// ============================

export async function fetchOpenGames(filters?: {
  clubId?: string
  dateFrom?: string
  dateTo?: string
  timeFrom?: string
  timeTo?: string
}): Promise<OpenGame[]> {
  let query = supabase
    .from('open_games')
    .select('*')
    .in('status', ['open', 'full'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })

  if (filters?.clubId) {
    query = query.eq('club_id', filters.clubId)
  }
  if (filters?.dateFrom) {
    query = query.gte('scheduled_at', filters.dateFrom)
  }
  if (filters?.dateTo) {
    query = query.lte('scheduled_at', filters.dateTo)
  }

  const { data: gamesData, error } = await query
  if (error) {
    console.error('[OpenGames] Error fetching games:', error)
    return []
  }
  if (!gamesData || gamesData.length === 0) return []

  // Fetch all game IDs to get players
  const gameIds = gamesData.map((g: any) => g.id)
  
  // Fetch players for all games
  const { data: playersData } = await supabase
    .from('open_game_players')
    .select('*')
    .in('game_id', gameIds)
    .in('status', ['confirmed', 'pending'])

  // Fetch player account details for all players
  const userIds = [...new Set((playersData || []).map((p: any) => p.user_id))]
  const playerAccountIds = [...new Set((playersData || []).map((p: any) => p.player_account_id).filter(Boolean))]
  let playerAccountsMap: { [key: string]: { name: string; avatar_url: string | null; level: number | null; player_category: string | null } } = {}
  
  // Search by user_id first
  if (userIds.length > 0) {
    const { data: accounts } = await supabase
      .from('player_accounts')
      .select('id, user_id, name, avatar_url, level, player_category')
      .in('user_id', userIds)
    
    if (accounts) {
      accounts.forEach((a: any) => {
        playerAccountsMap[a.user_id] = {
          name: a.name,
          avatar_url: a.avatar_url,
          level: a.level,
          player_category: a.player_category,
        }
        // Also index by account id
        playerAccountsMap['pa_' + a.id] = playerAccountsMap[a.user_id]
      })
    }
  }

  // For any player_account_ids not yet matched, fetch by id
  const missingAccountIds = playerAccountIds.filter(id => !playerAccountsMap['pa_' + id])
  if (missingAccountIds.length > 0) {
    const { data: accounts2 } = await supabase
      .from('player_accounts')
      .select('id, user_id, name, avatar_url, level, player_category')
      .in('id', missingAccountIds)
    
    if (accounts2) {
      accounts2.forEach((a: any) => {
        if (!playerAccountsMap[a.user_id]) {
          playerAccountsMap[a.user_id] = {
            name: a.name,
            avatar_url: a.avatar_url,
            level: a.level,
            player_category: a.player_category,
          }
        }
        playerAccountsMap['pa_' + a.id] = {
          name: a.name,
          avatar_url: a.avatar_url,
          level: a.level,
          player_category: a.player_category,
        }
      })
    }
  }

  // Fetch club details for all games
  const clubIds = [...new Set(gamesData.map((g: any) => g.club_id))]
  let clubsMap: { [id: string]: { name: string; logo_url: string | null; city: string | null } } = {}
  
  if (clubIds.length > 0) {
    const { data: clubs } = await supabase
      .from('clubs')
      .select('id, name, logo_url, city')
      .in('id', clubIds)
    
    if (clubs) {
      clubs.forEach((c: any) => {
        clubsMap[c.id] = { name: c.name, logo_url: c.logo_url, city: c.city }
      })
    }
  }

  // Fetch court details for all games (name + type)
  const courtIds = [...new Set(gamesData.map((g: any) => g.court_id).filter(Boolean))]
  let courtsMap: { [id: string]: { name: string; type: string | null } } = {}

  if (courtIds.length > 0) {
    const { data: courts } = await supabase
      .from('club_courts')
      .select('id, name, type')
      .in('id', courtIds)
    
    if (courts) {
      courts.forEach((c: any) => {
        courtsMap[c.id] = { name: c.name, type: c.type || null }
      })
    }
  }

  // Build the result
  const games: OpenGame[] = gamesData.map((g: any) => {
    const gamePlayers = (playersData || [])
      .filter((p: any) => p.game_id === g.id)
      .map((p: any) => {
        // Prioritize player_account_id (most reliable), then user_id
        const account = (p.player_account_id ? playerAccountsMap['pa_' + p.player_account_id] : null) || playerAccountsMap[p.user_id]
        return {
          id: p.id,
          user_id: p.user_id,
          player_account_id: p.player_account_id,
          status: p.status,
          position: p.position,
          name: account?.name || 'Jogador',
          avatar_url: account?.avatar_url || null,
          level: account?.level || null,
          player_category: account?.player_category || null,
        }
      })

    const club = clubsMap[g.club_id] || { name: 'Clube', logo_url: null, city: null }
    const court = g.court_id ? courtsMap[g.court_id] : null

    return {
      id: g.id,
      creator_user_id: g.creator_user_id,
      club_id: g.club_id,
      club_name: club.name,
      club_logo_url: club.logo_url,
      club_city: club.city,
      court_id: g.court_id,
      court_name: court?.name || null,
      court_type: (court?.type as any) || null,
      scheduled_at: g.scheduled_at,
      duration_minutes: g.duration_minutes,
      game_type: g.game_type,
      gender: g.gender,
      level_min: parseFloat(g.level_min) || 1.0,
      level_max: parseFloat(g.level_max) || 7.0,
      price_per_player: parseFloat(g.price_per_player) || 0,
      max_players: g.max_players,
      status: g.status,
      notes: g.notes,
      players: gamePlayers,
      created_at: g.created_at,
    }
  })

  // Apply time filter if needed
  if (filters?.timeFrom || filters?.timeTo) {
    return games.filter(g => {
      const hour = new Date(g.scheduled_at).getHours()
      const timeFromH = filters?.timeFrom ? parseInt(filters.timeFrom.split(':')[0]) : 0
      const timeToH = filters?.timeTo ? parseInt(filters.timeTo.split(':')[0]) : 24
      return hour >= timeFromH && hour < timeToH
    })
  }

  return games
}

// ============================
// Fetch clubs with availability for "Crie um Jogo"
// ============================

export async function fetchClubsWithAvailability(daysAhead: number = 3): Promise<ClubWithAvailability[]> {
  // 1. Fetch all active clubs
  const { data: clubs, error: clubsError } = await supabase
    .from('clubs')
    .select('id, owner_id, name, logo_url, city, address')
    .eq('is_active', true)
    .order('name')

  if (clubsError || !clubs || clubs.length === 0) {
    console.error('[OpenGames] Error fetching clubs:', clubsError)
    return []
  }

  const result: ClubWithAvailability[] = []
  
  for (const club of clubs) {
    // 2. Fetch courts for this club
    const { data: courts } = await supabase
      .from('club_courts')
      .select('id, name, type, hourly_rate, peak_rate')
      .eq('user_id', club.owner_id)
      .eq('is_active', true)
      .order('name')

    if (!courts || courts.length === 0) continue // Skip clubs without courts

    // 3. Fetch operating hours
    const { data: settings } = await supabase
      .from('user_logo_settings')
      .select('booking_start_time, booking_end_time')
      .eq('user_id', club.owner_id)
      .maybeSingle()

    const startTime = settings?.booking_start_time || '08:00'
    const endTime = settings?.booking_end_time || '22:00'

    // 4. Generate dates
    const dates: string[] = []
    const now = new Date()
    for (let i = 0; i < daysAhead; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() + i)
      dates.push(d.toISOString().split('T')[0])
    }

    // 5. Fetch existing bookings for these days
    const dateFrom = dates[0] + 'T00:00:00'
    const dateTo = dates[dates.length - 1] + 'T23:59:59'
    
    const { data: bookings } = await supabase
      .from('court_bookings')
      .select('court_id, start_time, end_time')
      .in('court_id', courts.map(c => c.id))
      .eq('status', 'confirmed')
      .gte('start_time', dateFrom)
      .lte('start_time', dateTo)

    // 6. Fetch existing open games at this club
    const { data: existingGames } = await supabase
      .from('open_games')
      .select('court_id, scheduled_at, duration_minutes')
      .eq('club_id', club.id)
      .in('status', ['open', 'full'])
      .gte('scheduled_at', dateFrom)
      .lte('scheduled_at', dateTo)

    // 7. Generate available time slots
    const availability: { [date: string]: TimeSlot[] } = {}
    
    for (const date of dates) {
      const slots: TimeSlot[] = []
      const startH = parseInt(startTime.split(':')[0])
      const startM = parseInt(startTime.split(':')[1] || '0')
      const endH = parseInt(endTime.split(':')[0])

      // For today, start from current time + 1 hour (rounded to 30min)
      let firstSlotH = startH
      let firstSlotM = startM
      if (date === dates[0]) {
        const currentH = now.getHours()
        const currentM = now.getMinutes()
        firstSlotH = currentM > 30 ? currentH + 2 : currentH + 1
        firstSlotM = currentM > 30 ? 0 : 30
        if (firstSlotH < startH) {
          firstSlotH = startH
          firstSlotM = startM
        }
      }

      // Generate 30-minute slots
      for (let h = firstSlotH; h < endH; h++) {
        for (let m = (h === firstSlotH ? firstSlotM : 0); m < 60; m += 30) {
          const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
          const slotStart = new Date(`${date}T${timeStr}:00`)
          const closingTime = new Date(`${date}T${endTime}:00`)
          
          // Check ALL courts for availability at this time
          const courtSlots: CourtSlot[] = []
          for (const court of courts) {
            const slot90End = new Date(slotStart.getTime() + 90 * 60000)
            const slot60End = new Date(slotStart.getTime() + 60 * 60000)

            const has90 = slot90End <= closingTime && isSlotAvailable(court.id, slotStart, slot90End, bookings || [], existingGames || [])
            const has60 = slot60End <= closingTime && isSlotAvailable(court.id, slotStart, slot60End, bookings || [], existingGames || [])

            if (has90 || has60) {
              const durations: number[] = []
              if (has90) durations.push(90)
              if (has60) durations.push(60)

              // Calculate price (per 4 players)
              const hourlyRate = parseFloat(court.hourly_rate as any) || 0
              const price90 = Math.round((hourlyRate * 1.5) / 4 * 100) / 100
              const price60 = Math.round((hourlyRate * 1) / 4 * 100) / 100

              courtSlots.push({
                court_id: court.id,
                court_name: court.name,
                court_type: (court as any).type || null,
                durations,
                price_90: price90,
                price_60: price60,
              })
            }
          }

          if (courtSlots.length > 0) {
            slots.push({
              time: timeStr,
              courts: courtSlots,
              // Legacy defaults from first court
              durations: courtSlots[0].durations,
              court_id: courtSlots[0].court_id,
              court_name: courtSlots[0].court_name,
              price_90: courtSlots[0].price_90,
              price_60: courtSlots[0].price_60,
            })
          }
        }
      }
      
      if (slots.length > 0) {
        availability[date] = slots
      }
    }

    if (Object.keys(availability).length > 0) {
      result.push({
        id: club.id,
        name: club.name,
        logo_url: club.logo_url,
        city: club.city,
        address: club.address,
        courts: courts.map(c => ({
          id: c.id,
          name: c.name,
          hourly_rate: parseFloat(c.hourly_rate as any) || 0,
          peak_rate: parseFloat(c.peak_rate as any) || 0,
        })),
        operating_hours: { start: startTime, end: endTime },
        availability,
      })
    }
  }

  return result
}

function isSlotAvailable(
  courtId: string,
  slotStart: Date,
  slotEnd: Date,
  bookings: any[],
  existingGames: any[]
): boolean {
  // Check against bookings
  for (const b of bookings) {
    if (b.court_id !== courtId) continue
    const bStart = new Date(b.start_time)
    const bEnd = new Date(b.end_time)
    if (slotStart < bEnd && slotEnd > bStart) return false // Overlap
  }
  
  // Check against existing open games
  for (const g of existingGames) {
    if (g.court_id !== courtId) continue
    const gStart = new Date(g.scheduled_at)
    const gEnd = new Date(gStart.getTime() + (g.duration_minutes || 90) * 60000)
    if (slotStart < gEnd && slotEnd > gStart) return false
  }
  
  return true
}

// ============================
// Create a new open game
// ============================

export async function createOpenGame(params: {
  userId: string
  playerAccountId?: string | null
  playerName?: string | null
  playerPhone?: string | null
  clubId: string
  courtId: string
  scheduledAt: string
  durationMinutes: number
  gameType: 'competitive' | 'friendly'
  gender: 'all' | 'male' | 'female' | 'mixed'
  playerLevel: number
  pricePerPlayer: number
}): Promise<{ success: boolean; gameId?: string; error?: string }> {
  // Always use the real auth uid for RLS compliance
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const realUserId = authUser?.id
  if (!realUserId) {
    return { success: false, error: 'Utilizador não autenticado' }
  }
  // Creating game with realUserId (auth.uid)

  // Calculate level range (±0.5 from player level)
  const levelMin = Math.max(1.0, params.playerLevel - 0.5)
  const levelMax = Math.min(7.0, params.playerLevel + 0.5)

  // Create the game
  const { data: game, error: gameError } = await supabase
    .from('open_games')
    .insert({
      creator_user_id: realUserId,
      club_id: params.clubId,
      court_id: params.courtId,
      scheduled_at: params.scheduledAt,
      duration_minutes: params.durationMinutes,
      game_type: params.gameType,
      gender: params.gender,
      level_min: levelMin,
      level_max: levelMax,
      price_per_player: params.pricePerPlayer,
      max_players: 4,
      status: 'open',
    })
    .select('id')
    .single()

  if (gameError || !game) {
    console.error('[OpenGames] Error creating game:', gameError)
    return { success: false, error: gameError?.message || 'Erro ao criar jogo' }
  }

  // Use player data passed directly (most reliable) or look up as fallback
  const playerAccountId = params.playerAccountId || null
  const playerName = params.playerName || null
  const playerPhone = params.playerPhone || null

  // Only query if we don't have the data already
  let resolvedAccountId = playerAccountId
  let resolvedName = playerName
  let resolvedPhone = playerPhone

  if (!resolvedAccountId || !resolvedName) {
    // Try by params.userId first (the player_accounts.user_id), then realUserId
    const { data: pa } = await supabase
      .from('player_accounts')
      .select('id, name, phone_number')
      .eq('user_id', params.userId)
      .maybeSingle()

    if (pa) {
      resolvedAccountId = resolvedAccountId || pa.id
      resolvedName = resolvedName || pa.name
      resolvedPhone = resolvedPhone || pa.phone_number
    }
  }

  // Add creator as first player (use realUserId for RLS)
  const { error: playerError } = await supabase
    .from('open_game_players')
    .insert({
      game_id: game.id,
      user_id: realUserId,
      player_account_id: resolvedAccountId,
      status: 'confirmed',
      position: 1,
    })

  if (playerError) {
    console.error('[OpenGames] Error adding creator to game:', playerError)
  }

  // === Sync: Create a court_booking in the Manager app's agenda ===
  try {
    // Get the club owner_id (needed for the booking user_id)
    const { data: club } = await supabase
      .from('clubs')
      .select('owner_id')
      .eq('id', params.clubId)
      .single()

    if (club) {
      const endTime = new Date(new Date(params.scheduledAt).getTime() + params.durationMinutes * 60000)
      const gameTypeLabel = params.gameType === 'competitive' ? 'Competitivo' : 'Amigável'
      const bookingName = resolvedName || 'Jogador'
      const totalPrice = params.pricePerPlayer * 4

      await supabase.from('court_bookings').insert({
        user_id: club.owner_id,
        court_id: params.courtId,
        start_time: params.scheduledAt,
        end_time: endTime.toISOString(),
        booked_by_name: bookingName,
        booked_by_phone: resolvedPhone || null,
        player1_name: bookingName,
        player1_phone: resolvedPhone || null,
        player1_is_member: false,
        player1_discount: 0,
        player2_is_member: false,
        player2_discount: 0,
        player3_is_member: false,
        player3_discount: 0,
        player4_is_member: false,
        player4_discount: 0,
        status: 'confirmed',
        price: totalPrice,
        payment_status: 'pending',
        event_type: 'open_game',
        notes: `Jogo Aberto (${gameTypeLabel}) - Criado pela app Player | ID: ${game.id}`
      })
      // Court booking created for sync with Manager
    }
  } catch (syncErr) {
    console.error('[OpenGames] Error syncing court booking:', syncErr)
    // Don't fail the game creation if sync fails
  }

  return { success: true, gameId: game.id }
}

// ============================
// Join an open game
// ============================

export async function joinOpenGame(params: {
  gameId: string
  userId: string
  playerAccountId?: string | null
  playerLevel: number
  gameLevelMin: number
  gameLevelMax: number
}): Promise<{ success: boolean; status: 'confirmed' | 'pending'; error?: string }> {
  // Always use real auth uid for RLS
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const realUserId = authUser?.id
  if (!realUserId) {
    return { success: false, status: 'pending', error: 'Utilizador não autenticado' }
  }

  // Check if player is within level range
  const isWithinRange = params.playerLevel >= params.gameLevelMin && params.playerLevel <= params.gameLevelMax
  const joinStatus = isWithinRange ? 'confirmed' : 'pending'

  // Use provided playerAccountId or look up
  let resolvedAccountId = params.playerAccountId || null
  if (!resolvedAccountId) {
    const { data: pa } = await supabase
      .from('player_accounts')
      .select('id')
      .eq('user_id', params.userId)
      .maybeSingle()
    resolvedAccountId = pa?.id || null
  }

  // Get current player count to determine position
  const { data: existingPlayers } = await supabase
    .from('open_game_players')
    .select('position')
    .eq('game_id', params.gameId)
    .eq('status', 'confirmed')
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = (existingPlayers && existingPlayers.length > 0) 
    ? (existingPlayers[0].position || 0) + 1 
    : 1

  const { error } = await supabase
    .from('open_game_players')
    .insert({
      game_id: params.gameId,
      user_id: realUserId,
      player_account_id: resolvedAccountId,
      status: joinStatus,
      position: joinStatus === 'confirmed' ? nextPosition : null,
    })

  if (error) {
    if (error.code === '23505') {
      return { success: false, status: joinStatus, error: 'Já estás inscrito neste jogo' }
    }
    console.error('[OpenGames] Error joining game:', error)
    return { success: false, status: joinStatus, error: error.message }
  }

  // Check if game is now full
  if (joinStatus === 'confirmed') {
    const { data: confirmedPlayers } = await supabase
      .from('open_game_players')
      .select('id')
      .eq('game_id', params.gameId)
      .eq('status', 'confirmed')

    const { data: game } = await supabase
      .from('open_games')
      .select('max_players')
      .eq('id', params.gameId)
      .single()

    if (confirmedPlayers && game && confirmedPlayers.length >= game.max_players) {
      await supabase
        .from('open_games')
        .update({ status: 'full' })
        .eq('id', params.gameId)
    }
  }

  return { success: true, status: joinStatus }
}

// ============================
// Leave an open game
// ============================

export async function leaveOpenGame(gameId: string, userId: string): Promise<boolean> {
  // Use real auth uid for RLS
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const realUserId = authUser?.id || userId

  const { error } = await supabase
    .from('open_game_players')
    .delete()
    .eq('game_id', gameId)
    .eq('user_id', realUserId)

  if (error) {
    console.error('[OpenGames] Error leaving game:', error)
    return false
  }

  // Re-open game if it was full
  await supabase
    .from('open_games')
    .update({ status: 'open' })
    .eq('id', gameId)
    .eq('status', 'full')

  return true
}

// ============================
// Cancel an open game (creator only)
// ============================

export async function cancelOpenGame(gameId: string): Promise<boolean> {
  const { error } = await supabase
    .from('open_games')
    .update({ status: 'cancelled' })
    .eq('id', gameId)

  if (error) {
    console.error('[OpenGames] Error cancelling game:', error)
    return false
  }

  // Also cancel the corresponding court_booking
  try {
    await supabase
      .from('court_bookings')
      .update({ status: 'cancelled' })
      .like('notes', `%ID: ${gameId}%`)
      .eq('event_type', 'open_game')
  } catch (e) {
    // Don't fail if sync fails
  }

  return true
}

// ============================
// Add a player (by player_account_id) to an open game
// ============================

export async function addPlayerToOpenGame(params: {
  gameId: string
  playerAccountId: string
}): Promise<{ success: boolean; error?: string }> {
  // Get real auth uid for RLS
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const realUserId = authUser?.id
  if (!realUserId) {
    return { success: false, error: 'Utilizador não autenticado' }
  }

  // Get the player account to find their user_id
  const { data: pa } = await supabase
    .from('player_accounts')
    .select('id, user_id, name')
    .eq('id', params.playerAccountId)
    .single()

  if (!pa) {
    return { success: false, error: 'Jogador não encontrado' }
  }

  // Check if already in game
  const { data: existing } = await supabase
    .from('open_game_players')
    .select('id')
    .eq('game_id', params.gameId)
    .eq('player_account_id', params.playerAccountId)
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'Jogador já está no jogo' }
  }

  // Get current player count to determine position
  const { data: existingPlayers } = await supabase
    .from('open_game_players')
    .select('position')
    .eq('game_id', params.gameId)
    .eq('status', 'confirmed')
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = (existingPlayers && existingPlayers.length > 0)
    ? (existingPlayers[0].position || 0) + 1
    : 1

  // Insert the player - use realUserId as the one performing the action (for RLS)
  // but store the actual player's user_id
  const { error } = await supabase
    .from('open_game_players')
    .insert({
      game_id: params.gameId,
      user_id: pa.user_id || realUserId,
      player_account_id: pa.id,
      status: 'confirmed',
      position: nextPosition,
    })

  if (error) {
    console.error('[OpenGames] Error adding player to game:', error)
    return { success: false, error: error.message }
  }

  // Check if game is now full
  const { data: allPlayers } = await supabase
    .from('open_game_players')
    .select('id')
    .eq('game_id', params.gameId)
    .eq('status', 'confirmed')

  const { data: game } = await supabase
    .from('open_games')
    .select('max_players')
    .eq('id', params.gameId)
    .single()

  if (allPlayers && game && allPlayers.length >= game.max_players) {
    await supabase
      .from('open_games')
      .update({ status: 'full' })
      .eq('id', params.gameId)
  }

  return { success: true }
}

// ============================
// Search player accounts by name
// ============================

export async function searchPlayerAccounts(query: string): Promise<{
  id: string
  name: string
  avatar_url: string | null
  level: number | null
  player_category: string | null
  phone_number: string | null
}[]> {
  if (!query || query.length < 2) return []

  const { data, error } = await supabase
    .from('player_accounts')
    .select('id, name, avatar_url, level, player_category, phone_number')
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(10)

  if (error || !data) return []
  return data
}
