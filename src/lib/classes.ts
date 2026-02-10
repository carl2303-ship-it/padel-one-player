/**
 * Funções para buscar e inscrever-se em aulas
 */
import { supabase } from './supabase'

/** Busca user_id do player_account pelo telefone */
export async function findPlayerUserIdByPhone(phone: string | null): Promise<string | null> {
  if (!phone) return null
  
  // Buscar player_account pelo telefone
  const { data: playerAccount } = await supabase
    .from('player_accounts')
    .select('user_id')
    .eq('phone_number', phone)
    .limit(1)
    .maybeSingle()
  
  return playerAccount?.user_id || null
}

/** Busca user_id do player_account pelo nome */
export async function findPlayerUserIdByName(name: string | null): Promise<string | null> {
  if (!name || name.trim().length === 0) return null
  const trimmed = name.trim()
  
  // 1. Busca exata pelo nome
  const { data: exact } = await supabase
    .from('player_accounts')
    .select('user_id')
    .eq('name', trimmed)
    .limit(1)
    .maybeSingle()
  if (exact?.user_id) return exact.user_id
  
  // 2. Busca case-insensitive
  const { data: ilike } = await supabase
    .from('player_accounts')
    .select('user_id')
    .ilike('name', trimmed)
    .limit(1)
    .maybeSingle()
  if (ilike?.user_id) return ilike.user_id

  // 3. Busca por primeiro + último nome (caso o nome no jogo seja abreviado)
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) {
    const firstName = parts[0]
    const lastName = parts[parts.length - 1]
    const { data: partial } = await supabase
      .from('player_accounts')
      .select('user_id')
      .ilike('name', `${firstName}%${lastName}%`)
      .limit(1)
      .maybeSingle()
    if (partial?.user_id) return partial.user_id
  }

  // 4. Busca só por primeiro nome (última tentativa)
  if (parts.length >= 1) {
    const firstName = parts[0]
    const { data: byFirst } = await supabase
      .from('player_accounts')
      .select('user_id, name')
      .ilike('name', `${firstName}%`)
      .limit(5)
    // Se só houver 1 resultado, é esse
    if (byFirst && byFirst.length === 1 && byFirst[0].user_id) {
      return byFirst[0].user_id
    }
  }

  return null
}

/** Buscar dados completos do jogador (user_id, level, category, avatar) por nome - com fallback inteligente */
export async function findPlayerDataByName(name: string | null): Promise<{ user_id: string; level: number | null; player_category: string | null; avatar_url: string | null } | null> {
  if (!name || name.trim().length === 0) return null
  const trimmed = name.trim()
  const fields = 'user_id, level, player_category, avatar_url'
  
  // 1. Busca exata
  const { data: exact } = await supabase
    .from('player_accounts')
    .select(fields)
    .eq('name', trimmed)
    .limit(1)
    .maybeSingle()
  if (exact?.user_id) return exact
  
  // 2. Case-insensitive
  const { data: ilike } = await supabase
    .from('player_accounts')
    .select(fields)
    .ilike('name', trimmed)
    .limit(1)
    .maybeSingle()
  if (ilike?.user_id) return ilike

  // 3. Primeiro + último nome
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) {
    const firstName = parts[0]
    const lastName = parts[parts.length - 1]
    const { data: partial } = await supabase
      .from('player_accounts')
      .select(fields)
      .ilike('name', `${firstName}%${lastName}%`)
      .limit(1)
      .maybeSingle()
    if (partial?.user_id) return partial
  }

  // 4. Só primeiro nome (se resultado único)
  if (parts.length >= 1) {
    const firstName = parts[0]
    const { data: byFirst } = await supabase
      .from('player_accounts')
      .select(fields)
      .ilike('name', `${firstName}%`)
      .limit(5)
    if (byFirst && byFirst.length === 1 && byFirst[0].user_id) {
      return byFirst[0]
    }
  }

  return null
}

export interface ClassParticipant {
  id: string
  name: string
  avatar_url?: string | null
}

