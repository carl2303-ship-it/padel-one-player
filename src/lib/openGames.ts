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

export async function fetchClubsWithAvailability(): Promise<ClubWithAvailability[]> {
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

    // 3. Fetch operating hours + slot settings
    const { data: settings } = await supabase
      .from('user_logo_settings')
      .select('booking_start_time, booking_end_time, booking_slot_duration, max_advance_days')
      .eq('user_id', club.owner_id)
      .maybeSingle()

    const startTime = settings?.booking_start_time || '08:00'
    const endTime = settings?.booking_end_time || '22:00'
    const slotDuration = settings?.booking_slot_duration || 90 // minutes
    const daysAhead = settings?.max_advance_days || 7

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

    // 7. Generate available time slots using club's slot duration
    const availability: { [date: string]: TimeSlot[] } = {}
    const openH = parseInt(startTime.split(':')[0])
    const openM = parseInt(startTime.split(':')[1] || '0')
    const closeH = parseInt(endTime.split(':')[0])
    const closeM = parseInt(endTime.split(':')[1] || '0')
    const openMinutes = openH * 60 + openM
    const closeMinutes = closeH * 60 + closeM
    
    for (const date of dates) {
      const slots: TimeSlot[] = []

      // For today, skip slots that already passed (current time + 1 hour buffer)
      let firstSlotMinutes = openMinutes
      if (date === dates[0]) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes()
        const minStart = currentMinutes + 60 // at least 1 hour from now
        // Round up to next slot boundary
        if (minStart > openMinutes) {
          const elapsed = minStart - openMinutes
          const slotsSkipped = Math.ceil(elapsed / slotDuration)
          firstSlotMinutes = openMinutes + slotsSkipped * slotDuration
        }
      }

      // Generate slots at fixed intervals (e.g. every 90 min: 9:00, 10:30, 12:00, ...)
      for (let m = firstSlotMinutes; m + slotDuration <= closeMinutes; m += slotDuration) {
        const h = Math.floor(m / 60)
        const min = m % 60
        const timeStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
        const slotStart = new Date(`${date}T${timeStr}:00`)
        const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000)
        const closingTime = new Date(`${date}T${endTime}:00`)
          
        if (slotEnd > closingTime) continue

        // Check ALL courts for availability at this time
        const courtSlots: CourtSlot[] = []
        for (const court of courts) {
          const isAvailable = isSlotAvailable(court.id, slotStart, slotEnd, bookings || [], existingGames || [])

          if (isAvailable) {
            // Calculate price (per 4 players)
            const hourlyRate = parseFloat(court.hourly_rate as any) || 0
            const priceForSlot = Math.round((hourlyRate * (slotDuration / 60)) / 4 * 100) / 100
            const price60 = Math.round((hourlyRate * 1) / 4 * 100) / 100

            courtSlots.push({
              court_id: court.id,
              court_name: court.name,
              court_type: (court as any).type || null,
              durations: [slotDuration],
              price_90: priceForSlot,
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
    const msg = gameError?.message || 'Erro ao criar jogo'
    const hint = gameError?.code === '42501' 
      ? ' (Sem permissão — verifique as políticas RLS)' 
      : gameError?.code === '23503' 
        ? ' (Referência inválida — clube ou campo não existe)' 
        : ''
    return { success: false, error: msg + hint }
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
        price: params.pricePerPlayer * 4,
        payment_status: 'pending',
        event_type: 'open_game',
        notes: `Jogo Aberto (${gameTypeLabel}) - Criado pela app Player | ID: ${game.id}`
      })
      // Sync player details + member check to the booking
      await syncBookingPlayers(game.id)
    }
  } catch (syncErr) {
    console.error('[OpenGames] Error syncing court booking:', syncErr)
    // Don't fail the game creation if sync fails
  }

  // Award reward points for creating a game
  if (resolvedAccountId) {
    try {
      await awardGameRewardPoints(game.id, 'create_game')
    } catch {}
  }

  return { success: true, gameId: game.id }
}

