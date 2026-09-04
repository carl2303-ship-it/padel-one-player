import { useState, useEffect } from 'react'
import { Building2, Check, ChevronLeft, Lock, Plus, RefreshCw, Search, X } from 'lucide-react'
import { useI18n } from '../../lib/i18nContext'
import { supabase, type PlayerAccount } from '../../lib/supabase'
import { levelColors, searchPlayers, type CommunityPlayer } from '../../lib/communityData'
import { fetchAllClubs } from '../../lib/clubAndTournaments'
import { OpenGameResultScores } from '../shared/matchUi'

export default function FindGameScreen({
  player,
  userId,
  onBack,
  onOpenPlayerProfile,
  onRefresh,
  groupId,
  resultsOnly = false,
}: {
  player: PlayerAccount | null
  userId: string | null
  onBack: () => void
  onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
  onRefresh?: () => Promise<void>
  groupId?: string | null
  resultsOnly?: boolean
}) {
  const { t } = useI18n()
  const [activeSection, setActiveSection] = useState<'existing' | 'request' | 'create' | 'results'>(resultsOnly ? 'results' : (groupId ? 'create' : 'existing'))
  const [loading, setLoading] = useState(true)
  const [games, setGames] = useState<import('../../lib/openGames').OpenGame[]>([])
  const [clubsAvailability, setClubsAvailability] = useState<import('../../lib/openGames').ClubWithAvailability[]>([])
  const [loadingClubs, setLoadingClubs] = useState(false)

  // Result entry state
  const [pastGames, setPastGames] = useState<(import('../../lib/openGames').OpenGame & { _resultStatus?: string | null })[]>([])
  const [loadingPastGames, setLoadingPastGames] = useState(false)
  const [resultModal, setResultModal] = useState<{ game: import('../../lib/openGames').OpenGame } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ game: import('../../lib/openGames').OpenGame; result: import('../../lib/openGames').OpenGameResult } | null>(null)
  const [resultScores, setResultScores] = useState({ t1s1: '', t2s1: '', t1s2: '', t2s2: '', t1s3: '', t2s3: '' })
  const [submittingResult, setSubmittingResult] = useState(false)
  const [swapSelected, setSwapSelected] = useState<{ playerId: string; team: number; gameId: string } | null>(null)
  const [swapping, setSwapping] = useState(false)

  // Quick Result state
  const [quickResultModal, setQuickResultModal] = useState(false)
  const [qrStep, setQrStep] = useState<1 | 2 | 3>(1)
  const [qrClubId, setQrClubId] = useState('')
  const [qrClubName, setQrClubName] = useState('')
  const [qrDate, setQrDate] = useState(new Date().toISOString().split('T')[0])
  const [qrPlayers, setQrPlayers] = useState<{ position: number; id: string; name: string; avatar_url: string | null; level: number | null }[]>([])
  const [qrScores, setQrScores] = useState({ t1s1: '', t2s1: '', t1s2: '', t2s2: '', t1s3: '', t2s3: '' })
  const [qrSearchQuery, setQrSearchQuery] = useState('')
  const [qrSearchResults, setQrSearchResults] = useState<CommunityPlayer[]>([])
  const [qrSearching, setQrSearching] = useState(false)
  const [qrSelectingPosition, setQrSelectingPosition] = useState<number | null>(null)
  const [qrSwapPosition, setQrSwapPosition] = useState<number | null>(null)
  const [qrSubmitting, setQrSubmitting] = useState(false)
  const [qrClubs, setQrClubs] = useState<{ id: string; name: string; logo_url: string | null }[]>([])
  const [qrClubsLoading, setQrClubsLoading] = useState(false)

  const loadPastGames = async () => {
    if (!userId) return
    setLoadingPastGames(true)
    try {
      const { fetchResultGamesForTab } = await import('../../lib/openGames')
      const data = await fetchResultGamesForTab(userId, player?.id)
      setPastGames(data)
    } finally {
      setLoadingPastGames(false)
    }
  }

  useEffect(() => {
    if (resultsOnly && userId) {
      void loadPastGames()
    }
  }, [resultsOnly, userId, player?.id])

  // Load clubs when quick result modal opens
  useEffect(() => {
    if (quickResultModal && qrClubs.length === 0) {
      setQrClubsLoading(true)
      fetchAllClubs().then(clubs => {
        setQrClubs(clubs.map(c => ({ id: c.id, name: c.name, logo_url: c.logo_url })))
        setQrClubsLoading(false)
      })
    }
  }, [quickResultModal])

  // Pre-fill creator as player 1
  useEffect(() => {
    if (quickResultModal && qrPlayers.length === 0 && player) {
      setQrPlayers([{
        position: 1,
        id: player.id,
        name: player.name || '',
        avatar_url: player.avatar_url || null,
        level: player.level || null,
      }])
    }
  }, [quickResultModal, player])

  // Search players for quick result
  useEffect(() => {
    if (!qrSearchQuery || qrSearchQuery.length < 2) { setQrSearchResults([]); return }
    const timeout = setTimeout(async () => {
      setQrSearching(true)
      const excludeIds = qrPlayers.map(p => p.id)
      const results = await searchPlayers(qrSearchQuery, excludeIds.map(id => {
        // searchPlayers excludes by user_id, but we have player_account_id
        return id
      }))
      setQrSearchResults(results)
      setQrSearching(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [qrSearchQuery, qrPlayers])

  const openQuickResultModal = (prefill?: { clubId: string; clubName: string; date: string; players: typeof qrPlayers }) => {
    if (prefill) {
      setQrClubId(prefill.clubId)
      setQrClubName(prefill.clubName)
      setQrDate(prefill.date)
      setQrPlayers(prefill.players)
      setQrStep(2)
    } else {
      setQrClubId('')
      setQrClubName('')
      setQrDate(new Date().toISOString().split('T')[0])
      setQrPlayers(player ? [{
        position: 1,
        id: player.id,
        name: player.name || '',
        avatar_url: player.avatar_url || null,
        level: player.level || null,
      }] : [])
      setQrStep(1)
    }
    setQrScores({ t1s1: '', t2s1: '', t1s2: '', t2s2: '', t1s3: '', t2s3: '' })
    setQrSearchQuery('')
    setQrSearchResults([])
    setQrSelectingPosition(null)
    setQrSwapPosition(null)
    setQrSubmitting(false)
    setQuickResultModal(true)
  }

  const handleQuickResultSubmit = async () => {
    if (!userId || !qrClubId || qrPlayers.length !== 4) return
    if (!qrScores.t1s1 || !qrScores.t2s1 || !qrScores.t1s2 || !qrScores.t2s2) return
    setQrSubmitting(true)
    try {
      const { createQuickResultGame } = await import('../../lib/openGames')
      const scheduledAt = new Date(qrDate + 'T12:00:00').toISOString()
      const result = await createQuickResultGame({
        userId,
        playerAccountId: player?.id || null,
        clubId: qrClubId,
        scheduledAt,
        players: qrPlayers.map(p => ({
          player_account_id: p.id,
          position: p.position,
          name: p.name,
        })),
        sets: {
          t1s1: parseInt(qrScores.t1s1) || 0,
          t2s1: parseInt(qrScores.t2s1) || 0,
          t1s2: parseInt(qrScores.t1s2) || 0,
          t2s2: parseInt(qrScores.t2s2) || 0,
          t1s3: parseInt(qrScores.t1s3) || 0,
          t2s3: parseInt(qrScores.t2s3) || 0,
        },
      })
      if (result.success) {
        alert(t.common.resultSaved)
        setQuickResultModal(false)
        // Refresh past games
        if (userId) {
          const { fetchResultGamesForTab } = await import('../../lib/openGames')
          const data = await fetchResultGamesForTab(userId, player?.id)
          setPastGames(data)
        }
        if (onRefresh) onRefresh()
      } else {
        alert(result.error || 'Erro ao registar resultado')
      }
    } catch (err) {
      console.error('[QuickResult] Error:', err)
      alert('Erro ao registar resultado')
    }
    setQrSubmitting(false)
  }

  const handlePlayerSwap = async (clickedPlayer: any, clickedTeam: number, gameId: string, gamePlayersRef: any[]) => {
    if (swapping) return
    if (!swapSelected || swapSelected.gameId !== gameId) {
      setSwapSelected({ playerId: clickedPlayer.id, team: clickedTeam, gameId })
      return
    }
    if (swapSelected.playerId === clickedPlayer.id) {
      setSwapSelected(null)
      return
    }
    if (swapSelected.team === clickedTeam) {
      setSwapSelected({ playerId: clickedPlayer.id, team: clickedTeam, gameId })
      return
    }
    setSwapping(true)
    try {
      const { swapPlayerTeam } = await import('../../lib/openGames')
      const res = await swapPlayerTeam(swapSelected.playerId, clickedPlayer.id)
      if (res.success) {
        const pA = gamePlayersRef.find((p: any) => p.id === swapSelected.playerId)
        const pB = gamePlayersRef.find((p: any) => p.id === clickedPlayer.id)
        if (pA && pB) {
          const tmpPos = pA.position
          pA.position = pB.position
          pB.position = tmpPos
        }
        setPastGames([...pastGames])
        if (resultModal) setResultModal({ ...resultModal })
      }
    } catch (err) {
      console.error('[Swap] Error:', err)
    }
    setSwapSelected(null)
    setSwapping(false)
  }
  
  // Filtros
  const [selectedClubId, setSelectedClubId] = useState<string>('')
  const [selectedDay, setSelectedDay] = useState<number>(0) // 0 = today, 1 = tomorrow, etc.
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all') // all, morning, afternoon, night
  const [showFilters, setShowFilters] = useState(false)
  
  // Modal para criar jogo
  const [createModal, setCreateModal] = useState<{
    clubId: string
    clubName: string
    date: string
    time: string
    courts: { court_id: string; court_name: string; court_type: string | null; durations: number[]; price_60: number; price_90: number; price_120: number }[]
  } | null>(null)
  const [selectedCourtIdx, setSelectedCourtIdx] = useState<number>(0)
  const [createGameType, setCreateGameType] = useState<'competitive' | 'friendly'>('competitive')
  const [createGender, setCreateGender] = useState<'all' | 'male' | 'female' | 'mixed'>('all')
  const [createDuration, setCreateDuration] = useState<number>(90)
  const [creating, setCreating] = useState(false)
  const [groupName, setGroupName] = useState<string | null>(null)

  useEffect(() => {
    if (!groupId) { setGroupName(null); return }
    (async () => {
      const { getGroupDetails } = await import('../../lib/communityGroups')
      const g = await getGroupDetails(groupId)
      setGroupName(g?.name || null)
    })()
  }, [groupId])

  // Add player modal
  const [addPlayerModal, setAddPlayerModal] = useState<{ gameId: string; position?: number } | null>(null)
  const [playerSearchQuery, setPlayerSearchQuery] = useState('')
  const [playerSearchResults, setPlayerSearchResults] = useState<{ id: string; name: string; avatar_url: string | null; level: number | null; player_category: string | null; phone_number: string | null }[]>([])
  const [searchingPlayers, setSearchingPlayers] = useState(false)
  const [addingPlayer, setAddingPlayer] = useState(false)

  // Clubs list for filter
  const [allClubs, setAllClubs] = useState<{ id: string; name: string }[]>([])

  // Player level
  const playerLevel = player?.level || 3.0

  // Generate dates for filter (14 days)
  const generateDates = () => {
    const dates: { label: string; value: number; dateStr: string }[] = []
    const now = new Date()
    const dayNames = t.common.dayNamesShort
    for (let i = 0; i < 14; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() + i)
      let label = ''
      if (i === 0) label = t.common.today
      else if (i === 1) label = t.common.tomorrow
      else label = `${dayNames[d.getDay()]} ${d.getDate()}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
      dates.push({ label, value: i, dateStr: d.toISOString().split('T')[0] })
    }
    return dates
  }
  const dates = generateDates()

  // Period to time filter
  const getPeriodFilter = () => {
    switch (selectedPeriod) {
      case 'morning': return { from: '06:00', to: '12:00' }
      case 'afternoon': return { from: '12:00', to: '18:00' }
      case 'night': return { from: '18:00', to: '24:00' }
      default: return { from: '00:00', to: '24:00' }
    }
  }

  // Load games
  useEffect(() => {
    const loadGames = async () => {
      setLoading(true)
      const { fetchOpenGames } = await import('../../lib/openGames')
      const dateStr = dates[selectedDay]?.dateStr
      const dateFrom = dateStr ? dateStr + 'T00:00:00' : undefined
      const dateTo = dateStr ? dateStr + 'T23:59:59' : undefined
      const period = getPeriodFilter()
      
      const data = await fetchOpenGames({
        clubId: selectedClubId || undefined,
        dateFrom,
        dateTo,
        timeFrom: selectedPeriod !== 'all' ? period.from : undefined,
        timeTo: selectedPeriod !== 'all' ? period.to : undefined,
      })
      setGames(data)
      setLoading(false)
    }
    loadGames()
    const onVis = () => {
      if (document.visibilityState === 'visible') loadGames()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [selectedClubId, selectedDay, selectedPeriod])

  // Load clubs list for filter
  useEffect(() => {
    const loadClubs = async () => {
      const clubs = await fetchAllClubs()
      setAllClubs(clubs.map(c => ({ id: c.id, name: c.name })))
    }
    loadClubs()
  }, [])

  // Load clubs availability when "create" section is opened
  useEffect(() => {
    if (activeSection === 'create') {
      const loadAvailability = async () => {
        setLoadingClubs(true)
        const { fetchClubsWithAvailability } = await import('../../lib/openGames')
        const data = await fetchClubsWithAvailability()
        setClubsAvailability(data)
        setLoadingClubs(false)
      }
      loadAvailability()
    }
  }, [activeSection])

  // Separate games: within level (existing) vs out of level (request)
  // Show open games + full games where user is already in
  // Also show games where user is already a player, regardless of status (except cancelled)
  const existingGames = games.filter(g => {
    const inMyLevel = playerLevel >= g.level_min && playerLevel <= g.level_max
    const imInGame = g.players.some(p => p.user_id === userId || (player?.id && p.player_account_id === player.id))
    // Show if: (1) I'm already in the game (any status except cancelled), OR (2) in my level and open/full/pending
    return (imInGame && g.status !== 'cancelled') || 
           (inMyLevel && (g.status === 'open' || g.status === 'full' || g.status === 'pending'))
  })
  const requestGames = games.filter(g => {
    const outOfLevel = playerLevel < g.level_min || playerLevel > g.level_max
    const imInGame = g.players.some(p => p.user_id === userId || (player?.id && p.player_account_id === player.id))
    // Show if: (1) I'm already in the game (any status except cancelled), OR (2) out of level and open/full/pending
    return (imInGame && g.status !== 'cancelled') || 
           (outOfLevel && (g.status === 'open' || g.status === 'full' || g.status === 'pending'))
  })

  // Join a game with selected position
  const handleJoinGameWithPosition = async (game: import('../../lib/openGames').OpenGame, position: number) => {
    if (!userId) return
    const { joinOpenGame } = await import('../../lib/openGames')
    const result = await joinOpenGame({
      gameId: game.id,
      userId,
      playerAccountId: player?.id || null,
      playerLevel,
      gameLevelMin: game.level_min,
      gameLevelMax: game.level_max,
      position,
    })
    if (result.success) {
      // Refresh games
      const { fetchOpenGames } = await import('../../lib/openGames')
      const dateStr = dates[selectedDay]?.dateStr
      const data = await fetchOpenGames({
        clubId: selectedClubId || undefined,
        dateFrom: dateStr ? dateStr + 'T00:00:00' : undefined,
        dateTo: dateStr ? dateStr + 'T23:59:59' : undefined,
      })
      setGames(data)
      if (result.status === 'pending') {
        alert(t.games.joinRequest)
      } else if (result.status === 'confirmed' && game.club_payment_method && game.club_payment_method !== 'at_club' && game.price_per_player > 0 && player?.id) {
        // Offer online payment after joining
        const wantsToPay = confirm(`${t.common.enteredGame} ${t.common.wantToPay} ${game.price_per_player.toFixed(2)}€ ${t.common.onlineNow}`)
        if (wantsToPay) {
          try {
            const { data: checkoutData, error: checkoutErr } = await supabase.functions.invoke('create-game-checkout', {
              body: {
                gameId: game.id,
                paymentType: 'per_player',
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
      }
    } else {
      alert(result.error || t.common.joinGameError)
    }
  }

  // Create a game
  const handleCreateGame = async () => {
    if (!createModal || !userId) return
    const court = createModal.courts[selectedCourtIdx]
    if (!court) return
    setCreating(true)
    const { createOpenGame } = await import('../../lib/openGames')
    const scheduledAt = `${createModal.date}T${createModal.time}:00`
    const pricePerPlayer = createDuration === 120 ? (court.price_120 || court.price_90 * 4/3) : createDuration === 90 ? court.price_90 : court.price_60
    
    const result = await createOpenGame({
      userId,
      playerAccountId: player?.id || null,
      playerName: player?.name || null,
      playerPhone: player?.phone_number || null,
      clubId: createModal.clubId,
      courtId: court.court_id,
      scheduledAt,
      durationMinutes: createDuration,
      gameType: createGameType,
      gender: createGender,
      playerLevel,
      pricePerPlayer,
      groupId: groupId || undefined,
    })
    
    setCreating(false)
    if (result.success) {
      setCreateModal(null)
      setActiveSection('existing')
      // Refresh games list
      const { fetchOpenGames } = await import('../../lib/openGames')
      const dateStr = dates[selectedDay]?.dateStr
      const data = await fetchOpenGames({
        clubId: selectedClubId || undefined,
        dateFrom: dateStr ? dateStr + 'T00:00:00' : undefined,
        dateTo: dateStr ? dateStr + 'T23:59:59' : undefined,
      })
      setGames(data)
      // Send a system message in the group chat
      if (groupId && result.gameId) {
        try {
          const { sendMessage } = await import('../../lib/groupChat')
          const dateObj = new Date(scheduledAt)
          const timeStr = dateObj.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
          const dateDisplay = dateObj.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
          await sendMessage({
            groupId,
            content: `🎾 Novo jogo criado para o grupo!\n📅 ${dateDisplay} às ${timeStr}\n📍 ${createModal.clubName}`,
            messageType: 'system',
          })
        } catch (_) { /* ignore */ }
      }
      // Refresh dashboard
      if (onRefresh) onRefresh()
    } else {
      alert(result.error || 'Erro ao criar jogo')
    }
  }

  // Format date for display
  const formatGameDate = (isoStr: string) => {
    const d = new Date(isoStr)
    const days = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
    return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]} | ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  const formatDateLabel = (dateStr: string) => {
    const now = new Date()
    const d = new Date(dateStr + 'T12:00:00')
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return t.common.today
    if (diffDays === 1) return t.common.tomorrow
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
  }

  // Check if current user is already in a game
  const isPlayerInGame = (game: import('../../lib/openGames').OpenGame) => {
    return game.players.some(p => p.user_id === userId || (player?.id && p.player_account_id === player.id))
  }
  
  const isGameCreator = (game: import('../../lib/openGames').OpenGame) => {
    return game.creator_user_id === userId || game.players.some(p => p.position === 1 && (p.user_id === userId || (player?.id && p.player_account_id === player.id)))
  }

  // Cancel a game
  const handleCancelGame = async (game: import('../../lib/openGames').OpenGame) => {
                if (!confirm(t.games.cancelConfirmSimple)) return
    const { cancelOpenGame } = await import('../../lib/openGames')
    const success = await cancelOpenGame(game.id)
    if (success) {
      const { fetchOpenGames } = await import('../../lib/openGames')
      const data = await fetchOpenGames({})
      setGames(data)
    } else {
      alert(t.common.cancelGameError)
    }
  }

  // Search players for add player modal
  const handleSearchPlayers = async (query: string) => {
    setPlayerSearchQuery(query)
    if (query.length < 2) {
      setPlayerSearchResults([])
      return
    }
    setSearchingPlayers(true)
    const { searchPlayerAccounts } = await import('../../lib/openGames')
    const results = await searchPlayerAccounts(query)
    setPlayerSearchResults(results)
    setSearchingPlayers(false)
  }

  // Add player to game
  const handleAddPlayerToGame = async (playerAccountId: string) => {
    if (!addPlayerModal) return
    setAddingPlayer(true)
    const { addPlayerToOpenGame } = await import('../../lib/openGames')
    const result = await addPlayerToOpenGame({
      gameId: addPlayerModal.gameId,
      playerAccountId,
      position: addPlayerModal.position,
    })
    setAddingPlayer(false)
    if (result.success) {
      setAddPlayerModal(null)
      setPlayerSearchQuery('')
      setPlayerSearchResults([])
      // Refresh games
      const { fetchOpenGames } = await import('../../lib/openGames')
      const data = await fetchOpenGames({})
      setGames(data)
    } else {
      alert(result.error || t.common.addPlayerError)
    }
  }

  // Remove player from game (creator action)
  const handleRemovePlayerFromGameScreen = async (game: import('../../lib/openGames').OpenGame, p: any) => {
    const playerName = (p.name || '').split(' ')[0] || t.common.player
    if (!confirm((t.games.removePlayerConfirm || 'Remover {name} do jogo?').replace('{name}', playerName))) return
    const { removePlayerFromOpenGame } = await import('../../lib/openGames')
    const success = await removePlayerFromOpenGame({
      gameId: game.id,
      playerId: p.id,
      playerAccountId: p.player_account_id,
      playerName: p.name,
    })
    if (success) {
      // Refresh games
      const { fetchOpenGames } = await import('../../lib/openGames')
      const dateStr = dates[selectedDay]?.dateStr
      const data = await fetchOpenGames({
        clubId: selectedClubId || undefined,
        dateFrom: dateStr ? dateStr + 'T00:00:00' : undefined,
        dateTo: dateStr ? dateStr + 'T23:59:59' : undefined,
      })
      setGames(data)
      if (onRefresh) onRefresh()
    } else {
      alert(t.games.removePlayerError || 'Erro ao remover jogador')
    }
  }

  // Render game card (Playtomic style)
  const renderGameCard = (game: import('../../lib/openGames').OpenGame, isRequest: boolean = false) => {
    const confirmedPlayers = game.players.filter(p => p.status === 'confirmed')
    const emptySlots = game.max_players - confirmedPlayers.length
    const isInGame = isPlayerInGame(game)
    const isCreator = isGameCreator(game)
    const lvlColors = levelColors(player?.level)
    const myPlayer = game.players.find(p => p.user_id === userId || (player?.id && p.player_account_id === player.id))

    return (
      <div key={game.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
        <div className="p-4">
          {/* Date & Time */}
          <p className="font-bold text-gray-900 text-sm mb-1">
            {formatGameDate(game.scheduled_at)}
          </p>
          
          {/* Game Type & Level Range */}
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-3 flex-wrap">
            <span className="flex items-center gap-1">
              {game.game_type === 'competitive' ? '🏆' : '🤝'} {game.game_type === 'competitive' ? t.games.competitive : t.games.friendly}
            </span>
            <span className="flex items-center gap-1">
              📊 {game.level_min.toFixed(2)} - {game.level_max.toFixed(2)}
            </span>
            {game.gender !== 'all' && (
              <span className="flex items-center gap-1">
                {game.gender === 'male' ? '♂️' : game.gender === 'female' ? '♀️' : '⚥'} {game.gender === 'male' ? t.games.male : game.gender === 'female' ? t.games.female : t.games.mixed}
              </span>
            )}
            {game.court_name && (
              <span className="flex items-center gap-1">
                🏟️ {game.court_name}
                {game.court_type && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    game.court_type === 'indoor' ? 'bg-blue-100 text-blue-700' : 
                    game.court_type === 'outdoor' ? 'bg-amber-100 text-amber-700' : 
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {game.court_type === 'indoor' ? t.games.indoor : game.court_type === 'outdoor' ? t.games.outdoor : t.games.covered}
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Player circles */}
          <div className="flex items-start gap-4 mb-3">
            {/* Left team - Positions 1 and 2 */}
            <div className="flex gap-3 flex-1 justify-center">
              {[1, 2].map(position => {
                const p = confirmedPlayers.find(pl => pl.position === position)
                if (p) {
                  const pColors = levelColors(p.level)
                  const isMe = p.user_id === userId || (player?.id && p.player_account_id === player.id)
                  const canRemove = isCreator && !isMe
                  return (
                    <div key={p.id} className="flex flex-col items-center relative group">
                      <div 
                        className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => p.user_id && onOpenPlayerProfile(p.user_id)}
                      >
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      {canRemove && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemovePlayerFromGameScreen(game, p) }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                          title={t.games.removePlayer}
                        >
                          ✕
                        </button>
                      )}
                      <span className="text-[10px] text-gray-700 font-medium mt-1 truncate max-w-[70px] text-center">{(p.name || '').split(' ')[0]}</span>
                      {p.level != null && (
                        <div className="mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: pColors?.hex || '#9ca3af' }}>
                          {p.level.toFixed(2)}
                        </div>
                      )}
                    </div>
                  )
                } else {
                  return (
                    <div key={`empty-${position}`} className="flex flex-col items-center">
                      <div 
                        className={`w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${
                          isInGame 
                            ? 'border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50' 
                            : 'border-gray-300 hover:border-red-400 hover:bg-red-50'
                        }`}
                        onClick={() => {
                          if (isInGame) {
                            setAddPlayerModal({ gameId: game.id, position })
                            setPlayerSearchQuery('')
                            setPlayerSearchResults([])
                          } else {
                            // Join directly in this position
                            handleJoinGameWithPosition(game, position)
                          }
                        }}
                      >
                        <Plus className={`w-6 h-6 ${isInGame ? 'text-indigo-400' : 'text-gray-400'}`} />
                      </div>
                      <span className={`text-[10px] font-medium mt-1 ${isInGame ? 'text-indigo-600' : 'text-blue-600'}`}>
                        {isInGame ? t.common.add : t.common.free}
                      </span>
                    </div>
                  )
                }
              })}
            </div>
            
            {/* Divider */}
            <div className="w-px h-20 bg-gray-200 self-center" />
            
            {/* Right team - Positions 3 and 4 */}
            <div className="flex gap-3 flex-1 justify-center">
              {[3, 4].map(position => {
                const p = confirmedPlayers.find(pl => pl.position === position)
                if (p) {
                  const pColors = levelColors(p.level)
                  const isMe = p.user_id === userId || (player?.id && p.player_account_id === player.id)
                  const canRemove = isCreator && !isMe
                  return (
                    <div key={p.id} className="flex flex-col items-center relative group">
                      <div 
                        className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => p.user_id && onOpenPlayerProfile(p.user_id)}
                      >
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      {canRemove && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemovePlayerFromGameScreen(game, p) }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                          title={t.games.removePlayer}
                        >
                          ✕
                        </button>
                      )}
                      <span className="text-[10px] text-gray-700 font-medium mt-1 truncate max-w-[70px] text-center">{(p.name || '').split(' ')[0]}</span>
                      {p.level != null && (
                        <div className="mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: pColors?.hex || '#9ca3af' }}>
                          {p.level.toFixed(2)}
                        </div>
                      )}
                    </div>
                  )
                } else {
                  return (
                    <div key={`empty-${position}`} className="flex flex-col items-center">
                      <div 
                        className={`w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${
                          isInGame 
                            ? 'border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50' 
                            : 'border-gray-300 hover:border-red-400 hover:bg-red-50'
                        }`}
                        onClick={() => {
                          if (isInGame) {
                            setAddPlayerModal({ gameId: game.id, position })
                            setPlayerSearchQuery('')
                            setPlayerSearchResults([])
                          } else {
                            // Join directly in this position
                            handleJoinGameWithPosition(game, position)
                          }
                        }}
                      >
                        <Plus className={`w-6 h-6 ${isInGame ? 'text-indigo-400' : 'text-gray-400'}`} />
                      </div>
                      <span className={`text-[10px] font-medium mt-1 ${isInGame ? 'text-indigo-600' : 'text-blue-600'}`}>
                        {isInGame ? t.common.add : t.common.free}
                      </span>
                    </div>
                  )
                }
              })}
            </div>
          </div>
        </div>

        {/* Pending requests section (visible to confirmed players) */}
        {(() => {
          const pendingPlayers = game.players.filter(p => p.status === 'pending')
          const myPendingEntry = game.players.find(p => p.status === 'pending' && (p.user_id === userId || (player?.id && p.player_account_id === player.id)))
          const isConfirmedPlayer = confirmedPlayers.some(p => p.user_id === userId || (player?.id && p.player_account_id === player.id))
          
          return (
            <>
              {/* Banner: Pedido pendente (para quem pediu) */}
              {myPendingEntry && (
                <div className="mx-4 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⏳</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800">{t.common.pendingRequest}</p>
                      <p className="text-xs text-amber-600">{t.common.awaitingApproval}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Banner: Pedido rejeitado (para quem pediu) */}
              {game.players.some(p => p.status === 'rejected' && (p.user_id === userId || (player?.id && p.player_account_id === player.id))) && (
                <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">❌</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-800">{t.common.rejectedRequest}</p>
                      <p className="text-xs text-red-600">{t.common.playersRejectedRequest}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pedidos pendentes (visível para jogadores confirmados) */}
              {isConfirmedPlayer && pendingPlayers.length > 0 && (
                <div className="mx-4 mb-2">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1">
                      <span>📩</span> {pendingPlayers.length} {pendingPlayers.length > 1 ? t.common.joinRequestsPlural : t.common.joinRequests} {t.common.ofJoin}
                    </p>
                    <div className="space-y-2">
                      {pendingPlayers.map(pp => {
                        const ppColors = levelColors(pp.level)
                        return (
                          <div key={pp.id} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-amber-100">
                            <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                              {pp.avatar_url ? (
                                <img src={pp.avatar_url} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-sm font-bold text-gray-600">{(pp.name || '?').charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{pp.name || 'Jogador'}</p>
                              <div className="flex items-center gap-1">
                                {pp.level != null && (
                                  <span className="text-[9px] font-bold text-white px-1.5 py-0 rounded-full" style={{ backgroundColor: ppColors?.hex || '#9ca3af' }}>
                                    {pp.level.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  const { voteOnJoinRequest } = await import('../../lib/openGames')
                                  const result = await voteOnJoinRequest(pp.id, 'accept')
                                  if (result.success) {
                                    if (result.resolved && result.newStatus === 'confirmed') {
                                      alert(`${pp.name} ${t.common.acceptedInGame}`)
                                    } else if (!result.resolved) {
                                      alert(`${t.common.voteRegistered} (${result.votesCount}/${result.votesNeeded})`)
                                    }
                                    // Refresh games
                                    const { fetchOpenGames } = await import('../../lib/openGames')
                                    const dateStr = dates[selectedDay]?.dateStr
                                    const data = await fetchOpenGames({
                                      clubId: selectedClubId || undefined,
                                      dateFrom: dateStr ? dateStr + 'T00:00:00' : undefined,
                                      dateTo: dateStr ? dateStr + 'T23:59:59' : undefined,
                                    })
                                    setGames(data)
                                  } else {
                                    alert(result.error || t.common.voteError)
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-xs font-semibold"
                              >
                                ✓ {t.games.voteAccept}
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  const { voteOnJoinRequest } = await import('../../lib/openGames')
                                  const result = await voteOnJoinRequest(pp.id, 'reject')
                                  if (result.success) {
                                    if (result.resolved && result.newStatus === 'rejected') {
                                      alert(`${pp.name} ${t.common.wasRejected}`)
                                    }
                                    // Refresh games
                                    const { fetchOpenGames } = await import('../../lib/openGames')
                                    const dateStr = dates[selectedDay]?.dateStr
                                    const data = await fetchOpenGames({
                                      clubId: selectedClubId || undefined,
                                      dateFrom: dateStr ? dateStr + 'T00:00:00' : undefined,
                                      dateTo: dateStr ? dateStr + 'T23:59:59' : undefined,
                                    })
                                    setGames(data)
                                  } else {
                                    alert(result.error || t.common.voteError)
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-xs font-semibold"
                              >
                                ✗ {t.games.voteReject}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )
        })()}

        {/* Club & Price footer */}
        <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            {game.club_logo_url ? (
              <img src={game.club_logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-gray-400" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">{game.club_name}</p>
              {game.club_city && <p className="text-[10px] text-gray-500">{game.club_city}</p>}
            </div>
          </div>
          <div className="text-right">
            {game.price_per_player > 0 && (
              <p className="text-lg font-bold text-blue-600">{game.price_per_player.toFixed(2)}€</p>
            )}
            <p className="text-[10px] text-gray-500">{game.duration_minutes}min</p>
            {game.club_payment_method && game.club_payment_method !== 'at_club' && game.price_per_player > 0 && (
              <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">💳 Online</span>
            )}
            {isInGame && myPlayer?.payment_status === 'paid' && (
              <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium mt-0.5 inline-block">✅ Pago</span>
            )}
          </div>
        </div>

        {/* Pay online button for players who joined but haven't paid */}
        {isInGame && myPlayer?.payment_status !== 'paid' && game.club_payment_method && game.club_payment_method !== 'at_club' && game.price_per_player > 0 && (
          <div className="px-4 pb-2 pt-0">
            <button
              onClick={async () => {
                if (!player?.id) return
                try {
                  const { data: checkoutData, error: checkoutErr } = await supabase.functions.invoke('create-game-checkout', {
                    body: {
                      gameId: game.id,
                      paymentType: 'per_player',
                      playerAccountId: player.id,
                      successUrl: window.location.origin,
                      cancelUrl: window.location.origin,
                    },
                  })
                  if (!checkoutErr && checkoutData?.url) {
                    window.location.href = checkoutData.url
                  } else {
                    alert(t.common.paymentError)
                  }
                } catch (e) {
                  alert(t.common.paymentError)
                }
              }}
              className="w-full py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              💳 Pagar {game.price_per_player.toFixed(2)}€
            </button>
          </div>
        )}

        {/* Join/Request/Cancel buttons */}
        {!isInGame && !game.players.some(p => (p.status === 'pending' || p.status === 'rejected') && (p.user_id === userId || (player?.id && p.player_account_id === player.id))) && (
          <div className="px-4 pb-3 pt-0 bg-gray-50/50">
            <button
              onClick={() => {
                // Find first available position
                const occupiedPositions = new Set(confirmedPlayers.map(p => p.position).filter(Boolean))
                let firstAvailable = 1
                for (let pos = 1; pos <= 4; pos++) {
                  if (!occupiedPositions.has(pos)) {
                    firstAvailable = pos
                    break
                  }
                }
                handleJoinGameWithPosition(game, firstAvailable)
              }}
              className={`w-full py-2 rounded-xl text-sm font-semibold transition-colors ${
                isRequest 
                  ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isRequest ? `📩 ${t.common.requestSpot}` : `🎾 ${t.common.joinGame}`}
            </button>
          </div>
        )}
        {isInGame && (
          <div className="px-4 pb-3 pt-0 bg-gray-50/50 space-y-2">
            {/* Sair do jogo — visível para todos (incluindo criador) */}
            <button
              onClick={async () => {
                if (!userId) return
                if (!confirm(t.common.sureLeaveGame)) return
                const { leaveOpenGame } = await import('../../lib/openGames')
                const success = await leaveOpenGame(game.id, userId)
                if (success) {
                  const { fetchOpenGames } = await import('../../lib/openGames')
                  const dateStr = dates[selectedDay]?.dateStr
                  const data = await fetchOpenGames({
                    clubId: selectedClubId || undefined,
                    dateFrom: dateStr ? dateStr + 'T00:00:00' : undefined,
                    dateTo: dateStr ? dateStr + 'T23:59:59' : undefined,
                  })
                  setGames(data)
                  if (onRefresh) onRefresh()
                } else {
                  alert(t.common.leaveGameError)
                }
              }}
              className="w-full py-2 rounded-xl text-sm font-semibold text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors"
            >
              🚪 {t.common.leaveGame}
            </button>
            {/* Cancelar jogo — só para o criador */}
            {isCreator && (
              <button
                onClick={() => handleCancelGame(game)}
                className="w-full py-1.5 rounded-xl text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
              >
                ❌ {t.common.cancelGame}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1 -ml-1">
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {resultsOnly ? t.common.quickResultTitle : t.games.title}
        </h1>
      </div>

      {!resultsOnly && (
      <>
      {/* Filter Bar */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 snap-x">
        {/* Club filter */}
        <select
          value={selectedClubId}
          onChange={(e) => setSelectedClubId(e.target.value)}
          className="flex-shrink-0 px-3 py-2 bg-gray-900 text-white rounded-full text-sm font-medium appearance-none cursor-pointer min-w-[100px]"
        >
          <option value="">{t.common.club}s ({allClubs.length})</option>
          {allClubs.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Day selector - horizontal scroll */}
        {dates.slice(0, 7).map(d => (
          <button
            key={d.value}
            onClick={() => setSelectedDay(d.value)}
            className={`flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              selectedDay === d.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Period filter */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: t.common.allDay, icon: '🕐' },
          { value: 'morning', label: t.common.morning, icon: '🌅' },
          { value: 'afternoon', label: t.common.afternoon, icon: '☀️' },
          { value: 'night', label: t.common.evening, icon: '🌙' },
        ].map(p => (
          <button
            key={p.value}
            onClick={() => setSelectedPeriod(p.value)}
            className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
              selectedPeriod === p.value ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveSection('existing')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'existing' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          🎾 {t.common.gamesTab} ({existingGames.length})
        </button>
        <button
          onClick={() => setActiveSection('request')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'request' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          📩 {t.common.requestTab} ({requestGames.length})
        </button>
        <button
          onClick={() => setActiveSection('create')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'create' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          ➕ {t.common.createTab}
        </button>
        <button
          onClick={async () => {
            setActiveSection('results')
            await loadPastGames()
          }}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'results' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          📊 {t.common.resultsTab}
        </button>
      </div>
      </>
      )}

      {/* === SECTION: Jogos Existentes === */}
      {activeSection === 'existing' && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t.games.existingGames}</h2>
            <p className="text-xs text-gray-500">{t.games.existingGamesDesc}</p>
          </div>
          
          {loading ? (
            <div className="text-center py-10">
              <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-gray-500">A carregar jogos...</p>
            </div>
          ) : existingGames.length > 0 ? (
            <div className="space-y-4">
              {existingGames.map(game => renderGameCard(game, false))}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <span className="text-4xl block mb-3">🎾</span>
              <p className="font-semibold text-gray-700 mb-1">{t.games.noGames}</p>
              <p className="text-sm text-gray-500 mb-4">{t.games.noGamesForLevel}</p>
              <button
                onClick={() => setActiveSection('create')}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                ➕ {t.games.createAGame}
              </button>
            </div>
          )}
        </div>
      )}

      {/* === SECTION: Solicite o seu Lugar === */}
      {activeSection === 'request' && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t.games.requestSpot}</h2>
            <p className="text-xs text-gray-500">{t.games.requestSpotDesc}</p>
          </div>
          
          {loading ? (
            <div className="text-center py-10">
              <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full mx-auto mb-3" />
            </div>
          ) : requestGames.length > 0 ? (
            <div className="space-y-4">
              {requestGames.map(game => renderGameCard(game, true))}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <span className="text-4xl block mb-3">📩</span>
              <p className="font-semibold text-gray-700 mb-1">{t.games.noGamesOutOfLevel}</p>
              <p className="text-sm text-gray-500">{t.games.allGamesSuitable}</p>
            </div>
          )}
        </div>
      )}

      {/* === SECTION: Crie um Jogo === */}
      {activeSection === 'create' && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t.games.createGameSection}</h2>
            <p className="text-xs text-gray-500">{t.games.createGameSectionDesc}</p>
          </div>
          {groupId && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2">
              <Lock className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                Jogo privado para o grupo <strong>{groupName || '...'}</strong> — apenas membros poderão ver e participar.
              </p>
            </div>
          )}

          {loadingClubs ? (
            <div className="text-center py-10">
              <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-gray-500">A carregar disponibilidades...</p>
            </div>
          ) : clubsAvailability.length > 0 ? (
            <div className="space-y-6">
              {clubsAvailability.map(club => (
                <div key={club.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                  {/* Club header */}
                  <div className="p-4 flex items-center gap-3 border-b border-gray-100">
                    {club.logo_url ? (
                      <img src={club.logo_url} alt="" className="w-14 h-14 rounded-xl object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center">
                        <Building2 className="w-7 h-7 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-gray-900">{club.name}</p>
                      {club.city && <p className="text-xs text-gray-500">{club.city}</p>}
                    </div>
                  </div>

                  {/* Time slots by day */}
                  <div className="p-4 space-y-4">
                    {Object.entries(club.availability).map(([date, slots]) => (
                      <div key={date}>
                        <p className="font-bold text-gray-800 text-sm mb-2">{formatDateLabel(date)}</p>
                        <div className="flex gap-2 flex-wrap">
                          {slots.map((slot, idx) => (
                            <button
                              key={`${date}-${idx}`}
                              onClick={() => {
                                setCreateModal({
                                  clubId: club.id,
                                  clubName: club.name,
                                  date,
                                  time: slot.time,
                                  courts: slot.courts?.map(c => ({ ...c, court_type: c.court_type || null })) || [{ court_id: slot.court_id, court_name: slot.court_name, court_type: null, durations: slot.durations, price_90: slot.price_90, price_60: slot.price_60, price_120: (slot as any).price_120 || 0 }],
                                })
                                setSelectedCourtIdx(0)
                                const firstCourt = slot.courts?.[0] || slot
                                setCreateDuration(firstCourt.durations.includes(90) ? 90 : firstCourt.durations[0] || 60)
                              }}
                              className="px-3 py-2 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-center"
                            >
                              <p className="font-bold text-gray-900 text-sm">{slot.time}</p>
                              <p className="text-[10px] text-gray-500">
                                {(slot.courts?.length || 1)} {(slot.courts?.length || 1) > 1 ? t.games.courts : t.games.court} • {slot.durations.sort((a: number, b: number) => a - b).map((d: number) => `${d}min`).join('/')}
                              </p>
                              {slot.courts && slot.courts.length === 1 && slot.courts[0].court_type && (
                                <p className="text-[9px] text-gray-400">
                                  {slot.courts[0].court_type === 'indoor' ? `🏠 ${t.games.indoor}` : slot.courts[0].court_type === 'outdoor' ? `☀️ ${t.games.outdoor}` : `🏗️ ${t.games.covered}`}
                                </p>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <span className="text-4xl block mb-3">🏟️</span>
              <p className="font-semibold text-gray-700 mb-1">Sem disponibilidades</p>
              <p className="text-sm text-gray-500">Não há clubes com disponibilidade neste momento</p>
            </div>
          )}
        </div>
      )}

      {/* === SECTION: Resultados === */}
      {activeSection === 'results' && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Resultados</h2>
            <p className="text-xs text-gray-500">Regista resultados para atualizar o ranking. A equipa adversária pode disputar.</p>
          </div>

          {/* Quick Result Button */}
          <button
            onClick={() => openQuickResultModal()}
            className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl text-sm font-bold hover:from-green-700 hover:to-emerald-700 transition-all shadow-md flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t.common.quickResult}
          </button>
          
          {loadingPastGames ? (
            <div className="text-center py-10">
              <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-gray-500">A carregar jogos...</p>
            </div>
          ) : pastGames.length > 0 ? (
            <div className="space-y-3">
              {pastGames.map(game => {
                const confirmedPlayers = game.players.filter(p => p.status === 'confirmed')
                const team1 = confirmedPlayers.filter(p => (p.position || 0) <= 2)
                const team2 = confirmedPlayers.filter(p => (p.position || 0) > 2)
                const resultStatus = (game as any)._resultStatus as string | null
                const resultData = (game as any)._resultData as import('../../lib/openGames').OpenGameResult | null | undefined
                const hasResult = !!resultStatus && !!resultData
                const submittedByTeam = (game as any)._submittedByTeam || resultData?.submitted_by_team || 0
                
                const myPlayer = confirmedPlayers.find(p => p.user_id === userId || (player?.id && p.player_account_id === player.id))
                const myTeam = myPlayer ? ((myPlayer.position || 0) <= 2 ? 1 : 2) : 0
                const canDispute = hasResult && myTeam !== 0 && myTeam !== submittedByTeam

                return (
                  <div key={game.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-gray-900">
                          {new Date(game.scheduled_at).toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' })} às {new Date(game.scheduled_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {hasResult ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">✓ {t.games.confirmed}</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Sem resultado</span>
                        )}
                      </div>
                      
                      {/* Teams display - tap to swap */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex-1 text-center">
                          <p className="text-xs font-semibold text-gray-500 mb-1">Equipa 1</p>
                          <div className="flex justify-center gap-2">
                            {team1.map(p => {
                              const isSelected = swapSelected?.playerId === p.id && swapSelected?.gameId === game.id
                              return (
                              <div key={p.id} className="flex flex-col items-center cursor-pointer" onClick={() => handlePlayerSwap(p, 1, game.id, confirmedPlayers)}>
                                <div className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center transition-all ${isSelected ? 'ring-3 ring-blue-500 ring-offset-1 scale-110' : 'bg-gray-200'}`}>
                                  {p.avatar_url ? (
                                    <img src={p.avatar_url} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                      <span className="text-sm font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                    </div>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-600 mt-0.5 truncate max-w-[55px]">{(p.name || '').split(' ')[0]}</span>
                              </div>
                              )
                            })}
                          </div>
                        </div>
                        <span className="text-gray-300 text-lg font-bold">VS</span>
                        <div className="flex-1 text-center">
                          <p className="text-xs font-semibold text-gray-500 mb-1">Equipa 2</p>
                          <div className="flex justify-center gap-2">
                            {team2.map(p => {
                              const isSelected = swapSelected?.playerId === p.id && swapSelected?.gameId === game.id
                              return (
                              <div key={p.id} className="flex flex-col items-center cursor-pointer" onClick={() => handlePlayerSwap(p, 2, game.id, confirmedPlayers)}>
                                <div className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center transition-all ${isSelected ? 'ring-3 ring-blue-500 ring-offset-1 scale-110' : 'bg-gray-200'}`}>
                                  {p.avatar_url ? (
                                    <img src={p.avatar_url} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                      <span className="text-sm font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                    </div>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-600 mt-0.5 truncate max-w-[55px]">{(p.name || '').split(' ')[0]}</span>
                              </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                      {swapSelected?.gameId === game.id && (
                        <p className="text-[10px] text-blue-500 text-center mb-2 animate-pulse">Toca num jogador da outra equipa para trocar</p>
                      )}
                      
                      {/* Club info */}
                      <div className="flex items-center gap-2 mb-3">
                        {game.club_logo_url ? (
                          <img src={game.club_logo_url} alt="" className="w-6 h-6 rounded-lg object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center">
                            <Building2 className="w-3 h-3 text-gray-400" />
                          </div>
                        )}
                        <span className="text-xs text-gray-600">{game.club_name}</span>
                        {game.court_name && <span className="text-xs text-gray-400">· {game.court_name}</span>}
                      </div>

                      {/* Actions */}
                      {!hasResult && (
                        <button
                          onClick={() => {
                            setResultModal({ game })
                            setResultScores({ t1s1: '', t2s1: '', t1s2: '', t2s2: '', t1s3: '', t2s3: '' })
                          }}
                          className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                        >
                          📊 Introduzir resultado
                        </button>
                      )}
                      {hasResult && resultData && (
                        <div className="space-y-2">
                          <OpenGameResultScores result={resultData} />
                          {canDispute && (
                            <button
                              onClick={async () => {
                                setConfirmModal({ game, result: resultData })
                              }}
                              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors bg-red-100 text-red-700 hover:bg-red-200"
                            >
                              ⚠️ {t.results.disputeResult}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Duplicate button — available on any completed game with result */}
                      {hasResult && (
                        <button
                          onClick={() => {
                            openQuickResultModal({
                              clubId: game.club_id,
                              clubName: game.club_name,
                              date: new Date().toISOString().split('T')[0],
                              players: confirmedPlayers.map(p => ({
                                position: p.position || 0,
                                id: p.player_account_id || '',
                                name: p.name || '',
                                avatar_url: p.avatar_url || null,
                                level: p.level ?? null,
                              })),
                            })
                          }}
                          className="w-full py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5 mt-2"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          {t.common.duplicateGameDesc}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <span className="text-4xl block mb-3">📊</span>
              <p className="font-semibold text-gray-700 mb-1">Sem jogos para avaliar</p>
              <p className="text-sm text-gray-500">Os jogos terminados que necessitam de resultado aparecerão aqui</p>
            </div>
          )}
        </div>
      )}

      {/* === MODAL: Introduzir Resultado === */}
      {resultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setResultModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900">📊 Introduzir resultado</h3>
              <button onClick={() => setResultModal(null)} className="p-1">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              {/* Teams - tap to swap */}
              {(() => {
                const cp = resultModal.game.players.filter(p => p.status === 'confirmed')
                const t1 = cp.filter(p => (p.position || 0) <= 2)
                const t2 = cp.filter(p => (p.position || 0) > 2)
                return (
                  <>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 text-center">
                      <p className="text-xs font-bold text-blue-600 mb-2">Equipa 1</p>
                      <div className="flex justify-center gap-2">
                        {t1.map(p => {
                          const isSelected = swapSelected?.playerId === p.id && swapSelected?.gameId === resultModal.game.id
                          return (
                          <div key={p.id} className="flex flex-col items-center cursor-pointer" onClick={() => handlePlayerSwap(p, 1, resultModal.game.id, cp)}>
                            <div className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center transition-all ${isSelected ? 'ring-3 ring-blue-500 ring-offset-1 scale-110' : 'bg-gray-200'}`}>
                              {p.avatar_url ? (
                                <img src={p.avatar_url} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                  <span className="text-sm font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-600 mt-0.5 truncate max-w-[55px]">{(p.name || '').split(' ')[0]}</span>
                          </div>
                          )
                        })}
                      </div>
                    </div>
                    <span className="text-gray-300 font-bold">VS</span>
                    <div className="flex-1 text-center">
                      <p className="text-xs font-bold text-red-600 mb-2">Equipa 2</p>
                      <div className="flex justify-center gap-2">
                        {t2.map(p => {
                          const isSelected = swapSelected?.playerId === p.id && swapSelected?.gameId === resultModal.game.id
                          return (
                          <div key={p.id} className="flex flex-col items-center cursor-pointer" onClick={() => handlePlayerSwap(p, 2, resultModal.game.id, cp)}>
                            <div className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center transition-all ${isSelected ? 'ring-3 ring-blue-500 ring-offset-1 scale-110' : 'bg-gray-200'}`}>
                              {p.avatar_url ? (
                                <img src={p.avatar_url} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                  <span className="text-sm font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-600 mt-0.5 truncate max-w-[55px]">{(p.name || '').split(' ')[0]}</span>
                          </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  {swapSelected?.gameId === resultModal.game.id && (
                    <p className="text-[10px] text-blue-500 text-center animate-pulse">Toca num jogador da outra equipa para trocar</p>
                  )}
                  </>
                )
              })()}
              
              {/* Score inputs */}
              <div className="space-y-3">
                {['Set 1', 'Set 2', 'Set 3'].map((label, idx) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className={`text-sm font-medium w-12 ${idx === 2 ? 'text-gray-400' : 'text-gray-700'}`}>{label}</span>
                    <input
                      type="number"
                      min="0"
                      max="7"
                      placeholder="E1"
                      value={idx === 0 ? resultScores.t1s1 : idx === 1 ? resultScores.t1s2 : resultScores.t1s3}
                      onChange={e => {
                        const key = idx === 0 ? 't1s1' : idx === 1 ? 't1s2' : 't1s3'
                        setResultScores(prev => ({ ...prev, [key]: e.target.value }))
                      }}
                      className="flex-1 text-center py-2 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-gray-300">-</span>
                    <input
                      type="number"
                      min="0"
                      max="7"
                      placeholder="E2"
                      value={idx === 0 ? resultScores.t2s1 : idx === 1 ? resultScores.t2s2 : resultScores.t2s3}
                      onChange={e => {
                        const key = idx === 0 ? 't2s1' : idx === 1 ? 't2s2' : 't2s3'
                        setResultScores(prev => ({ ...prev, [key]: e.target.value }))
                      }}
                      className="flex-1 text-center py-2 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                ))}
              </div>
              
              <p className="text-xs text-gray-400 text-center">O 3° set é opcional (apenas se necessário)</p>
              
              <button
                disabled={submittingResult || !resultScores.t1s1 || !resultScores.t2s1 || !resultScores.t1s2 || !resultScores.t2s2}
                onClick={async () => {
                  setSubmittingResult(true)
                  const { submitGameResult } = await import('../../lib/openGames')
                  const res = await submitGameResult({
                    gameId: resultModal.game.id,
                    t1Set1: parseInt(resultScores.t1s1) || 0,
                    t2Set1: parseInt(resultScores.t2s1) || 0,
                    t1Set2: parseInt(resultScores.t1s2) || 0,
                    t2Set2: parseInt(resultScores.t2s2) || 0,
                    t1Set3: parseInt(resultScores.t1s3) || 0,
                    t2Set3: parseInt(resultScores.t2s3) || 0,
                  })
                  if (res.success) {
                    alert(t.results.resultRegistered)
                    setResultModal(null)
                    // Award points for submitting
                    try {
                      const { awardGameRewardPoints: _aw } = await import('../../lib/openGames')
                    } catch {}
                    // Refresh past games
                    if (userId) {
                      const { fetchResultGamesForTab } = await import('../../lib/openGames')
                      const data = await fetchResultGamesForTab(userId, player?.id)
                      setPastGames(data)
                    }
                  } else {
                    alert(res.error || 'Erro ao submeter resultado')
                  }
                  setSubmittingResult(false)
                }}
                className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingResult ? 'A submeter...' : '✓ Submeter resultado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Resultado Rápido (3 passos) === */}
      {quickResultModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setQuickResultModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in my-4" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-gray-900">{t.common.quickResultTitle}</h3>
                <p className="text-xs text-gray-500">{t.common.step} {qrStep}/3</p>
              </div>
              <button onClick={() => setQuickResultModal(false)} className="p-1">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1 px-4 pt-3">
              {[1, 2, 3].map(s => (
                <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${s <= qrStep ? 'bg-green-500' : 'bg-gray-200'}`} />
              ))}
            </div>

            <div className="p-5 space-y-4">
              {/* === STEP 1: Club + Date === */}
              {qrStep === 1 && (
                <>
                  {/* Date */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">📅 {t.common.selectDate}</label>
                    <input
                      type="date"
                      value={qrDate}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={e => setQrDate(e.target.value)}
                      className="w-full py-2.5 px-4 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  {/* Club selection */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">🏟️ {t.common.selectClub}</label>
                    {qrClubsLoading ? (
                      <div className="text-center py-4">
                        <div className="animate-spin w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full mx-auto" />
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-2">
                        {qrClubs.map(club => (
                          <button
                            key={club.id}
                            onClick={() => { setQrClubId(club.id); setQrClubName(club.name) }}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${qrClubId === club.id ? 'bg-green-50 border border-green-300' : 'hover:bg-gray-50'}`}
                          >
                            {club.logo_url ? (
                              <img src={club.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-gray-400" />
                              </div>
                            )}
                            <span className="text-sm font-medium text-gray-900">{club.name}</span>
                            {qrClubId === club.id && <Check className="w-4 h-4 text-green-600 ml-auto" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    disabled={!qrClubId}
                    onClick={() => setQrStep(2)}
                    className="w-full py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t.common.next} →
                  </button>
                </>
              )}

              {/* === STEP 2: Players === */}
              {qrStep === 2 && (
                <>
                  {/* Swap hint */}
                  {qrPlayers.length === 4 && (
                    <p className="text-[10px] text-blue-500 text-center animate-pulse">
                      {qrSwapPosition !== null ? 'Toca num jogador da outra equipa para trocar' : 'Toca num jogador para trocar de equipa'}
                    </p>
                  )}

                  <div className="flex items-center gap-4">
                    {/* Team 1 */}
                    <div className="flex-1">
                      <p className="text-xs font-bold text-blue-600 mb-2 text-center">{t.common.team1}</p>
                      <div className="space-y-2">
                        {[1, 2].map(pos => {
                          const p = qrPlayers.find(pl => pl.position === pos)
                          const isSwapSelected = qrSwapPosition === pos
                          const otherTeamSelected = qrSwapPosition !== null && qrSwapPosition > 2
                          return (
                            <div key={pos} className="flex items-center gap-2">
                              {p ? (
                                <div
                                  onClick={() => {
                                    if (qrSwapPosition === pos) { setQrSwapPosition(null); return }
                                    if (qrSwapPosition !== null) {
                                      const swapTeam = qrSwapPosition <= 2 ? 1 : 2
                                      const thisTeam = pos <= 2 ? 1 : 2
                                      if (swapTeam !== thisTeam) {
                                        setQrPlayers(prev => prev.map(pl => {
                                          if (pl.position === pos) return { ...pl, position: qrSwapPosition! }
                                          if (pl.position === qrSwapPosition!) return { ...pl, position: pos }
                                          return pl
                                        }))
                                        setQrSwapPosition(null)
                                        return
                                      }
                                    }
                                    setQrSwapPosition(pos)
                                  }}
                                  className={`flex-1 flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                                    isSwapSelected ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-400 scale-105' :
                                    otherTeamSelected ? 'bg-blue-50 border-blue-300 hover:border-blue-500 hover:bg-blue-100' :
                                    'bg-blue-50 border-blue-200'
                                  }`}
                                >
                                  <div className="w-8 h-8 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    {p.avatar_url ? (
                                      <img src={p.avatar_url} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xs font-bold text-blue-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-gray-900 truncate">{p.name.split(' ')[0]}</p>
                                    {p.level && <p className="text-[10px] text-gray-500">Nv. {Number(p.level).toFixed(2)}</p>}
                                  </div>
                                  {p.id !== player?.id && (
                                    <button onClick={e => { e.stopPropagation(); setQrPlayers(prev => prev.filter(pl => pl.position !== pos)); setQrSwapPosition(null) }} className="p-1 text-red-400 hover:text-red-600">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setQrSelectingPosition(pos); setQrSwapPosition(null); setQrSearchQuery(''); setQrSearchResults([]) }}
                                  className={`flex-1 flex items-center justify-center gap-1 p-2 rounded-lg border-2 border-dashed transition-colors ${qrSelectingPosition === pos ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400'}`}
                                >
                                  <Plus className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="text-xs text-gray-500">{t.common.player} {pos}</span>
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <span className="text-gray-300 font-bold text-lg">VS</span>

                    {/* Team 2 */}
                    <div className="flex-1">
                      <p className="text-xs font-bold text-red-600 mb-2 text-center">{t.common.team2}</p>
                      <div className="space-y-2">
                        {[3, 4].map(pos => {
                          const p = qrPlayers.find(pl => pl.position === pos)
                          const isSwapSelected = qrSwapPosition === pos
                          const otherTeamSelected = qrSwapPosition !== null && qrSwapPosition <= 2
                          return (
                            <div key={pos} className="flex items-center gap-2">
                              {p ? (
                                <div
                                  onClick={() => {
                                    if (qrSwapPosition === pos) { setQrSwapPosition(null); return }
                                    if (qrSwapPosition !== null) {
                                      const swapTeam = qrSwapPosition <= 2 ? 1 : 2
                                      const thisTeam = pos <= 2 ? 1 : 2
                                      if (swapTeam !== thisTeam) {
                                        setQrPlayers(prev => prev.map(pl => {
                                          if (pl.position === pos) return { ...pl, position: qrSwapPosition! }
                                          if (pl.position === qrSwapPosition!) return { ...pl, position: pos }
                                          return pl
                                        }))
                                        setQrSwapPosition(null)
                                        return
                                      }
                                    }
                                    setQrSwapPosition(pos)
                                  }}
                                  className={`flex-1 flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                                    isSwapSelected ? 'bg-red-100 border-red-500 ring-2 ring-red-400 scale-105' :
                                    otherTeamSelected ? 'bg-red-50 border-red-300 hover:border-red-500 hover:bg-red-100' :
                                    'bg-red-50 border-red-200'
                                  }`}
                                >
                                  <div className="w-8 h-8 rounded-full overflow-hidden bg-red-100 flex items-center justify-center flex-shrink-0">
                                    {p.avatar_url ? (
                                      <img src={p.avatar_url} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xs font-bold text-red-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-gray-900 truncate">{p.name.split(' ')[0]}</p>
                                    {p.level && <p className="text-[10px] text-gray-500">Nv. {Number(p.level).toFixed(2)}</p>}
                                  </div>
                                  <button onClick={e => { e.stopPropagation(); setQrPlayers(prev => prev.filter(pl => pl.position !== pos)); setQrSwapPosition(null) }} className="p-1 text-red-400 hover:text-red-600">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setQrSelectingPosition(pos); setQrSwapPosition(null); setQrSearchQuery(''); setQrSearchResults([]) }}
                                  className={`flex-1 flex items-center justify-center gap-1 p-2 rounded-lg border-2 border-dashed transition-colors ${qrSelectingPosition === pos ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400'}`}
                                >
                                  <Plus className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="text-xs text-gray-500">{t.common.player} {pos}</span>
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Player search */}
                  {qrSelectingPosition !== null && (
                    <div className="border border-green-200 rounded-xl p-3 bg-green-50/50">
                      <p className="text-xs font-semibold text-green-700 mb-2">{t.common.addPlayer} - {t.common.player} {qrSelectingPosition}</p>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder={t.common.searchPlayer}
                          value={qrSearchQuery}
                          onChange={e => setQrSearchQuery(e.target.value)}
                          className="w-full py-2 pl-9 pr-4 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          autoFocus
                        />
                      </div>
                      {qrSearching && (
                        <div className="text-center py-2">
                          <div className="animate-spin w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full mx-auto" />
                        </div>
                      )}
                      {qrSearchResults.length > 0 && (
                        <div className="mt-2 max-h-36 overflow-y-auto space-y-1">
                          {qrSearchResults.map(p => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setQrPlayers(prev => [...prev, {
                                  position: qrSelectingPosition!,
                                  id: p.id,
                                  name: p.name,
                                  avatar_url: p.avatar_url || null,
                                  level: p.level ?? null,
                                }])
                                setQrSelectingPosition(null)
                                setQrSearchQuery('')
                                setQrSearchResults([])
                              }}
                              className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white transition-colors"
                            >
                              <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                {p.avatar_url ? (
                                  <img src={p.avatar_url} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[10px] font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <span className="text-sm text-gray-900">{p.name}</span>
                              {p.level && <span className="text-[10px] text-gray-400 ml-auto">Nv. {Number(p.level).toFixed(2)}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                      {!qrSearching && qrSearchQuery.length >= 2 && qrSearchResults.length === 0 && (
                        <p className="text-xs text-gray-400 text-center mt-2">{t.common.noPlayersFound}</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setQrStep(1)}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
                    >
                      ← {t.common.previous}
                    </button>
                    <button
                      disabled={qrPlayers.length !== 4}
                      onClick={() => setQrStep(3)}
                      className="flex-1 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t.common.next} →
                    </button>
                  </div>
                </>
              )}

              {/* === STEP 3: Scores === */}
              {qrStep === 3 && (
                <>
                  {/* Summary */}
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">{qrClubName}</span>
                      <span className="text-xs text-gray-400 ml-auto">{new Date(qrDate).toLocaleDateString('pt-PT')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 text-center">
                        <p className="text-[10px] font-bold text-blue-600">{t.common.team1}</p>
                        {qrPlayers.filter(p => p.position <= 2).map(p => (
                          <p key={p.id} className="text-xs text-gray-700 truncate">{p.name.split(' ')[0]}</p>
                        ))}
                      </div>
                      <span className="text-gray-300 text-sm font-bold">VS</span>
                      <div className="flex-1 text-center">
                        <p className="text-[10px] font-bold text-red-600">{t.common.team2}</p>
                        {qrPlayers.filter(p => p.position > 2).map(p => (
                          <p key={p.id} className="text-xs text-gray-700 truncate">{p.name.split(' ')[0]}</p>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Score inputs */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-2 items-center">
                      <span className="text-xs text-transparent">.</span>
                      <span className="text-[10px] font-bold text-blue-600 text-center">{t.common.team1}</span>
                      <span className="text-xs text-transparent">.</span>
                      <span className="text-[10px] font-bold text-red-600 text-center">{t.common.team2}</span>
                    </div>
                    {['Set 1', 'Set 2', 'Set 3'].map((label, idx) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className={`text-sm font-medium w-12 ${idx === 2 ? 'text-gray-400' : 'text-gray-700'}`}>{label}</span>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          placeholder="0"
                          value={idx === 0 ? qrScores.t1s1 : idx === 1 ? qrScores.t1s2 : qrScores.t1s3}
                          onChange={e => {
                            const key = idx === 0 ? 't1s1' : idx === 1 ? 't1s2' : 't1s3'
                            setQrScores(prev => ({ ...prev, [key]: e.target.value }))
                          }}
                          className="flex-1 text-center py-2.5 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                        <span className="text-gray-300 font-bold">-</span>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          placeholder="0"
                          value={idx === 0 ? qrScores.t2s1 : idx === 1 ? qrScores.t2s2 : qrScores.t2s3}
                          onChange={e => {
                            const key = idx === 0 ? 't2s1' : idx === 1 ? 't2s2' : 't2s3'
                            setQrScores(prev => ({ ...prev, [key]: e.target.value }))
                          }}
                          className="flex-1 text-center py-2.5 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 text-center">O 3° set é opcional</p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setQrStep(2)}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
                    >
                      ← {t.common.previous}
                    </button>
                    <button
                      disabled={qrSubmitting || !qrScores.t1s1 || !qrScores.t2s1 || !qrScores.t1s2 || !qrScores.t2s2}
                      onClick={handleQuickResultSubmit}
                      className="flex-1 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {qrSubmitting ? 'A gravar...' : `✓ ${t.common.confirmResult}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Disputar Resultado === */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900">📊 {t.results.disputeResult}</h3>
              <button onClick={() => setConfirmModal(null)} className="p-1">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              {/* Teams */}
              {(() => {
                const cp = confirmModal.game.players.filter(p => p.status === 'confirmed')
                const t1 = cp.filter(p => (p.position || 0) <= 2)
                const t2 = cp.filter(p => (p.position || 0) > 2)
                const r = confirmModal.result
                
                // Determine winner
                const s1 = [r.team1_score_set1 || 0, r.team2_score_set1 || 0]
                const s2 = [r.team1_score_set2 || 0, r.team2_score_set2 || 0]
                const s3 = [r.team1_score_set3 || 0, r.team2_score_set3 || 0]
                const sets1 = (s1[0] > s1[1] ? 1 : 0) + (s2[0] > s2[1] ? 1 : 0) + (s3[0] > s3[1] ? 1 : 0)
                const sets2 = (s1[1] > s1[0] ? 1 : 0) + (s2[1] > s2[0] ? 1 : 0) + (s3[1] > s3[0] ? 1 : 0)
                const team1Won = sets1 > sets2
                
                return (
                  <>
                    <div className="flex items-center gap-4">
                      <div className={`flex-1 text-center p-3 rounded-xl ${team1Won ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                        <p className="text-xs font-bold text-blue-600 mb-1">Equipa 1 {team1Won ? '🏆' : ''}</p>
                        {t1.map(p => <p key={p.id} className="text-xs text-gray-700">{(p.name || '').split(' ')[0]}</p>)}
                      </div>
                      <span className="text-gray-300 font-bold">VS</span>
                      <div className={`flex-1 text-center p-3 rounded-xl ${!team1Won ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                        <p className="text-xs font-bold text-red-600 mb-1">Equipa 2 {!team1Won ? '🏆' : ''}</p>
                        {t2.map(p => <p key={p.id} className="text-xs text-gray-700">{(p.name || '').split(' ')[0]}</p>)}
                      </div>
                    </div>
                    
                    {/* Scores display */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-[10px] text-gray-500 mb-1">Set 1</p>
                          <p className="text-lg font-bold text-gray-900">{r.team1_score_set1} - {r.team2_score_set1}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 mb-1">Set 2</p>
                          <p className="text-lg font-bold text-gray-900">{r.team1_score_set2} - {r.team2_score_set2}</p>
                        </div>
                        {(r.team1_score_set3 > 0 || r.team2_score_set3 > 0) && (
                          <div>
                            <p className="text-[10px] text-gray-500 mb-1">Set 3</p>
                            <p className="text-lg font-bold text-gray-900">{r.team1_score_set3} - {r.team2_score_set3}</p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 text-center mt-2">
                        Submetido pela Equipa {r.submitted_by_team}
                      </p>
                    </div>
                  </>
                )
              })()}
              
              {/* Determine if I can confirm/dispute */}
              {(() => {
                const myPlayer = confirmModal.game.players.find(p => p.user_id === userId || (player?.id && p.player_account_id === player.id))
                const myTeam = myPlayer ? ((myPlayer.position || 0) <= 2 ? 1 : 2) : 0
                const canDispute = myTeam !== 0 && myTeam !== confirmModal.result.submitted_by_team

                if (!canDispute) {
                  return (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                      <p className="text-sm text-green-700 font-medium">✓ {t.results.resultRegistered}</p>
                    </div>
                  )
                }

                return (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 text-center">O resultado já está registado. Discordas do resultado?</p>
                    <button
                      onClick={async () => {
                        if (!confirm(t.results.disputePrompt)) return
                        setSubmittingResult(true)
                        const { disputeGameResult } = await import('../../lib/openGames')
                        const res = await disputeGameResult(confirmModal.game.id)
                        if (res.success) {
                          alert(t.results.resultDisputed)
                          setConfirmModal(null)
                          if (userId) {
                            const { fetchResultGamesForTab } = await import('../../lib/openGames')
                            const data = await fetchResultGamesForTab(userId, player?.id)
                            setPastGames(data)
                          }
                        } else {
                          alert(res.error || t.results.disputeError)
                        }
                        setSubmittingResult(false)
                      }}
                      disabled={submittingResult}
                      className="w-full py-3 bg-red-100 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-200 transition-colors disabled:opacity-50"
                    >
                      ✗ {t.results.disputeResult}
                    </button>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Criar Jogo === */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in my-4">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900">{t.games.createGame}</h3>
              <button onClick={() => setCreateModal(null)} className="p-1">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Info */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{createModal.clubName}</p>
                  <p className="text-xs text-gray-500">{createModal.date} às {createModal.time}</p>
                </div>
              </div>

              {/* Court Selector */}
              {createModal.courts.length > 1 && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">🏟️ {t.games.court}</label>
                  <div className="flex gap-2 flex-wrap">
                    {createModal.courts.map((c, i) => {
                      const typeLabel = c.court_type === 'indoor' ? `🏠 ${t.games.indoor}` : c.court_type === 'outdoor' ? `☀️ ${t.games.outdoor}` : c.court_type === 'covered' ? `🏗️ ${t.games.covered}` : ''
                      return (
                        <button
                          key={c.court_id}
                          onClick={() => {
                            setSelectedCourtIdx(i)
                            setCreateDuration(c.durations.includes(90) ? 90 : c.durations[0] || 60)
                          }}
                          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                            selectedCourtIdx === i 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <span>{c.court_name}</span>
                          {typeLabel && <span className="block text-[10px] font-normal opacity-80">{typeLabel}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {createModal.courts.length === 1 && (
                <div className="p-3 bg-indigo-50 rounded-xl flex items-center gap-2">
                  <span className="text-sm text-gray-600">🏟️ {t.games.court}:</span>
                  <span className="font-semibold text-indigo-700 text-sm">
                    {createModal.courts[0].court_name}
                    {createModal.courts[0].court_type && (
                      <span className="ml-2 text-xs font-normal text-indigo-500">
                        {createModal.courts[0].court_type === 'indoor' ? `🏠 ${t.games.indoor}` : createModal.courts[0].court_type === 'outdoor' ? `☀️ ${t.games.outdoor}` : `🏗️ ${t.games.covered}`}
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Duration */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Duração</label>
                <div className="flex gap-2">
                  {(createModal.courts[selectedCourtIdx]?.durations || [90]).map(d => (
                    <button
                      key={d}
                      onClick={() => setCreateDuration(d)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        createDuration === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Género</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'all' as const, label: 'Todos' },
                    { value: 'male' as const, label: 'Apenas Masculino' },
                    { value: 'female' as const, label: 'Apenas Feminino' },
                    { value: 'mixed' as const, label: t.learn.mixedPlural },
                  ].map(g => (
                    <button
                      key={g.value}
                      onClick={() => setCreateGender(g.value)}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        createGender === g.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price info */}
              {(() => {
                const court = createModal.courts[selectedCourtIdx]
                const price = court ? (createDuration === 120 ? (court.price_120 || court.price_90 * 4/3) : createDuration === 90 ? court.price_90 : court.price_60) : 0
                return (
                  <div className="p-3 bg-blue-50 rounded-xl flex items-center justify-between">
                    <span className="text-sm text-gray-700">Preço por jogador</span>
                    <span className="font-bold text-blue-600 text-lg">{price.toFixed(2)}€</span>
                  </div>
                )
              })()}

              {/* Level range info */}
              <div className="p-3 bg-gray-50 rounded-xl text-center">
                <p className="text-xs text-gray-500">Intervalo de nível</p>
                <p className="font-bold text-gray-900">
                  {Math.max(1.0, playerLevel - 0.5).toFixed(2)} - {Math.min(7.0, playerLevel + 0.5).toFixed(2)}
                </p>
                <p className="text-[10px] text-gray-400">Baseado no teu nível ({playerLevel.toFixed(2)})</p>
              </div>

              {/* Create button */}
              <button
                onClick={handleCreateGame}
                disabled={creating}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {creating ? t.booking.creating : `🎾 ${t.games.createGame}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Adicionar Jogador === */}
      {addPlayerModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden animate-fade-in max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-lg text-gray-900">
                {t.games.addPlayer ?? 'Adicionar jogador'}
                {addPlayerModal.position != null && (
                  <span className="ml-2 text-sm font-normal text-indigo-600">
                    ({addPlayerModal.position <= 2 ? t.games.team1 ?? 'Equipa 1' : t.games.team2 ?? 'Equipa 2'})
                  </span>
                )}
              </h3>
              <button
                onClick={() => { setAddPlayerModal(null); setPlayerSearchQuery(''); setPlayerSearchResults([]) }}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-100 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar jogador por nome..."
                  value={playerSearchQuery}
                  onChange={(e) => handleSearchPlayers(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  autoFocus
                />
              </div>
            </div>

            {/* Results */}
            <div className="overflow-y-auto flex-1 p-2">
              {searchingPlayers && (
                <div className="text-center py-8 text-gray-500 text-sm">A pesquisar...</div>
              )}
              {!searchingPlayers && playerSearchQuery.length >= 2 && playerSearchResults.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">Nenhum jogador encontrado</div>
              )}
              {!searchingPlayers && playerSearchQuery.length < 2 && (
                <div className="text-center py-8 text-gray-400 text-sm">Escreve pelo menos 2 letras para pesquisar</div>
              )}
              {playerSearchResults.map(pr => {
                const prColors = levelColors(pr.level)
                // Check if already in game
                const currentGame = games.find(g => g.id === addPlayerModal.gameId)
                const alreadyInGame = currentGame?.players.some(p => p.player_account_id === pr.id)
                return (
                  <button
                    key={pr.id}
                    disabled={addingPlayer || alreadyInGame}
                    onClick={() => handleAddPlayerToGame(pr.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                      alreadyInGame 
                        ? 'opacity-50 cursor-not-allowed bg-gray-50' 
                        : 'hover:bg-indigo-50 active:bg-indigo-100'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                      {pr.avatar_url ? (
                        <img src={pr.avatar_url} alt={pr.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold text-gray-500">{(pr.name || '?').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{pr.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {pr.level != null && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: prColors?.hex || '#9ca3af' }}>
                            {pr.level.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Action */}
                    <div className="flex-shrink-0">
                      {alreadyInGame ? (
                        <span className="text-xs text-green-600 font-medium">No jogo</span>
                      ) : (
                        <Plus className="w-5 h-5 text-indigo-500" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Tipos para aulas (usando os do classes.ts)
// LearnScreen (+ ClassCard/ClassDetailsModal) e BookingScreen extraídos para src/components/screens/ (React.lazy).