export interface Class {
  id: string
  scheduled_at: string // ISO date string
  title: string // class_type.name
  professor: string // coach name
  professor_phone?: string | null // coach phone
  professor_avatar?: string | null // coach avatar
  club: string // club name
  club_id: string
  club_description?: string | null
  club_address?: string | null
  club_city?: string | null
  club_phone?: string | null
  club_email?: string | null
  club_website?: string | null
  club_logo_url?: string | null
  level: string | null
  gender: 'M' | 'F' | 'Misto' | null
  maxPlayers: number // class_type.max_students
  participants: ClassParticipant[]
  price: number // class_type.price_per_class
  court_id: string | null
  court_name: string | null
  class_type_id: string
  coach_id: string | null
  notes: string | null
}

/** Busca aulas disponíveis (futuras, com vagas) */
export async function fetchAvailableClasses(clubId?: string | null): Promise<Class[]> {
  const now = new Date().toISOString()
  
  // Buscar club_owner_id se clubId fornecido
  let clubOwnerId: string | null = null
  if (clubId) {
    const { data: club } = await supabase
      .from('clubs')
      .select('owner_id')
      .eq('id', clubId)
      .maybeSingle()
    clubOwnerId = club?.owner_id || null
  }

  // Query base - buscar apenas dados básicos primeiro
  let query = supabase
    .from('club_classes')
    .select(`
      id,
      scheduled_at,
      level,
      gender,
      notes,
      class_type_id,
      coach_id,
      court_id,
      club_owner_id,
      status
    `)
    .eq('status', 'scheduled')
    .gte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })

  // Filtrar por clube se fornecido
  if (clubOwnerId) {
    query = query.eq('club_owner_id', clubOwnerId)
  }

  // Buscar dados dos clubes separadamente
  const { data: classesData, error } = await query
  
  if (error) {
    console.error('[Classes] Error fetching classes:', error)
    console.error('[Classes] Error details:', JSON.stringify(error, null, 2))
    return []
  }

  if (!classesData || classesData.length === 0) {
    return []
  }

  // Buscar dados relacionados separadamente para evitar problemas com RLS
  const classTypeIds = [...new Set(classesData.map((c: any) => c.class_type_id).filter(Boolean))]
  const coachIds = [...new Set(classesData.map((c: any) => c.coach_id).filter(Boolean))]
  const courtIds = [...new Set(classesData.map((c: any) => c.court_id).filter(Boolean))]
  const uniqueOwnerIds = [...new Set(classesData.map((c: any) => c.club_owner_id).filter(Boolean))]

  // Buscar class_types
  const { data: classTypesData } = await supabase
    .from('class_types')
    .select('id, name, max_students, price_per_class')
    .in('id', classTypeIds)
    .eq('is_active', true)

  // Buscar coaches
  const { data: coachesData } = await supabase
    .from('club_staff')
    .select('id, name, phone')
    .in('id', coachIds)
    .eq('is_active', true)

  // Buscar courts
  const { data: courtsData } = await supabase
    .from('club_courts')
    .select('id, name')
    .in('id', courtIds)
    .eq('is_active', true)

  // Buscar clubes com todos os dados
  const { data: clubsData } = await supabase
    .from('clubs')
    .select('owner_id, id, name, description, address, city, phone, email, website, logo_url')
    .in('owner_id', uniqueOwnerIds)

  const classTypesMap = new Map(classTypesData?.map(ct => [ct.id, ct]) || [])
  const coachesMap = new Map(coachesData?.map(c => [c.id, c]) || [])
  const courtsMap = new Map(courtsData?.map(c => [c.id, c]) || [])
  const clubsMap = new Map(clubsData?.map(c => [c.owner_id, c]) || [])

  // Buscar enrollments para cada aula
  const classIds = classesData.map(c => c.id)
  const { data: enrollments } = await supabase
    .from('class_enrollments')
    .select('id, class_id, student_name, organizer_player_id')
    .in('class_id', classIds)
    .in('status', ['enrolled', 'attended'])

  // Buscar dados dos jogadores inscritos
  const playerIds = enrollments?.filter(e => e.organizer_player_id).map(e => e.organizer_player_id) || []
  let playersData: any[] = []
  if (playerIds.length > 0) {
    const { data: players } = await supabase
      .from('organizer_players')
      .select('id, name, avatar_url')
      .in('id', playerIds)
    playersData = players || []
  }
  
  // Buscar avatares dos professores (organizer_players pelo telefone)
  const coachPhones = coachesData?.filter(c => c.phone).map(c => c.phone) || []
  let coachAvatars: Map<string, string | null> = new Map()
  if (coachPhones.length > 0) {
    const { data: coachPlayers } = await supabase
      .from('organizer_players')
      .select('phone_number, avatar_url')
      .in('phone_number', coachPhones)
    coachPlayers?.forEach(cp => {
      coachAvatars.set(cp.phone_number, cp.avatar_url || null)
    })
  }

  // Transformar dados
  const classes: Class[] = classesData.map((cls: any) => {
    const classEnrollments = enrollments?.filter(e => e.class_id === cls.id) || []
    const participants: ClassParticipant[] = classEnrollments.map(enrollment => {
      const player = playersData.find(p => p.id === enrollment.organizer_player_id)
      return {
        id: enrollment.id,
        name: enrollment.student_name || player?.name || 'Unknown',
        avatar_url: null // TODO: adicionar avatar_url se disponível
      }
    })

    const classType = classTypesMap.get(cls.class_type_id)
    const coach = coachesMap.get(cls.coach_id)
    const court = courtsMap.get(cls.court_id)
    const club = clubsMap.get(cls.club_owner_id)

    const professorAvatar = coach?.phone ? coachAvatars.get(coach.phone) || null : null
    
    return {
      id: cls.id,
      scheduled_at: cls.scheduled_at,
      title: classType?.name || 'Aula',
      professor: coach?.name || 'Sem professor',
      professor_phone: coach?.phone || null,
      professor_avatar: professorAvatar,
      club: club?.name || 'Clube',
      club_id: club?.id || '',
      club_description: club?.description || null,
      club_address: club?.address || null,
      club_city: club?.city || null,
      club_phone: club?.phone || null,
      club_email: club?.email || null,
      club_website: club?.website || null,
      club_logo_url: club?.logo_url || null,
      level: cls.level || null,
      gender: cls.gender || 'Misto',
      maxPlayers: classType?.max_students || 4,
      participants,
      price: parseFloat(classType?.price_per_class || 0),
      court_id: cls.court_id,
      court_name: court?.name || null,
      class_type_id: cls.class_type_id,
      coach_id: cls.coach_id,
      notes: cls.notes
    }
  })
  
  return classes
}