// ============================
// Sync open game players → court_booking (names, phones, member discounts)
// ============================

async function syncBookingPlayers(gameId: string) {
  try {
    // 1. Get all confirmed players for this game
    const { data: gamePlayers } = await supabase
      .from('open_game_players')
      .select('player_account_id, user_id, position')
      .eq('game_id', gameId)
      .eq('status', 'confirmed')
      .order('position', { ascending: true })

    if (!gamePlayers) return

    // 2. Get player account details (name, phone)
    const accountIds = gamePlayers.map(p => p.player_account_id).filter(Boolean)
    let accountsMap: Record<string, { name: string; phone: string | null }> = {}

    if (accountIds.length > 0) {
      const { data: accounts } = await supabase
        .from('player_accounts')
        .select('id, name, phone_number')
        .in('id', accountIds)

      if (accounts) {
        accounts.forEach(a => {
          accountsMap[a.id] = { name: a.name, phone: a.phone_number }
        })
      }
    }

    // 3. Get the game's club to find club owner
    const { data: game } = await supabase
      .from('open_games')
      .select('club_id, price_per_player')
      .eq('id', gameId)
      .single()

    if (!game) return

    const { data: club } = await supabase
      .from('clubs')
      .select('owner_id')
      .eq('id', game.club_id)
      .single()

    if (!club) return

    // 4. Build player data (up to 4 players)
    const playerSlots: { name: string | null; phone: string | null; isMember: boolean; discount: number }[] = []

    for (let i = 0; i < 4; i++) {
      const gp = gamePlayers[i]
      if (gp && gp.player_account_id && accountsMap[gp.player_account_id]) {
        const acct = accountsMap[gp.player_account_id]
        playerSlots.push({ name: acct.name, phone: acct.phone || null, isMember: false, discount: 0 })
      } else if (gp) {
        playerSlots.push({ name: null, phone: null, isMember: false, discount: 0 })
      } else {
        playerSlots.push({ name: null, phone: null, isMember: false, discount: 0 })
      }
    }

    // 5. Check member status for each player
    for (let i = 0; i < playerSlots.length; i++) {
      const ps = playerSlots[i]
      if (!ps.name && !ps.phone) continue

      const normalizedPhone = ps.phone ? ps.phone.replace(/[\s\-\(\)\.]/g, '').replace(/^00/, '+') : ''

      let query = supabase
        .from('member_subscriptions')
        .select('member_name, member_phone, plan:membership_plans(name, court_discount_percent)')
        .eq('club_owner_id', club.owner_id)
        .eq('status', 'active')

      if (normalizedPhone && normalizedPhone.length >= 6) {
        query = query.or(`member_phone.ilike.%${normalizedPhone}%`)
      } else if (ps.name && ps.name.length >= 2) {
        query = query.ilike('member_name', `%${ps.name}%`)
      } else {
        continue
      }

      const { data: memberData } = await query.limit(1).maybeSingle()

      if (memberData && memberData.plan) {
        playerSlots[i].isMember = true
        playerSlots[i].discount = (memberData.plan as any).court_discount_percent || 0
      }
    }

    // 6. Calculate price with discounts
    const pricePerPlayer = parseFloat(game.price_per_player) || 0
    let totalPrice = 0
    for (const ps of playerSlots) {
      if (ps.name) {
        const playerPrice = pricePerPlayer - (pricePerPlayer * (ps.discount / 100))
        totalPrice += playerPrice
      }
    }
    // If less than 4 named players, fill remaining with full price
    const namedCount = playerSlots.filter(p => p.name).length
    if (namedCount < 4) {
      totalPrice += pricePerPlayer * (4 - namedCount)
    }

    // 7. Update the court_booking
    const updateData: Record<string, any> = {
      booked_by_name: playerSlots[0].name || 'Jogador',
      booked_by_phone: playerSlots[0].phone || null,
      player1_name: playerSlots[0].name || null,
      player1_phone: playerSlots[0].phone || null,
      player1_is_member: playerSlots[0].isMember,
      player1_discount: playerSlots[0].discount,
      player2_name: playerSlots[1].name || null,
      player2_phone: playerSlots[1].phone || null,
      player2_is_member: playerSlots[1].isMember,
      player2_discount: playerSlots[1].discount,
      player3_name: playerSlots[2].name || null,
      player3_phone: playerSlots[2].phone || null,
      player3_is_member: playerSlots[2].isMember,
      player3_discount: playerSlots[2].discount,
      player4_name: playerSlots[3].name || null,
      player4_phone: playerSlots[3].phone || null,
      player4_is_member: playerSlots[3].isMember,
      player4_discount: playerSlots[3].discount,
      price: totalPrice,
    }

    await supabase
      .from('court_bookings')
      .update(updateData)
      .like('notes', `%ID: ${gameId}%`)
      .eq('event_type', 'open_game')

  } catch (err) {
    console.error('[OpenGames] Error syncing booking players:', err)
  }
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

  // Sync player details to court_booking
  await syncBookingPlayers(params.gameId)

  // Award reward points for joining
  if (joinStatus === 'confirmed') {
    try {
      await awardGameRewardPoints(params.gameId, 'join_game')
    } catch {}
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

  // Sync player details to court_booking
  await syncBookingPlayers(gameId)

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
// Now uses RPC so any confirmed player or club owner can add
// ============================

export async function addPlayerToOpenGame(params: {
  gameId: string
  playerAccountId: string
}): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('add_player_to_open_game', {
    p_game_id: params.gameId,
    p_player_account_id: params.playerAccountId,
  })

  if (error) {
    console.error('[OpenGames] Error adding player to game:', error)
    return { success: false, error: error.message }
  }

  const result = data as any
  if (!result?.success) {
    return { success: false, error: result?.error || 'Erro desconhecido' }
  }

  // Sync player details to court_booking
  await syncBookingPlayers(params.gameId)

  return { success: true }
}

// ============================
// Vote on a join request (accept/reject a pending player)
// ============================

export async function voteOnJoinRequest(
  requestPlayerId: string,
  vote: 'accept' | 'reject'
): Promise<{ success: boolean; resolved?: boolean; newStatus?: string; votesCount?: number; votesNeeded?: number; error?: string }> {
  const { data, error } = await supabase.rpc('vote_on_join_request', {
    p_request_player_id: requestPlayerId,
    p_vote: vote,
  })

  if (error) {
    console.error('[OpenGames] Error voting on request:', error)
    return { success: false, error: error.message }
  }

  const result = data as any
  if (!result?.success) {
    return { success: false, error: result?.error || 'Erro desconhecido' }
  }

  return {
    success: true,
    resolved: result.resolved,
    newStatus: result.new_status,
    votesCount: result.votes_count,
    votesNeeded: result.votes_needed,
  }
}

// ============================
// Fetch votes for pending players in a game
// ============================

export async function fetchJoinVotes(gameId: string): Promise<{
  requestPlayerId: string
  voterUserId: string
  vote: 'accept' | 'reject'
}[]> {
  const { data, error } = await supabase
    .from('open_game_join_votes')
    .select('request_player_id, voter_user_id, vote')
    .eq('game_id', gameId)

  if (error || !data) return []
  return data as any[]
}

// ============================
// Fetch pending requests for games I'm in
// ============================

export async function fetchMyGamesPendingRequests(userId: string): Promise<{
  gameId: string
  pendingPlayers: OpenGamePlayer[]
  myVotes: { requestPlayerId: string; vote: string }[]
}[]> {
  // 1. Get games where I'm confirmed
  const { data: myGames } = await supabase
    .from('open_game_players')
    .select('game_id')
    .eq('user_id', userId)
    .eq('status', 'confirmed')

  if (!myGames || myGames.length === 0) return []

  const gameIds = myGames.map(g => g.game_id)

  // 2. Get all pending players in those games
  const { data: pendingData } = await supabase
    .from('open_game_players')
    .select('*')
    .in('game_id', gameIds)
    .eq('status', 'pending')

  if (!pendingData || pendingData.length === 0) return []

  // 3. Get player details
  const userIds = [...new Set(pendingData.map(p => p.user_id))]
  const accountIds = [...new Set(pendingData.map(p => p.player_account_id).filter(Boolean))]
  let detailsMap: Record<string, { name: string; avatar_url: string | null; level: number | null; player_category: string | null }> = {}

  if (userIds.length > 0) {
    const { data: accounts } = await supabase
      .from('player_accounts')
      .select('id, user_id, name, avatar_url, level, player_category')
      .in('user_id', userIds)
    if (accounts) {
      accounts.forEach(a => {
        detailsMap[a.user_id] = { name: a.name, avatar_url: a.avatar_url, level: a.level, player_category: a.player_category }
        detailsMap['pa_' + a.id] = detailsMap[a.user_id]
      })
    }
  }

  // 4. Get my votes
  const pendingIds = pendingData.map(p => p.id)
  const { data: votesData } = await supabase
    .from('open_game_join_votes')
    .select('request_player_id, voter_user_id, vote')
    .in('request_player_id', pendingIds)
    .eq('voter_user_id', userId)

  const myVotesMap = new Map<string, string>()
  ;(votesData || []).forEach((v: any) => myVotesMap.set(v.request_player_id, v.vote))

  // 5. Group by game
  const gamesMap = new Map<string, { pendingPlayers: OpenGamePlayer[]; myVotes: { requestPlayerId: string; vote: string }[] }>()

  for (const p of pendingData) {
    if (!gamesMap.has(p.game_id)) {
      gamesMap.set(p.game_id, { pendingPlayers: [], myVotes: [] })
    }
    const entry = gamesMap.get(p.game_id)!
    const details = detailsMap[p.user_id] || (p.player_account_id ? detailsMap['pa_' + p.player_account_id] : null)
    entry.pendingPlayers.push({
      id: p.id,
      user_id: p.user_id,
      player_account_id: p.player_account_id,
      status: p.status,
      position: p.position,
      name: details?.name || 'Jogador',
      avatar_url: details?.avatar_url || null,
      level: details?.level || null,
      player_category: details?.player_category || null,
    })
    if (myVotesMap.has(p.id)) {
      entry.myVotes.push({ requestPlayerId: p.id, vote: myVotesMap.get(p.id)! })
    }
  }

  return Array.from(gamesMap.entries()).map(([gameId, data]) => ({
    gameId,
    ...data,
  }))
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

// ============================
// Open Game Results
// ============================

export interface OpenGameResult {
  id: string
  game_id: string
  submitted_by_user_id: string
  submitted_by_player_account_id: string | null
  submitted_by_team: number
  team1_score_set1: number
  team2_score_set1: number
  team1_score_set2: number
  team2_score_set2: number
  team1_score_set3: number
  team2_score_set3: number
  status: 'pending' | 'confirmed' | 'disputed'
  confirmed_by_user_id: string | null
  confirmed_at: string | null
  rating_processed: boolean
  created_at: string
}

export async function fetchGameResult(gameId: string): Promise<OpenGameResult | null> {
  const { data, error } = await supabase
    .from('open_game_results')
    .select('*')
    .eq('game_id', gameId)
    .maybeSingle()

  if (error || !data) return null
  return data as OpenGameResult
}

export async function submitGameResult(params: {
  gameId: string
  t1Set1: number; t2Set1: number
  t1Set2: number; t2Set2: number
  t1Set3?: number; t2Set3?: number
}): Promise<{ success: boolean; submittedByTeam?: number; error?: string }> {
  const { data, error } = await supabase.rpc('submit_open_game_result', {
    p_game_id: params.gameId,
    p_t1_set1: params.t1Set1,
    p_t2_set1: params.t2Set1,
    p_t1_set2: params.t1Set2,
    p_t2_set2: params.t2Set2,
    p_t1_set3: params.t1Set3 ?? 0,
    p_t2_set3: params.t2Set3 ?? 0,
  })

  if (error) {
    console.error('[OpenGames] Error submitting result:', error)
    return { success: false, error: error.message }
  }

  const result = data as any
  if (!result?.success) {
    return { success: false, error: result?.error || 'Erro desconhecido' }
  }

  // Award reward points for submitting result
  try {
    await awardGameRewardPoints(params.gameId, 'submit_result')
  } catch {}

  return { success: true, submittedByTeam: result.submitted_by_team }
}

export async function confirmGameResult(gameId: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('confirm_open_game_result', {
    p_game_id: gameId,
  })

  if (error) {
    console.error('[OpenGames] Error confirming result:', error)
    return { success: false, error: error.message }
  }

  const result = data as any
  if (!result?.success) {
    return { success: false, error: result?.error || 'Erro desconhecido' }
  }

  // Process rating after confirmation
  try {
    await processOpenGameRating(gameId)
  } catch (err) {
    console.error('[OpenGames] Error processing rating after confirmation:', err)
  }

  // Award reward points
  try {
    await awardGameRewardPoints(gameId, 'confirm_result')
  } catch (err) {
    console.error('[OpenGames] Error awarding reward points:', err)
  }

  return { success: true }
}

export async function disputeGameResult(gameId: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('dispute_open_game_result', {
    p_game_id: gameId,
  })

  if (error) {
    console.error('[OpenGames] Error disputing result:', error)
    return { success: false, error: error.message }
  }

  const result = data as any
  if (!result?.success) {
    return { success: false, error: result?.error || 'Erro desconhecido' }
  }

  return { success: true }
}

// ============================
// Process rating for an open game
// ============================

async function processOpenGameRating(gameId: string): Promise<void> {
  // 1. Get the confirmed result
  const { data: result } = await supabase
    .from('open_game_results')
    .select('*')
    .eq('game_id', gameId)
    .eq('status', 'confirmed')
    .single()

  if (!result || result.rating_processed) return

  // 2. Get all confirmed players sorted by position
  const { data: players } = await supabase
    .from('open_game_players')
    .select('player_account_id, position')
    .eq('game_id', gameId)
    .eq('status', 'confirmed')
    .order('position', { ascending: true })

  if (!players || players.length < 4) return

  // 3. Get player accounts
  const accountIds = players.map(p => p.player_account_id).filter(Boolean) as string[]
  const { data: accounts } = await supabase
    .from('player_accounts')
    .select('id, user_id, name, level, rated_matches, wins, losses')
    .in('id', accountIds)

  if (!accounts || accounts.length < 4) return

  const accountMap = new Map(accounts.map(a => [a.id, a]))

  // 4. Build ratings (positions 1,2 = team 1; positions 3,4 = team 2)
  const { calculateNewRatings, calculateReliability } = await import('./ratingEngine')

  const buildPlayerRating = (paId: string) => {
    const acct = accountMap.get(paId)
    if (!acct) return null
    return {
      id: acct.id,
      user_id: acct.user_id || '',
      name: acct.name || '',
      rating: acct.level ?? 3.0,
      matches: acct.rated_matches ?? ((acct.wins ?? 0) + (acct.losses ?? 0)),
    }
  }

  const p1 = buildPlayerRating(players[0].player_account_id!)
  const p2 = buildPlayerRating(players[1].player_account_id!)
  const p3 = buildPlayerRating(players[2].player_account_id!)
  const p4 = buildPlayerRating(players[3].player_account_id!)

  if (!p1 || !p2 || !p3 || !p4) return

  const s1 = [result.team1_score_set1 ?? 0, result.team2_score_set1 ?? 0] as [number, number]
  const s2 = [result.team1_score_set2 ?? 0, result.team2_score_set2 ?? 0] as [number, number]
  const s3 = [result.team1_score_set3 ?? 0, result.team2_score_set3 ?? 0] as [number, number]

  const sets1 = (s1[0] > s1[1] ? 1 : 0) + (s2[0] > s2[1] ? 1 : 0) + (s3[0] > s3[1] ? 1 : 0)
  const sets2 = (s1[1] > s1[0] ? 1 : 0) + (s2[1] > s2[0] ? 1 : 0) + (s3[1] > s3[0] ? 1 : 0)
  const gamesTotal1 = s1[0] + s2[0] + s3[0]
  const gamesTotal2 = s1[1] + s2[1] + s3[1]

  if (sets1 === 0 && sets2 === 0) return

  const ratingResult = calculateNewRatings(
    { p1, p2 },
    { p3, p4 },
    { sets1, sets2, gamesTotal1, gamesTotal2 }
  )

  if (ratingResult.skipped || !ratingResult.team1 || !ratingResult.team2) return

  // 5. Update ratings
  const allPlayers = [
    ratingResult.team1.p1, ratingResult.team1.p2,
    ratingResult.team2.p3, ratingResult.team2.p4,
  ]

  for (const rp of allPlayers) {
    const newReliability = calculateReliability(rp.matches)
    await supabase.rpc('update_player_rating', {
      p_player_account_id: rp.id,
      p_new_level: rp.rating,
      p_new_reliability: newReliability,
      p_match_won: rp.won,
    })
  }

  // 6. Mark result as processed
  await supabase
    .from('open_game_results')
    .update({ rating_processed: true, updated_at: new Date().toISOString() })
    .eq('id', result.id)

  console.log('[OpenGames] Rating processed for game:', gameId)
}

// ============================
// Award reward points for game actions
// ============================

export async function awardGameRewardPoints(gameId: string, actionType: string): Promise<void> {
  // Get the game's club
  const { data: game } = await supabase
    .from('open_games')
    .select('club_id')
    .eq('id', gameId)
    .single()

  if (!game) return

  // Get current user's player_account_id
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: pa } = await supabase
    .from('player_accounts')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!pa) return

  await supabase.rpc('award_reward_points', {
    p_player_account_id: pa.id,
    p_club_id: game.club_id,
    p_action_type: actionType,
    p_reference_id: gameId,
  })
}

