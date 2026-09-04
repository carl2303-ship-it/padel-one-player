import { useState, useEffect } from 'react'
import { Building2, Calendar, CheckCircle, ChevronLeft, ChevronRight, Clock, Globe, Lock, MapPin, Plus, Search, UserPlus, Users, X } from 'lucide-react'
import { useI18n } from '../../lib/i18nContext'
import { supabase, type PlayerAccount } from '../../lib/supabase'
import { levelColors } from '../../lib/communityData'

export default function BookingScreen({
  player,
  userId,
  onBack,
  onOpenPlayerProfile,
  onRefresh,
}: {
  player: PlayerAccount | null
  userId: string | null
  onBack: () => void
  onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
  onRefresh?: () => Promise<void>
}) {
  const { t } = useI18n()
  // Wizard step: 1=club, 2=date/time, 3=config, 4=players/teams, 5=confirmation
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [loading, setLoading] = useState(false)

  // Step 1: Club selection
  const [clubs, setClubs] = useState<import('../../lib/openGames').ClubWithAvailability[]>([])
  const [loadingClubs, setLoadingClubs] = useState(true)
  const [selectedClub, setSelectedClub] = useState<import('../../lib/openGames').ClubWithAvailability | null>(null)

  // Step 2: Date + time + court
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [selectedCourt, setSelectedCourt] = useState<import('../../lib/openGames').CourtSlot | null>(null)

  // Step 3: Game config
  const [isPublic, setIsPublic] = useState(false)
  const [gameType, setGameType] = useState<'competitive' | 'friendly'>('competitive')
  const [gender, setGender] = useState<'all' | 'male' | 'female' | 'mixed'>('all')
  const [duration, setDuration] = useState<number>(90)

  // Step 4: Players
  const [players, setPlayers] = useState<{ slot: number; id: string; name: string; avatar_url: string | null; level: number | null; player_category: string | null; user_id?: string }[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; avatar_url: string | null; level: number | null; player_category: string | null; phone_number: string | null }[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)

  // Booking + Payment
  const [creating, setCreating] = useState(false)
  const [paymentChoice, setPaymentChoice] = useState<'at_club' | 'per_player' | 'full_court'>('at_club')

  const playerLevel = player?.level || 3.0

  // Determine payment options from selected club
  const clubPaymentMethod = selectedClub?.payment_method || 'at_club'
  const hasOnlinePayment = clubPaymentMethod !== 'at_club'
  const paymentOptions: { value: 'at_club' | 'per_player' | 'full_court'; label: string; icon: string; desc: string }[] = (() => {
    const opts: { value: 'at_club' | 'per_player' | 'full_court'; label: string; icon: string; desc: string }[] = []
    const allowsAtClub = ['at_club', 'at_club_or_per_player', 'at_club_or_full_court', 'all'].includes(clubPaymentMethod)
    const allowsPerPlayer = ['per_player', 'at_club_or_per_player', 'all'].includes(clubPaymentMethod)
    const allowsFullCourt = ['full_court', 'at_club_or_full_court', 'all'].includes(clubPaymentMethod)
    if (allowsAtClub) opts.push({ value: 'at_club', label: t.booking.paymentAtClubDesc, icon: '🏢', desc: t.booking.paymentAtClubDesc })
    if (allowsPerPlayer) opts.push({ value: 'per_player', label: t.common.payOnline, icon: '💳', desc: t.common.eachPlayerPays })
    if (allowsFullCourt) opts.push({ value: 'full_court', label: t.games.paymentOnlineFullCourt, icon: '💳', desc: t.booking.paymentOnlineFullCourtDesc })
    if (opts.length === 0) opts.push({ value: 'at_club', label: t.games.paymentAtClub, icon: '🏢', desc: t.booking.paymentAtClubDesc })
    return opts
  })()

  // Load clubs with availability
  useEffect(() => {
    const loadClubs = async () => {
      setLoadingClubs(true)
      const { fetchClubsWithAvailability } = await import('../../lib/openGames')
      const data = await fetchClubsWithAvailability()
      setClubs(data)
      setLoadingClubs(false)
    }
    loadClubs()
  }, [])

  // Initialize player 1 (creator) on mount
  useEffect(() => {
    if (player) {
      setPlayers([{
        slot: 1,
        id: player.id,
        name: player.name || t.common.me,
        avatar_url: player.avatar_url || null,
        level: player.level || null,
        player_category: player.player_category || null,
        user_id: player.user_id || undefined,
      }])
    }
  }, [player])

  // Get dates for selected club
  const availableDates = selectedClub ? Object.keys(selectedClub.availability).sort() : []

  // Get time slots for selected date
  const availableSlots = (selectedClub && selectedDate)
    ? (selectedClub.availability[selectedDate] || [])
    : []

  // Get courts for selected time slot
  const availableCourts = availableSlots.find(s => s.time === selectedTime)?.courts || []

  // Format date for display
  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return ''
    
    try {
      const now = new Date()
      const d = new Date(dateStr + 'T12:00:00')
      
      // Verificar se a data é válida
      if (isNaN(d.getTime())) {
        return dateStr // Retornar a string original se a data for inválida
      }
      
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      
      if (diffDays === 0) return t.common.today || 'Hoje'
      if (diffDays === 1) return t.common.tomorrow || 'Amanhã'
      
      // Usar fallback se dayNamesShort não existir
      const dayNames = t.common.dayNamesShort || ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
      const dayIndex = d.getDay()
      
      // Verificar se o índice é válido
      if (dayIndex < 0 || dayIndex >= dayNames.length) {
        return `${d.getDate()}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
      }
      
      return `${dayNames[dayIndex]} ${d.getDate()}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
    } catch (error) {
      console.error('Error formatting date:', error, dateStr)
      return dateStr // Retornar a string original em caso de erro
    }
  }

  // Search players
  const handleSearch = async (q: string) => {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const { searchPlayerAccounts } = await import('../../lib/openGames')
    const results = await searchPlayerAccounts(q)
    // Filter out already added players
    const existingIds = new Set(players.map(p => p.id))
    setSearchResults(results.filter(r => !existingIds.has(r.id)))
    setSearching(false)
  }

  // Add player to slot
  const handleAddPlayer = (p: { id: string; name: string; avatar_url: string | null; level: number | null; player_category: string | null }) => {
    if (selectedSlot == null) return
    setPlayers(prev => {
      const filtered = prev.filter(x => x.slot !== selectedSlot)
      return [...filtered, { slot: selectedSlot, ...p }].sort((a, b) => a.slot - b.slot)
    })
    setSelectedSlot(null)
    setSearchQuery('')
    setSearchResults([])
  }

  // Remove player from slot
  const handleRemovePlayer = (slot: number) => {
    if (slot === 1) return // Can't remove creator
    setPlayers(prev => prev.filter(x => x.slot !== slot))
  }

  // Swap player positions
  const handleSwapPlayers = (slotA: number, slotB: number) => {
    setPlayers(prev => {
      const a = prev.find(p => p.slot === slotA)
      const b = prev.find(p => p.slot === slotB)
      if (!a && !b) return prev
      const rest = prev.filter(p => p.slot !== slotA && p.slot !== slotB)
      if (a && b) return [...rest, { ...a, slot: slotB }, { ...b, slot: slotA }].sort((x, y) => x.slot - y.slot)
      if (a) return [...rest, { ...a, slot: slotB }].sort((x, y) => x.slot - y.slot)
      if (b) return [...rest, { ...b, slot: slotA }].sort((x, y) => x.slot - y.slot)
      return prev
    })
  }

  // Calculate price based on selected duration
  const pricePerPlayer = selectedCourt
    ? (duration === 120 ? selectedCourt.price_120 : duration === 90 ? selectedCourt.price_90 : selectedCourt.price_60)
    : 0

  // Create booking
  const handleCreateBooking = async () => {
    if (!selectedClub || !selectedCourt || !selectedDate || !selectedTime || !userId) return
    setCreating(true)

    const scheduledAt = `${selectedDate}T${selectedTime}:00`

    if (isPublic) {
      // Create as open game (public)
      const { createOpenGame } = await import('../../lib/openGames')
      
      // Prepare players list (excluding creator who is already added)
      const otherPlayers = players.filter(p => p.slot !== 1).map(p => ({
        player_account_id: p.id,
        position: p.slot,
        name: p.name,
        phone_number: null, // Will be fetched from player_accounts if needed
      }))

      const result = await createOpenGame({
        userId,
        playerAccountId: player?.id || null,
        playerName: player?.name || null,
        playerPhone: player?.phone_number || null,
        clubId: selectedClub.id,
        courtId: selectedCourt.court_id,
        scheduledAt,
        durationMinutes: duration,
        gameType,
        gender,
        playerLevel,
        pricePerPlayer,
        isPrivate: false, // Public game
        players: otherPlayers, // Pre-fill players
      })

      if (result.success && result.gameId) {
        // Handle online payment if selected
        if (paymentChoice !== 'at_club' && pricePerPlayer > 0 && player?.id) {
          try {
            const { data: checkoutData, error: checkoutErr } = await supabase.functions.invoke('create-game-checkout', {
              body: {
                gameId: result.gameId,
                paymentType: paymentChoice,
                playerAccountId: player.id,
                successUrl: window.location.origin,
                cancelUrl: window.location.origin,
              },
            })
            if (!checkoutErr && checkoutData?.url) {
              window.location.href = checkoutData.url
              return
            }
          } catch (e) {
            console.error('Stripe checkout error:', e)
          }
        }
        setCreating(false)
        setStep(5)
        if (onRefresh) onRefresh()
      } else {
        setCreating(false)
        alert(result.error || t.games.createError)
      }
    } else {
      // Private booking: create via open_game with isPrivate flag
      const { createOpenGame } = await import('../../lib/openGames')

      const otherPlayersPrivate = players.filter(p => p.slot !== 1).map(p => ({
        player_account_id: p.id,
        position: p.slot,
        name: p.name,
        phone_number: null,
      }))

      const result = await createOpenGame({
        userId,
        playerAccountId: player?.id || null,
        playerName: player?.name || null,
        playerPhone: player?.phone_number || null,
        clubId: selectedClub.id,
        courtId: selectedCourt.court_id,
        scheduledAt,
        durationMinutes: duration,
        gameType,
        gender,
        playerLevel,
        pricePerPlayer,
        isPrivate: true,
        players: otherPlayersPrivate,
      })

      if (result.success && result.gameId) {
        // Handle online payment for private bookings
        if (paymentChoice !== 'at_club' && pricePerPlayer > 0 && player?.id) {
          try {
            const { data: checkoutData, error: checkoutErr } = await supabase.functions.invoke('create-game-checkout', {
              body: {
                gameId: result.gameId,
                paymentType: paymentChoice,
                playerAccountId: player.id,
                successUrl: window.location.origin,
                cancelUrl: window.location.origin,
              },
            })
            if (!checkoutErr && checkoutData?.url) {
              window.location.href = checkoutData.url
              return
            }
          } catch (e) {
            console.error('Stripe checkout error:', e)
          }
        }

        // Update the court_booking notes to indicate private
        await supabase
          .from('court_bookings')
          .update({ notes: `${t.common.privateBookingNote} | ID: ${result.gameId}` })
          .like('notes', `%ID: ${result.gameId}%`)
          .eq('event_type', 'open_game')

        setCreating(false)
        setStep(5)
        if (onRefresh) onRefresh()
      } else {
        setCreating(false)
        alert(result.error || t.booking.bookingError)
      }
    }
  }

  // Render player slot
  const renderSlot = (slotNum: number, team: 'A' | 'B') => {
    const p = players.find(x => x.slot === slotNum)
    const pColors = levelColors(p?.level)
    if (p) {
      return (
        <div key={slotNum} className="flex flex-col items-center relative group">
          <div
            className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center border-2 border-white shadow-sm"
            onClick={() => p.user_id && onOpenPlayerProfile(p.user_id)}
          >
            {p.avatar_url ? (
              <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <span className="text-[10px] text-gray-700 font-medium mt-1 truncate max-w-[70px] text-center">{(p.name || '').split(' ')[0]}</span>
          {p.level != null && (
            <div className="mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: pColors?.hex || '#9ca3af' }}>
                          {p.level.toFixed(2)}
            </div>
          )}
          {slotNum !== 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleRemovePlayer(slotNum) }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ×
            </button>
          )}
        </div>
      )
    }
    return (
      <div key={slotNum} className="flex flex-col items-center">
        <button
          onClick={() => { setSelectedSlot(slotNum); setSearchQuery(''); setSearchResults([]) }}
          className="w-14 h-14 rounded-full border-2 border-dashed border-indigo-300 flex items-center justify-center hover:bg-indigo-50 hover:border-indigo-500 transition-colors"
        >
          <UserPlus className="w-5 h-5 text-indigo-400" />
        </button>
        <span className="text-[10px] text-indigo-600 font-medium mt-1">Adicionar</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={step === 1 ? onBack : () => setStep(prev => Math.max(1, prev - 1) as any)} className="p-1 -ml-1">
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t.booking.title}</h1>
      </div>

      {/* Progress bar */}
      {step < 5 && (
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-lime-500' : 'bg-gray-200'}`} />
          ))}
        </div>
      )}

      {/* === STEP 1: Choose Club === */}
      {step === 1 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t.common.chooseClub}</h2>
            <p className="text-xs text-gray-500">{t.common.selectClubWherePlay}</p>
          </div>
          {loadingClubs ? (
            <div className="text-center py-10">
              <div className="animate-spin w-8 h-8 border-2 border-lime-600 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-gray-500">{t.common.loadingClubs}</p>
            </div>
          ) : clubs.length > 0 ? (
            <div className="space-y-3">
              {clubs.map(club => (
                <button
                  key={club.id}
                  onClick={() => { setSelectedClub(club); setSelectedDate(''); setSelectedTime(''); setSelectedCourt(null); setStep(2) }}
                  className={`w-full border rounded-2xl overflow-hidden text-left transition-all hover:border-lime-400 hover:shadow-sm ${
                    selectedClub?.id === club.id ? 'border-lime-500 bg-lime-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* Club photo banner if available */}
                  {(club.photo_url_1 || club.photo_url_2) && (
                    <div className="w-full flex gap-0.5">
                      {club.photo_url_1 && (
                        <img src={club.photo_url_1} alt="" className={`${club.photo_url_2 ? 'w-1/2' : 'w-full'} h-28 object-cover`} />
                      )}
                      {club.photo_url_2 && (
                        <img src={club.photo_url_2} alt="" className={`${club.photo_url_1 ? 'w-1/2' : 'w-full'} h-28 object-cover`} />
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-3 w-full p-4">
                    {club.logo_url ? (
                      <img src={club.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">{club.name}</p>
                      {club.city && <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {club.city}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {club.courts.length} {club.courts.length > 1 ? t.games.courts : t.games.court} • {club.operating_hours.start} - {club.operating_hours.end}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <span className="text-4xl block mb-3">🏟️</span>
              <p className="font-semibold text-gray-700 mb-1">{t.common.noClubsAvailable}</p>
              <p className="text-sm text-gray-500">{t.common.noClubsAvailability}</p>
            </div>
          )}
        </div>
      )}

      {/* === STEP 2: Choose Date + Time + Court === */}
      {step === 2 && selectedClub && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            {selectedClub.logo_url ? (
              <img src={selectedClub.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-gray-400" />
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900 text-sm">{selectedClub.name}</p>
              {selectedClub.city && <p className="text-xs text-gray-500">{selectedClub.city}</p>}
            </div>
          </div>

          {/* Club facility photos */}
          {(selectedClub.photo_url_1 || selectedClub.photo_url_2) && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {selectedClub.photo_url_1 && (
                <img
                  src={selectedClub.photo_url_1}
                  alt="Instalações"
                  className="h-32 w-auto rounded-xl object-cover flex-shrink-0"
                />
              )}
              {selectedClub.photo_url_2 && (
                <img
                  src={selectedClub.photo_url_2}
                  alt="Instalações"
                  className="h-32 w-auto rounded-xl object-cover flex-shrink-0"
                />
              )}
            </div>
          )}

          {/* Date picker */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">📅 {t.common.date}</label>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
              {availableDates.map(d => (
                <button
                  key={d}
                  onClick={() => { setSelectedDate(d); setSelectedTime(''); setSelectedCourt(null) }}
                  className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors snap-start ${
                    selectedDate === d ? 'bg-lime-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {formatDateLabel(d)}
                </button>
              ))}
            </div>
          </div>

          {/* Time picker */}
          {selectedDate && (
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">🕐 {t.common.time}</label>
              {availableSlots.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {availableSlots.map(slot => (
                    <button
                      key={slot.time}
                      onClick={() => {
                        setSelectedTime(slot.time)
                        // Auto-select first court
                        setSelectedCourt(slot.courts[0] || null)
                      }}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        selectedTime === slot.time ? 'bg-lime-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">{t.common.noTimeSlotsAvailable}</p>
              )}
            </div>
          )}

          {/* Court picker */}
          {selectedTime && availableCourts.length > 1 && (
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">🏟️ {t.common.court}</label>
              <div className="flex gap-2 flex-wrap">
                {availableCourts.map(court => {
                  const typeLabel = court.court_type === 'indoor' ? `🏠 ${t.games.indoor}` : court.court_type === 'outdoor' ? `☀️ ${t.games.outdoor}` : court.court_type === 'covered' ? `🏗️ ${t.games.covered}` : ''
                  return (
                    <button
                      key={court.court_id}
                      onClick={() => {
                        setSelectedCourt(court)
                        // Default to 90 if available, else first available duration
                        setDuration(court.durations.includes(90) ? 90 : court.durations[0] || 60)
                      }}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        selectedCourt?.court_id === court.court_id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>{court.court_name}</span>
                      {typeLabel && <span className="block text-[10px] font-normal opacity-80">{typeLabel}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Selected court info (single court) */}
          {selectedTime && availableCourts.length === 1 && selectedCourt && (
            <div className="p-3 bg-indigo-50 rounded-xl flex items-center gap-2">
              <span className="text-sm text-gray-600">🏟️ Campo:</span>
              <span className="font-semibold text-indigo-700 text-sm">
                {selectedCourt.court_name}
                {selectedCourt.court_type && (
                  <span className="ml-2 text-xs font-normal text-indigo-500">
                    {selectedCourt.court_type === 'indoor' ? `🏠 ${t.games.indoor}` : selectedCourt.court_type === 'outdoor' ? `☀️ ${t.games.outdoor}` : `🏗️ ${t.games.covered}`}
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Continue button */}
          {selectedCourt && (
            <button
              onClick={() => setStep(3)}
              className="w-full py-3 bg-lime-600 text-white rounded-xl font-bold text-sm hover:bg-lime-700 transition-colors"
            >
              {t.common.continue} →
            </button>
          )}
        </div>
      )}

      {/* === STEP 3: Game Configuration === */}
      {step === 3 && selectedClub && selectedCourt && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-1">
            <p className="font-bold text-gray-900 text-sm">{selectedClub.name}</p>
            <p className="text-xs text-gray-500">{selectedCourt.court_name} • {formatDateLabel(selectedDate)} às {selectedTime}</p>
          </div>

          {/* Public / Private */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">{t.common.bookingType}</label>
            <div className="flex gap-2">
              <button
                onClick={() => setIsPublic(false)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors border-2 ${
                  !isPublic ? 'border-lime-500 bg-lime-50 text-lime-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Lock className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                {t.common.private}
              </button>
              <button
                onClick={() => setIsPublic(true)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors border-2 ${
                  isPublic ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Globe className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                {t.common.public}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {isPublic
                ? t.common.publicDesc
                : t.common.privateDesc}
            </p>
          </div>

          {/* Duration */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">⏱️ {t.common.duration}</label>
            <div className="flex gap-2">
              {(selectedCourt.durations || [90]).map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    duration === d ? 'bg-lime-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">👤 {t.booking.gender}</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'all' as const, label: t.common.all, icon: '👥' },
                { value: 'male' as const, label: t.games.male, icon: '♂️' },
                { value: 'female' as const, label: t.games.female, icon: '♀️' },
                { value: 'mixed' as const, label: t.learn.mixed, icon: '⚥' },
              ].map(g => (
                <button
                  key={g.value}
                  onClick={() => setGender(g.value)}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    gender === g.value ? 'bg-lime-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {g.icon} {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Price info */}
          <div className="p-3 bg-blue-50 rounded-xl flex items-center justify-between">
            <span className="text-sm text-gray-700">Preço por jogador</span>
            <span className="font-bold text-blue-600 text-lg">{pricePerPlayer.toFixed(2)}€</span>
          </div>

          <button
            onClick={() => setStep(4)}
            className="w-full py-3 bg-lime-600 text-white rounded-xl font-bold text-sm hover:bg-lime-700 transition-colors"
          >
            Continuar →
          </button>
        </div>
      )}

      {/* === STEP 4: Players & Teams === */}
      {step === 4 && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-1">
            <p className="font-bold text-gray-900 text-sm">{selectedClub?.name}</p>
            <p className="text-xs text-gray-500">
              {selectedCourt?.court_name} • {formatDateLabel(selectedDate)} às {selectedTime} • {duration}min
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isPublic ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                {isPublic ? '🌍 Público' : '🔒 Privado'}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                {gameType === 'competitive' ? '🏆 Competitivo' : '🤝 Amigável'}
              </span>
            </div>
          </div>

          {/* Teams layout */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-3 block">🎾 {t.common.teams}</label>
            <div className="flex items-start gap-4">
              {/* Team A */}
              <div className="flex-1">
                <p className="text-center text-xs font-bold text-gray-400 mb-2">{t.common.teamA}</p>
                <div className="flex gap-3 justify-center">
                  {renderSlot(1, 'A')}
                  {renderSlot(2, 'A')}
                </div>
              </div>
              {/* Divider */}
              <div className="flex flex-col items-center gap-1 pt-6">
                <div className="w-px h-16 bg-gray-200" />
                <span className="text-xs font-bold text-gray-300">VS</span>
                <div className="w-px h-16 bg-gray-200" />
              </div>
              {/* Team B */}
              <div className="flex-1">
                <p className="text-center text-xs font-bold text-gray-400 mb-2">{t.common.teamB}</p>
                <div className="flex gap-3 justify-center">
                  {renderSlot(3, 'B')}
                  {renderSlot(4, 'B')}
                </div>
              </div>
            </div>
          </div>

          {/* Swap buttons */}
          {players.length >= 2 && (
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-2">{t.common.swapPlayersBetweenTeams}</p>
              <div className="flex gap-2 justify-center flex-wrap">
                {players.length >= 2 && players.some(p => p.slot <= 2) && players.some(p => p.slot >= 3) && (
                  <button
                    onClick={() => {
                      const teamAPlayer = players.find(p => p.slot <= 2 && p.slot !== 1)
                        || players.find(p => p.slot <= 2)
                      const teamBPlayer = players.find(p => p.slot >= 3)
                      if (teamAPlayer && teamBPlayer) {
                        handleSwapPlayers(teamAPlayer.slot, teamBPlayer.slot)
                      }
                    }}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-600 transition-colors"
                  >
                    🔄 {t.common.swap}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Search player panel */}
          {selectedSlot != null && (
            <div className="border border-indigo-200 rounded-2xl overflow-hidden bg-white shadow-sm">
              <div className="p-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-indigo-800">{t.common.addPlayerPosition} {selectedSlot})</p>
                <button onClick={() => setSelectedSlot(null)} className="p-1 hover:bg-indigo-100 rounded-full">
                  <X className="w-4 h-4 text-indigo-500" />
                </button>
              </div>
              <div className="p-3">
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t.common.searchByName}
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    autoFocus
                  />
                </div>
                {searching && <p className="text-center text-sm text-gray-400 py-3">{t.common.searching}</p>}
                {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-3">{t.common.noPlayersFound}</p>
                )}
                {searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {searchResults.map(r => {
                      const rColors = levelColors(r.level)
                      return (
                        <button
                          key={r.id}
                          onClick={() => handleAddPlayer(r)}
                          className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg text-left transition-colors"
                        >
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                            {r.avatar_url ? (
                              <img src={r.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm font-bold text-gray-600">{(r.name || '?').charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                            <div className="flex items-center gap-1.5">
                              {r.level != null && (
                                <span className="text-[9px] font-bold text-white px-1.5 py-0 rounded-full" style={{ backgroundColor: rColors?.hex || '#9ca3af' }}>
                                  {r.level.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Price summary */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Preço por jogador</span>
              <span className="font-bold text-green-700">{pricePerPlayer.toFixed(2)}€</span>
            </div>
            {paymentChoice === 'full_court' ? (
              <div className="flex items-center justify-between border-t border-green-200 pt-2">
                <span className="text-sm font-semibold text-gray-700">{t.common.total} ({t.games.fullCourt})</span>
                <span className="font-bold text-green-700 text-lg">{(pricePerPlayer * 4).toFixed(2)}€</span>
              </div>
            ) : (
              <div className="flex items-center justify-between border-t border-green-200 pt-2">
                <span className="text-sm font-semibold text-gray-700">{t.common.total} ({players.length} {players.length > 1 ? t.common.players : t.common.player})</span>
                <span className="font-bold text-green-700 text-lg">{(pricePerPlayer * players.length).toFixed(2)}€</span>
              </div>
            )}
          </div>

          {/* Payment method selection */}
          {pricePerPlayer > 0 && paymentOptions.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">💳 {t.booking.paymentMethod}</label>
              <div className="space-y-2">
                {paymentOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPaymentChoice(opt.value)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                      paymentChoice === opt.value
                        ? 'border-lime-500 bg-lime-50 ring-1 ring-lime-500'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xl">{opt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${paymentChoice === opt.value ? 'text-lime-700' : 'text-gray-900'}`}>{opt.label}</p>
                      <p className="text-[11px] text-gray-500">{opt.desc}</p>
                    </div>
                    {paymentChoice === opt.value && (
                      <div className="w-5 h-5 rounded-full bg-lime-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Create button */}
          <button
            onClick={handleCreateBooking}
            disabled={creating}
            className={`w-full py-3.5 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 shadow-sm ${
              paymentChoice !== 'at_club' && pricePerPlayer > 0
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-lime-600 hover:bg-lime-700'
            }`}
          >
            {creating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                A criar...
              </span>
            ) : paymentChoice !== 'at_club' && pricePerPlayer > 0 ? (
              `💳 ${t.booking.createAndPay} ${paymentChoice === 'full_court' ? (pricePerPlayer * 4).toFixed(2) : pricePerPlayer.toFixed(2)}€`
            ) : (
              isPublic ? `🎾 ${t.booking.createPublic}` : `📅 ${t.booking.createPrivate}`
            )}
          </button>
        </div>
      )}

      {/* === STEP 5: Confirmation === */}
      {step === 5 && (
        <div className="text-center py-10 space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {isPublic ? t.booking.gameCreated : t.booking.bookingConfirmed}
            </h2>
            <p className="text-sm text-gray-500">
              {isPublic
                ? t.booking.gameCreatedMessage
                : t.booking.bookingConfirmedMessage}
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl text-left space-y-2 max-w-sm mx-auto">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">{selectedClub?.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">{formatDateLabel(selectedDate)} às {selectedTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">{duration} minutos</span>
            </div>
            {selectedCourt && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">{selectedCourt.court_name}</span>
              </div>
            )}
            {players.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">{players.map(p => (p.name || '').split(' ')[0]).join(', ')}</span>
              </div>
            )}
          </div>

          <button
            onClick={onBack}
            className="px-8 py-3 bg-lime-600 text-white rounded-xl font-bold text-sm hover:bg-lime-700 transition-colors"
          >
            {t.common.back} {t.menu.home.toLowerCase()}
          </button>
        </div>
      )}
    </div>
  )
}