/** Busca aulas em que o jogador está inscrito */
export async function fetchMyClasses(userId: string): Promise<Class[]> {
  const { data: enrollments } = await supabase
    .from('class_enrollments')
    .select('class_id')
    .eq('student_id', userId)
    .in('status', ['enrolled', 'attended'])

  if (!enrollments || enrollments.length === 0) return []

  const classIds = enrollments.map(e => e.class_id)
  
  const { data: classesData } = await supabase
    .from('club_classes')
    .select(`
      id,
      scheduled_at,
      level,
      gender,
      notes,
      class_type_id,
      coach_id,
      court_id,
      class_type:class_types(
        name,
        max_students,
        price_per_class
      ),
      coach:club_staff(
        name
      ),
      court:club_courts(
        name
      ),
      club_owner_id
    `)
    .in('id', classIds)
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })

  if (!classesData) return []

  // Buscar todos os enrollments para estas aulas
  const { data: allEnrollments } = await supabase
    .from('class_enrollments')
    .select('id, class_id, student_name, organizer_player_id')
    .in('class_id', classIds)
    .in('status', ['enrolled', 'attended'])

  const playerIds = allEnrollments?.filter(e => e.organizer_player_id).map(e => e.organizer_player_id) || []
  let playersData: any[] = []
  if (playerIds.length > 0) {
    const { data: players } = await supabase
      .from('organizer_players')
      .select('id, name')
      .in('id', playerIds)
    playersData = players || []
  }

  // Buscar coaches para minhas aulas
  const coachIdsMyClasses = [...new Set(classesData.map((c: any) => c.coach_id).filter(Boolean))]
  const { data: coachesDataMyClasses } = await supabase
    .from('club_staff')
    .select('id, name, phone')
    .in('id', coachIdsMyClasses)
    .eq('is_active', true)
  const coachesMapMyClasses = new Map(coachesDataMyClasses?.map(c => [c.id, c]) || [])

  // Buscar clubes únicos com todos os dados
  const uniqueOwnerIds = [...new Set(classesData.map((c: any) => c.club_owner_id).filter(Boolean))]
  const { data: clubsData } = await supabase
    .from('clubs')
    .select('owner_id, id, name, description, address, city, phone, email, website, logo_url')
    .in('owner_id', uniqueOwnerIds)

  const clubsMap = new Map(clubsData?.map(c => [c.owner_id, c]) || [])

  const classes: Class[] = classesData.map((cls: any) => {
    const classEnrollments = allEnrollments?.filter(e => e.class_id === cls.id) || []
    const participants: ClassParticipant[] = classEnrollments.map(enrollment => {
      const player = playersData.find(p => p.id === enrollment.organizer_player_id)
      return {
        id: enrollment.id,
        name: enrollment.student_name || player?.name || 'Unknown',
        avatar_url: null
      }
    })

    const coach = coachesMapMyClasses.get(cls.coach_id)
    const club = clubsMap.get(cls.club_owner_id)
    const professorAvatar = coach?.phone ? coachAvatarsMyClasses.get(coach.phone) || null : null

    return {
      id: cls.id,
      scheduled_at: cls.scheduled_at,
      title: cls.class_type?.name || 'Aula',
      professor: coach?.name || cls.coach?.name || 'Sem professor',
      professor_phone: coach?.phone || null,
      professor_avatar: professorAvatar,
      club: club?.name || 'Clube',
      club_id: club?.id || '',
      club_description: club?.description || null,
      club_address: club?.address || null,
      club_city: club?.city || null,
      club_phone: club?.phone || null,
      club_email: club?.email || null,
      club_website: club?.website || null,
      club_logo_url: club?.logo_url || null,
      level: cls.level,
      gender: cls.gender || 'Misto',
      maxPlayers: cls.class_type?.max_students || 4,
      participants,
      price: parseFloat(cls.class_type?.price_per_class || 0),
      court_id: cls.court_id,
      court_name: cls.court?.name || null,
      class_type_id: cls.class_type_id,
      coach_id: cls.coach_id,
      notes: cls.notes
    }
  })

  return classes
}