// ============================
// Fetch player reward points
// ============================

export async function fetchPlayerRewards(playerAccountId: string): Promise<{
  totalPoints: number
  tier: string
  rewards: { clubId: string; clubName: string; points: number; tier: string }[]
}> {
  const { data, error } = await supabase
    .from('player_rewards')
    .select('club_id, total_points, tier, club:clubs(name)')
    .eq('player_account_id', playerAccountId)
    .order('total_points', { ascending: false })

  if (error || !data) return { totalPoints: 0, tier: 'silver', rewards: [] }

  let totalPoints = 0
  const rewards = data.map((r: any) => {
    totalPoints += r.total_points
    return {
      clubId: r.club_id,
      clubName: (r.club as any)?.name || 'Clube',
      points: r.total_points,
      tier: r.tier || 'silver',
    }
  })

  const tier = totalPoints >= 1000 ? 'diamond' : totalPoints >= 500 ? 'platinum' : totalPoints >= 200 ? 'gold' : 'silver'

  return { totalPoints, tier, rewards }
}

export async function fetchRewardTransactions(playerAccountId: string, limit: number = 20): Promise<{
  id: string; actionType: string; points: number; description: string; clubName: string; createdAt: string
}[]> {
  const { data, error } = await supabase
    .from('reward_transactions')
    .select('id, action_type, points, description, created_at, club:clubs(name)')
    .eq('player_account_id', playerAccountId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map((t: any) => ({
    id: t.id,
    actionType: t.action_type,
    points: t.points,
    description: t.description || '',
    clubName: (t.club as any)?.name || 'Clube',
    createdAt: t.created_at,
  }))
}

// ============================
// Reward Catalog & Redemption (Player side)
// ============================

export interface CatalogItem {
  id: string
  club_id: string
  club_name: string
  club_logo_url: string | null
  title: string
  description: string | null
  image_url: string | null
  cost_points: number
  category: string
  stock: number | null
  is_active: boolean
}

export interface RedemptionEntry {
  id: string
  item_title: string
  club_name: string
  points_spent: number
  status: string
  redeemed_at: string
}

export async function fetchRewardCatalog(playerAccountId: string): Promise<{
  items: CatalogItem[]
  pointsByClub: Map<string, number>
}> {
  // Get clubs where the player has rewards
  const { data: playerRewards } = await supabase
    .from('player_rewards')
    .select('club_id, total_points')
    .eq('player_account_id', playerAccountId)

  const pointsByClub = new Map<string, number>()
  const clubIds: string[] = []

  if (playerRewards) {
    playerRewards.forEach(r => {
      pointsByClub.set(r.club_id, r.total_points)
      clubIds.push(r.club_id)
    })
  }

  // Get all active catalog items (from all clubs for now)
  const { data: catalogData, error } = await supabase
    .from('reward_catalog')
    .select('id, club_id, title, description, image_url, cost_points, category, stock, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error || !catalogData) return { items: [], pointsByClub }

  // Get club names
  const allClubIds = [...new Set(catalogData.map(c => c.club_id))]
  const { data: clubs } = await supabase
    .from('clubs')
    .select('id, name, logo_url')
    .in('id', allClubIds)

  const clubMap = new Map((clubs || []).map(c => [c.id, c]))

  const items: CatalogItem[] = catalogData
    .filter(c => c.stock === null || c.stock > 0) // Hide out-of-stock
    .map(c => {
      const club = clubMap.get(c.club_id)
      return {
        ...c,
        club_name: club?.name || 'Clube',
        club_logo_url: club?.logo_url || null,
      }
    })

  return { items, pointsByClub }
}

export async function redeemReward(catalogItemId: string, playerAccountId: string): Promise<{
  success: boolean
  error?: string
  pointsSpent?: number
  remainingPoints?: number
  itemTitle?: string
}> {
  const { data, error } = await supabase.rpc('redeem_reward', {
    p_catalog_item_id: catalogItemId,
    p_player_account_id: playerAccountId,
  })

  if (error) {
    console.error('[Rewards] Error redeeming:', error)
    return { success: false, error: error.message }
  }

  const result = data as any
  if (!result?.success) {
    return { success: false, error: result?.error || 'Erro desconhecido' }
  }

  return {
    success: true,
    pointsSpent: result.points_spent,
    remainingPoints: result.remaining_points,
    itemTitle: result.item_title,
  }
}

export async function fetchMyRedemptions(playerAccountId: string): Promise<RedemptionEntry[]> {
  const { data, error } = await supabase
    .from('reward_redemptions')
    .select('id, points_spent, status, redeemed_at, catalog_item:reward_catalog(title), club:clubs(name)')
    .eq('player_account_id', playerAccountId)
    .order('redeemed_at', { ascending: false })
    .limit(30)

  if (error || !data) return []

  return data.map((r: any) => ({
    id: r.id,
    item_title: (r.catalog_item as any)?.title || 'Item',
    club_name: (r.club as any)?.name || 'Clube',
    points_spent: r.points_spent,
    status: r.status,
    redeemed_at: r.redeemed_at,
  }))
}

// ============================
// Fetch games awaiting result (past games with status full/completed but no result)
// ============================

export async function fetchGamesAwaitingResult(userId: string): Promise<OpenGame[]> {
  // Get games where user is confirmed
  const { data: myGames } = await supabase
    .from('open_game_players')
    .select('game_id')
    .eq('user_id', userId)
    .eq('status', 'confirmed')

  if (!myGames || myGames.length === 0) return []

  const gameIds = myGames.map(g => g.game_id)

  // Fetch games that ended (scheduled_at + duration < now)
  const now = new Date().toISOString()
  const { data: gamesData } = await supabase
    .from('open_games')
    .select('*')
    .in('id', gameIds)
    .in('status', ['full', 'completed'])
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: false })
    .limit(20)

  if (!gamesData || gamesData.length === 0) return []

  // Filter: only games whose end time has passed
  const pastGames = gamesData.filter(g => {
    const endTime = new Date(new Date(g.scheduled_at).getTime() + (g.duration_minutes || 90) * 60000)
    return endTime <= new Date()
  })

  if (pastGames.length === 0) return []

  // Check which games already have results
  const pastGameIds = pastGames.map(g => g.id)
  const { data: existingResults } = await supabase
    .from('open_game_results')
    .select('game_id, status')
    .in('game_id', pastGameIds)

  const resultsMap = new Map((existingResults || []).map(r => [r.game_id, r.status]))

  // Fetch full data for these games using fetchOpenGames pattern
  const gameIdsForFetch = pastGames.map(g => g.id)
  
  const { data: playersData } = await supabase
    .from('open_game_players')
    .select('*')
    .in('game_id', gameIdsForFetch)
    .eq('status', 'confirmed')

  const userIds = [...new Set((playersData || []).map((p: any) => p.user_id))]
  let playerAccountsMap: { [key: string]: { name: string; avatar_url: string | null; level: number | null; player_category: string | null } } = {}
  
  if (userIds.length > 0) {
    const { data: accounts } = await supabase
      .from('player_accounts')
      .select('id, user_id, name, avatar_url, level, player_category')
      .in('user_id', userIds)
    
    if (accounts) {
      accounts.forEach((a: any) => {
        playerAccountsMap[a.user_id] = { name: a.name, avatar_url: a.avatar_url, level: a.level, player_category: a.player_category }
        playerAccountsMap['pa_' + a.id] = playerAccountsMap[a.user_id]
      })
    }
  }

  const clubIds = [...new Set(pastGames.map(g => g.club_id))]
  let clubsMap: { [id: string]: { name: string; logo_url: string | null; city: string | null } } = {}
  if (clubIds.length > 0) {
    const { data: clubs } = await supabase.from('clubs').select('id, name, logo_url, city').in('id', clubIds)
    if (clubs) clubs.forEach((c: any) => { clubsMap[c.id] = { name: c.name, logo_url: c.logo_url, city: c.city } })
  }

  const courtIds = [...new Set(pastGames.filter(g => g.court_id).map(g => g.court_id))]
  let courtsMap: { [id: string]: { name: string; type: string | null } } = {}
  if (courtIds.length > 0) {
    const { data: courts } = await supabase.from('club_courts').select('id, name, type').in('id', courtIds)
    if (courts) courts.forEach((c: any) => { courtsMap[c.id] = { name: c.name, type: c.type || null } })
  }

  return pastGames.map((g: any) => {
    const gamePlayers = (playersData || [])
      .filter((p: any) => p.game_id === g.id)
      .map((p: any) => {
        const account = (p.player_account_id ? playerAccountsMap['pa_' + p.player_account_id] : null) || playerAccountsMap[p.user_id]
        return {
          id: p.id, user_id: p.user_id, player_account_id: p.player_account_id,
          status: p.status, position: p.position,
          name: account?.name || 'Jogador', avatar_url: account?.avatar_url || null,
          level: account?.level || null, player_category: account?.player_category || null,
        }
      })

    const club = clubsMap[g.club_id] || { name: 'Clube', logo_url: null, city: null }
    const court = g.court_id ? courtsMap[g.court_id] : null
    const resultStatus = resultsMap.get(g.id) || null

    return {
      id: g.id, creator_user_id: g.creator_user_id, club_id: g.club_id,
      club_name: club.name, club_logo_url: club.logo_url, club_city: club.city,
      court_id: g.court_id, court_name: court?.name || null,
      court_type: (court?.type as any) || null,
      scheduled_at: g.scheduled_at, duration_minutes: g.duration_minutes,
      game_type: g.game_type, gender: g.gender,
      level_min: parseFloat(g.level_min) || 1.0, level_max: parseFloat(g.level_max) || 7.0,
      price_per_player: parseFloat(g.price_per_player) || 0,
      max_players: g.max_players, status: g.status, notes: g.notes,
      players: gamePlayers, created_at: g.created_at,
      _resultStatus: resultStatus, // extra field for UI
    } as OpenGame & { _resultStatus?: string | null }
  })
}