/** Inscreve o jogador numa aula */
export async function enrollInClass(classId: string, userId: string, playerAccountId: string | null): Promise<boolean> {
  // Verificar se já está inscrito
  const { data: existing } = await supabase
    .from('class_enrollments')
    .select('id')
    .eq('class_id', classId)
    .eq('student_id', userId)
    .maybeSingle()

  if (existing) {
    console.log('[Classes] Already enrolled')
    return false
  }

  // Buscar nome do jogador
  const { data: player } = await supabase
    .from('player_accounts')
    .select('name')
    .eq('id', playerAccountId || '')
    .maybeSingle()

  // Buscar organizer_player_id se existir
  let organizerPlayerId: string | null = null
  if (playerAccountId) {
    // Tentar encontrar organizer_player pelo nome ou phone
    const { data: playerAccount } = await supabase
      .from('player_accounts')
      .select('phone_number, name')
      .eq('id', playerAccountId)
      .maybeSingle()

    if (playerAccount) {
      // Buscar organizer_player correspondente
      const { data: organizerPlayer } = await supabase
        .from('organizer_players')
        .select('id')
        .or(`name.ilike.%${playerAccount.name}%,phone_number.eq.${playerAccount.phone_number}`)
        .limit(1)
        .maybeSingle()

      if (organizerPlayer) {
        organizerPlayerId = organizerPlayer.id
      }
    }
  }

  // Criar enrollment
  const { error } = await supabase
    .from('class_enrollments')
    .insert({
      class_id: classId,
      student_id: userId,
      student_name: player?.name || 'Jogador',
      status: 'enrolled',
      organizer_player_id: organizerPlayerId
    })

  if (error) {
    console.error('[Classes] Error enrolling:', error)
    return false
  }

  return true
}
