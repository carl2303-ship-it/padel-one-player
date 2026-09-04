import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react'
import { ArrowLeft, Calendar, Check, ChevronDown, ChevronRight, Clock, ExternalLink, MapPin, RefreshCw, Trophy, Users, X } from 'lucide-react'
import { useI18n } from '../../lib/i18nContext'
import { supabase, type PlayerAccount } from '../../lib/supabase'
import type { PlayerDashboardData } from '../../lib/playerDashboardData'
import {
  fetchUpcomingTournaments,
  fetchTournamentsByIds,
  fetchTournamentEnrolledCounts,
  fetchEnrolledByCategory,
  fetchTournamentFullDetail,
  getTournamentRegistrationUrl,
  fetchMyTournamentInvites,
  updateTournamentInviteStatus,
  type UpcomingTournamentFromTour,
  type EnrolledByCategory,
  type EnrolledItem,
  type EnrolledPlayer,
  type TournamentFullDetail,
} from '../../lib/clubAndTournaments'
import {
  requestPartnerMatch,
  fetchPendingPartnerInvites,
  fetchPartnerMatchRequesterSummary,
  acceptPartnerInvite,
  confirmPartnerMatch,
  declinePartnerInvite,
  cancelPartnerRequest,
  type PartnerInvite,
  type PartnerMatchRequesterSummary,
} from '../../lib/partnerMatch'
import { getCachedPlayerData } from '../../lib/playerDataCache'
import { isLikelyTeamLabel } from '../../lib/matchPlayerNames'
import { normalizePhone } from '../../lib/phoneUtils'
import PlayerLadderTournamentPanel from '../PlayerLadderTournamentPanel'
import {
  formatDate,
  formatDateTime,
  TournamentCard,
  EnrolledItemRow,
  PlayerPreviewPopup,
} from '../shared/matchUi'

export default function CompeteScreen({
  dashboardData,
  favoriteClubId,
  clubIds,
  userId,
  playerAccountId,
  player,
  onBack,
  initialTournamentId,
  onInitialTournamentConsumed,
  onOpenCommunityGroupChat,
  onOpenPlayerProfile,
}: {
  dashboardData: PlayerDashboardData | null
  favoriteClubId: string | null
  clubIds: string[]
  userId: string | null
  playerAccountId: string | null
  player: PlayerAccount | null
  onBack: () => void
  initialTournamentId?: string | null
  onInitialTournamentConsumed?: () => void
  onOpenCommunityGroupChat?: (groupId: string) => void
  onOpenPlayerProfile?: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
}) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'upcoming' | 'leagues' | 'history'>('upcoming')
  const [upcomingFromTour, setUpcomingFromTour] = useState<UpcomingTournamentFromTour[]>([])
  const [tourEnrolledCounts, setTourEnrolledCounts] = useState<Map<string, number>>(new Map())
  const [loadingUpcoming, setLoadingUpcoming] = useState(true)
  const [viewingLeague, setViewingLeague] = useState<{ id: string; name: string } | null>(null)
  const [leagueFull, setLeagueFull] = useState<any[]>([])
  const [leagueCategories, setLeagueCategories] = useState<{ category_name: string; standings: any[] }[]>([])
  const [leagueCategoryTab, setLeagueCategoryTab] = useState('')
  const [leagueLoading, setLeagueLoading] = useState(false)
  const [viewingTournament, setViewingTournament] = useState<{ id: string; name: string } | null>(null)
  const [tournamentDetail, setTournamentDetail] = useState<{ standings: any[]; myMatches: any[]; name: string } | null>(null)
  const [detailTab, setDetailTab] = useState<'standings' | 'matches'>('standings')
  const [viewingEnrolled, setViewingEnrolled] = useState<{ id: string; name: string } | null>(null)
  const [enrolledData, setEnrolledData] = useState<EnrolledByCategory[]>([])
  const [enrolledLoading, setEnrolledLoading] = useState(false)
  const [previewPlayer, setPreviewPlayer] = useState<EnrolledPlayer | null>(null)
  const [pastTournamentDetails, setPastTournamentDetails] = useState<Record<string, { standings: any[]; myMatches: any[]; playerPosition?: number; tournamentName: string; categoryStandings?: Record<string, { categoryName: string; standings: any[]; myMatches: any[]; allMatches: any[]; playerPosition?: number }> }>>({})
  const [pastTournamentLoading, setPastTournamentLoading] = useState(false)
  const [leaguesDirect, setLeaguesDirect] = useState<PlayerDashboardData['leagueStandings']>([])
  const [leaguesLoading, setLeaguesLoading] = useState(false)
  const [leaguesFetched, setLeaguesFetched] = useState(false)
  const [historyFetched, setHistoryFetched] = useState(false)
  const [availableTournaments, setAvailableTournaments] = useState<UpcomingTournamentFromTour[]>([])
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [openGameHistory, setOpenGameHistory] = useState<import('../../lib/openGames').OpenGameMatchResult[]>([])
  const [openGameHistoryLoading, setOpenGameHistoryLoading] = useState(false)
  const [openGameHistoryFetched, setOpenGameHistoryFetched] = useState(false)
  const [selectedTournamentDetail, setSelectedTournamentDetail] = useState<TournamentFullDetail | null>(null)
  const [selectedTournamentLoading, setSelectedTournamentLoading] = useState(false)
  const [pendingInviteForTournament, setPendingInviteForTournament] = useState<string | null>(null)
  const [inviteActionLoading, setInviteActionLoading] = useState(false)
  const [categoryDetails, setCategoryDetails] = useState<import('../../lib/clubAndTournaments').TournamentCategoryDetail[]>([])
  const [categoryDetailsLoading, setCategoryDetailsLoading] = useState(false)
  const [expandedDetailCats, setExpandedDetailCats] = useState<Set<string>>(new Set())
  const [showFindPartnerModal, setShowFindPartnerModal] = useState(false)
  const [partnerSide, setPartnerSide] = useState<'right' | 'left' | 'both'>('both')
  const [partnerTargetMode, setPartnerTargetMode] = useState<'any' | 'following' | 'direct'>('any')
  const [partnerInviteePhone, setPartnerInviteePhone] = useState('')
  const [partnerInviteeLookup, setPartnerInviteeLookup] = useState<{ found: boolean; name: string | null; position: string | null } | null>(null)
  const [partnerInviteeLooking, setPartnerInviteeLooking] = useState(false)
  const partnerPhoneLookupRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [partnerMinLevel, setPartnerMinLevel] = useState<number>(1.0)
  const [partnerMaxLevel, setPartnerMaxLevel] = useState<number>(7.0)
  const [partnerLoading, setPartnerLoading] = useState(false)
  const [pendingPartnerInvites, setPendingPartnerInvites] = useState<PartnerInvite[]>([])
  const [partnerInvitesLoading, setPartnerInvitesLoading] = useState(false)
  const [partnerRequestSummary, setPartnerRequestSummary] = useState<PartnerMatchRequesterSummary | null>(null)
  const [partnerSummaryRefreshing, setPartnerSummaryRefreshing] = useState(false)

  const d = dashboardData
  const name = d?.playerName ?? ''

  const effectivePastDetails = useMemo(() => {
    const edge = d?.pastTournamentDetails || {}
    const client = pastTournamentDetails
    const merged: Record<string, any> = {}
    const allIds = new Set([...Object.keys(edge), ...Object.keys(client)])
    for (const id of allIds) {
      if (client[id] && edge[id]) {
        merged[id] = { ...edge[id], ...client[id] }
      } else {
        merged[id] = client[id] || edge[id]
      }
    }
    return merged
  }, [pastTournamentDetails, d?.pastTournamentDetails])

  // Preferir dados da edge function (leaguesDirect) pois incluem league_status e league_categories
  const leagueStandings = leaguesDirect.length > 0 ? leaguesDirect : (d?.leagueStandings ?? [])
  


  useEffect(() => {
    let active = true
    const effectiveClubIds = clubIds.length > 0 ? clubIds : (favoriteClubId ? [favoriteClubId] : [])
    ;(async () => {
      try {
        const list = await fetchUpcomingTournaments(
          effectiveClubIds.length > 0 ? effectiveClubIds : undefined,
          {
            playerPhone: player?.phone_number || null,
            playerLat: (player as any)?.lat || null,
            playerLng: (player as any)?.lng || null,
          }
        )
        if (!active) return

        let invitedIds = new Set<string>()
        if (player?.id) {
          const invites = await fetchMyTournamentInvites(player.id)
          invitedIds = new Set(invites.map(i => i.tournament_id))
        }

        const pg: string | undefined = player?.gender as string | undefined ||
          (player?.player_category?.startsWith('M') ? 'male' : undefined) ||
          (player?.player_category?.startsWith('F') ? 'female' : undefined)

        const inferGender = (t: UpcomingTournamentFromTour): string | null => {
          if (t.gender && t.gender !== 'all') return t.gender
          const nm = (t.name || '').toLowerCase()
          if (nm.includes('masc') || nm.includes(' m.') || nm.includes(' m ')) return 'male'
          if (nm.includes('fem') || nm.includes(' f.') || nm.includes(' f ')) return 'female'
          return null
        }

        const filtered = list
          .filter(t => {
            if (t.visibility === 'invite_only' && !invitedIds.has(t.id)) return false
            const tg = inferGender(t)
            if (tg && tg !== 'all' && tg !== 'mixed') {
              if (pg) {
                if (tg === 'male' && pg !== 'male') return false
                if (tg === 'female' && pg !== 'female') return false
              }
            }
            return true
          })
          .map(t => ({ ...t, is_invited: invitedIds.has(t.id) }))

        const tourIds = new Set(filtered.map(t => t.id))
        const enrolledIds = (d?.upcomingTournaments ?? []).map(t => t.id).filter(id => !tourIds.has(id))
        if (enrolledIds.length > 0) {
          const extra = await fetchTournamentsByIds(enrolledIds)
          extra.forEach(t => {
            if (!tourIds.has(t.id)) {
              filtered.push({ ...t, is_invited: invitedIds.has(t.id) })
            }
          })
        }

        const allIds = filtered.map(t => t.id)
        const counts = await fetchTournamentEnrolledCounts(allIds)

        if (active) {
          setUpcomingFromTour(filtered)
          setTourEnrolledCounts(counts)
          setLoadingUpcoming(false)
        }
      } catch {
        if (active) setLoadingUpcoming(false)
      }
    })()
    return () => { active = false }
  }, [clubIds, favoriteClubId, player?.id, player?.phone_number, (player as any)?.lat, (player as any)?.lng, d?.upcomingTournaments])


  // Buscar torneios disponíveis filtrados por género e nível
  useEffect(() => {
    if (activeTab !== 'upcoming') return
    let active = true
    const effIds = clubIds.length > 0 ? clubIds : (favoriteClubId ? [favoriteClubId] : [])
    setLoadingAvailable(true)

    ;(async () => {
      try {
        const list = await fetchUpcomingTournaments(
          effIds.length > 0 ? effIds : undefined,
          {
            playerPhone: player?.phone_number || null,
            playerLat: (player as any)?.lat || null,
            playerLng: (player as any)?.lng || null,
          }
        )
        if (!active) return

        let invitedIds = new Set<string>()
        if (player?.id) {
          const invites = await fetchMyTournamentInvites(player.id)
          invitedIds = new Set(invites.map(i => i.tournament_id))
        }

        const enrolledIds = new Set((d?.upcomingTournaments ?? []).map((t) => t.id))
        const playerGender = player?.gender as string | undefined ||
          (player?.player_category?.startsWith('M') ? 'male' : null) ||
          (player?.player_category?.startsWith('F') ? 'female' : null) ||
          undefined

        const inferTournamentGender = (t: UpcomingTournamentFromTour): string | null => {
          if (t.gender && t.gender !== 'all') return t.gender
          const nameLower = (t.name || '').toLowerCase()
          if (nameLower.includes('masc') || nameLower.includes(' m.') || nameLower.includes(' m ')) return 'male'
          if (nameLower.includes('fem') || nameLower.includes(' f.') || nameLower.includes(' f ')) return 'female'
          return null
        }

        const activeNotEnrolled = list
          .filter((t) => {
            if (t.status !== 'active' || enrolledIds.has(t.id)) return false
            if (t.visibility === 'invite_only' && !invitedIds.has(t.id)) return false
            // Filter by gender (explicit field or inferred from name)
            const tournamentGender = inferTournamentGender(t)
            if (tournamentGender && tournamentGender !== 'all' && tournamentGender !== 'mixed') {
              if (playerGender) {
                if (tournamentGender === 'male' && playerGender !== 'male') return false
                if (tournamentGender === 'female' && playerGender !== 'female') return false
              }
            }
            return true
          })
          .map(t => ({ ...t, is_invited: invitedIds.has(t.id) }))

        const { supabase } = await import('../../lib/supabase')
        const filtered: UpcomingTournamentFromTour[] = []

        for (const tournament of activeNotEnrolled) {
          const { data: categories } = await supabase
            .from('tournament_categories')
            .select('id, name, min_level, max_level, max_teams')
            .eq('tournament_id', tournament.id)

          if (categories && categories.length > 0) {
            let hasCompatibleCategory: boolean
            const pLevel = player?.level != null ? Number(player.level) : null

            if (pLevel != null) {
              hasCompatibleCategory = categories.some(cat => {
                const minLvl = cat.min_level != null ? Number(cat.min_level) : null
                const maxLvl = cat.max_level != null ? Number(cat.max_level) : null
                if (minLvl == null && maxLvl == null) return true
                if (minLvl != null && pLevel < minLvl) return false
                if (maxLvl != null && pLevel > maxLvl) return false
                return true
              })
            } else {
              const allHaveLevel = categories.every(cat => cat.min_level != null || cat.max_level != null)
              hasCompatibleCategory = !allHaveLevel
            }

            if (hasCompatibleCategory) {
              const totalMax = categories.reduce((sum, c) => c.max_teams ? sum + c.max_teams : sum, 0)
              let isFull = false
              if (totalMax > 0) {
                const isIndiv = tournament.format === 'individual_groups_knockout' || tournament.format === 'mixed_american' || (tournament.format === 'round_robin' && tournament.round_robin_type === 'individual')
                const table = isIndiv ? 'players' : 'teams'
                const { count } = await supabase
                  .from(table)
                  .select('id', { count: 'exact', head: true })
                  .eq('tournament_id', tournament.id)
                isFull = (count ?? 0) >= totalMax
              }
              filtered.push({ ...tournament, is_full: isFull })
            }
          } else {
            filtered.push(tournament)
          }
        }

        if (active) {
          setAvailableTournaments(filtered.slice(0, 10))
          setLoadingAvailable(false)
        }
      } catch (err) {
        console.error('[Available Tournaments] Error:', err)
        if (active) setLoadingAvailable(false)
      }
    })()

    return () => { active = false }
  }, [activeTab, favoriteClubId, clubIds, d?.upcomingTournaments, player?.level, player?.gender, player?.player_category])

  // Buscar ligas quando abre o tab Ligas (via Edge Function - bypass RLS)
  useEffect(() => {
    if (activeTab !== 'leagues') return
    if (leaguesFetched) return
    if (!playerAccountId) return
    let active = true
    setLeaguesLoading(true)
    ;(async () => {
      try {
        // Fetching leagues for player
        
        const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxaXdueGNleHNjY2d1cnVpdGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3Njc5MzcsImV4cCI6MjA3NTM0MzkzN30.Dl05zPQDtPVpmvn_Y-JokT3wDq0Oh9uF3op5xcHZpkY'
        
        // Usar fetch direto com Authorization e apikey
        const resp = await fetch(
          `https://rqiwnxcexsccguruiteq.supabase.co/functions/v1/get-player-leagues`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
            },
            body: JSON.stringify({ player_account_id: playerAccountId }),
          }
        )
        
        if (active && resp.ok) {
          const data = await resp.json()
          if (data?.leagues?.length) {
            setLeaguesDirect(data.leagues)
          }
        } else {
          const errorText = await resp.text()
          console.error('[Leagues] Edge Function error:', resp.status, errorText)
        }
      } catch (err) {
        console.error('[Leagues] ERROR:', err)
      }
      if (active) { setLeaguesLoading(false); setLeaguesFetched(true) }
    })()
    return () => { active = false }
  }, [activeTab, leaguesFetched, playerAccountId])

  // Reset open game history cache when dashboard data changes (e.g. after quick result)
  useEffect(() => {
    setOpenGameHistoryFetched(false)
  }, [dashboardData])

  // Carregar resultados de jogos abertos quando abre o tab history
  useEffect(() => {
    if (activeTab !== 'history') return
    if (!userId) return
    if (openGameHistoryFetched) return
    let active = true
    setOpenGameHistoryLoading(true)
    ;(async () => {
      try {
        const { fetchConfirmedOpenGameResults } = await import('../../lib/openGames')
        const data = await fetchConfirmedOpenGameResults(userId, playerAccountId || undefined)
        if (active) setOpenGameHistory(data)
      } catch (err) {
        console.error('[History] Error fetching open game results:', err)
      }
      if (active) { setOpenGameHistoryLoading(false); setOpenGameHistoryFetched(true) }
    })()
    return () => { active = false }
  }, [activeTab, userId, playerAccountId, openGameHistoryFetched])

  const [historyVisibleCount, setHistoryVisibleCount] = useState(5)
  const [historyLoadedCount, setHistoryLoadedCount] = useState(0)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, Set<string>>>({})

  const toggleCategoryExpanded = (tournamentId: string, catId: string) => {
    setExpandedCategories(prev => {
      const copy = { ...prev }
      const set = new Set(copy[tournamentId] || [])
      if (set.has(catId)) set.delete(catId); else set.add(catId)
      copy[tournamentId] = set
      return copy
    })
  }

  useEffect(() => {
    if (activeTab !== 'history') return
    if (!d?.pastTournaments?.length) return
    if (!userId) return
    const completedTournaments = d.pastTournaments.filter((t: any) => {
      const isCompleted = t.status === 'completed' || t.status === 'finished'
      const isCanceled = t.status === 'canceled' || t.status === 'cancelled'
      return isCompleted && !isCanceled
    })
    const toLoad = completedTournaments.slice(0, historyVisibleCount)
    const alreadyLoaded = toLoad.filter(t => pastTournamentDetails[t.id])
    if (alreadyLoaded.length === toLoad.length) {
      setPastTournamentLoading(false)
      return
    }
    let active = true
    setPastTournamentLoading(true)
    ;(async () => {
      try {
        const { fetchTournamentStandingsAndMatches } = await import('../../lib/playerDashboardData')
        const results: Record<string, any> = { ...pastTournamentDetails }
        for (const t of toLoad) {
          if (!active) break
          if (results[t.id]) continue
          try {
            const data = await fetchTournamentStandingsAndMatches(t.id, userId!)
            results[t.id] = { standings: data.standings, myMatches: data.myMatches, playerPosition: data.playerPosition, tournamentName: data.tournamentName, categoryStandings: data.categoryStandings }
            if (active) {
              setPastTournamentDetails({ ...results })
              setHistoryLoadedCount(Object.keys(results).length)
            }
          } catch (err) {
            console.error(`[History] Error ${t.name}:`, err)
            results[t.id] = { standings: [], myMatches: [], tournamentName: t.name }
          }
        }
      } catch (err) {
        console.error('[History] ERROR:', err)
      }
      if (active) { setPastTournamentLoading(false); setHistoryFetched(true) }
    })()
    return () => { active = false }
  }, [activeTab, d?.pastTournaments?.length, historyVisibleCount, userId])

  const viewLeague = async (id: string, leagueName: string) => {
    setViewingLeague({ id, name: leagueName })
    setLeagueFull([])
    setLeagueCategories([])
    setLeagueLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('get-league-standings', {
        body: { league_id: id, player_name: dashboardData?.playerName },
      })
      
      if (error) {
        console.error('[League] Error:', error)
      } else if (data) {
        setLeagueFull(data.standings || [])
        setLeagueCategories(data.categories || [])
      }
    } catch (err) {
      console.error('[League] Error:', err)
    }
    setLeagueLoading(false)
  }

  const viewEnrolled = async (tournamentId: string, tournamentName: string) => {
    setViewingEnrolled({ id: tournamentId, name: tournamentName })
    setEnrolledLoading(true)
    setEnrolledData([])
    try {
      const data = await fetchEnrolledByCategory(tournamentId)
      setEnrolledData(data)
    } catch {
      setEnrolledData([])
    }
    setEnrolledLoading(false)
  }

  const handleEnrolledPlayerClick = (p: EnrolledPlayer) => {
    if (!p?.name || isLikelyTeamLabel(p.name)) return
    setPreviewPlayer(p)
  }

  const openTournamentDetail = async (tournamentId: string) => {
    setSelectedTournamentLoading(true)
    setSelectedTournamentDetail(null)
    setCategoryDetails([])
    setExpandedDetailCats(new Set())
    setPendingInviteForTournament(null)
    try {
      const detail = await fetchTournamentFullDetail(tournamentId, player?.id)
      setSelectedTournamentDetail(detail)
      if (player?.id) {
        const invites = await fetchMyTournamentInvites(player.id)
        const pending = invites.find(i => i.tournament_id === tournamentId && i.status === 'pending')
        if (pending) setPendingInviteForTournament(tournamentId)
      }
      if (detail) {
        const isAmericano = ['mixed_american', 'individual_groups_knockout', 'round_robin', 'ladder'].includes(detail.format)
        if (!isAmericano) {
          setCategoryDetailsLoading(true)
          try {
            const { fetchTournamentCategoryDetails } = await import('../../lib/clubAndTournaments')
            const catDetails = await fetchTournamentCategoryDetails(tournamentId)
            setCategoryDetails(catDetails)
            const autoExpand = new Set<string>()
            catDetails.forEach(cd => { if (cd.hasData) autoExpand.add(cd.category_id) })
            if (autoExpand.size > 0) setExpandedDetailCats(autoExpand)
          } catch (err) {
            console.error('[CompeteScreen] Error loading category details:', err)
          }
          setCategoryDetailsLoading(false)
        }
      }
    } catch (err) {
      console.error('[CompeteScreen] Error loading tournament detail:', err)
    }
    setSelectedTournamentLoading(false)
  }

  const fetchPartnerInvites = useCallback(async () => {
    if (!player?.id) return
    setPartnerInvitesLoading(true)
    try {
      const invites = await fetchPendingPartnerInvites(player.id)
      setPendingPartnerInvites(invites)
    } finally {
      setPartnerInvitesLoading(false)
    }
  }, [player?.id])

  useEffect(() => {
    if (!player?.id) return
    void fetchPartnerInvites()
    const interval = window.setInterval(() => void fetchPartnerInvites(), 25000)
    const onVis = () => {
      if (document.visibilityState === 'visible') void fetchPartnerInvites()
    }
    document.addEventListener('visibilitychange', onVis)
    const rtFilter = userId
      ? `invitee_user_id=eq.${userId}`
      : `invitee_player_account_id=eq.${player.id}`
    const channel = supabase
      .channel(`compete-partner-invites-${userId ?? player.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'partner_match_invites',
          filter: rtFilter,
        },
        () => void fetchPartnerInvites(),
      )
      .subscribe()
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVis)
      void supabase.removeChannel(channel)
    }
  }, [player?.id, userId, fetchPartnerInvites])

  const loadPartnerRequestSummary = async (tournamentId: string) => {
    if (!player?.id) {
      setPartnerRequestSummary(null)
      return
    }
    const s = await fetchPartnerMatchRequesterSummary(tournamentId)
    setPartnerRequestSummary(s)
  }

  useEffect(() => {
    setPartnerRequestSummary(null)
    if (!selectedTournamentDetail?.id || !player?.id) return
    let cancelled = false
    ;(async () => {
      const s = await fetchPartnerMatchRequesterSummary(selectedTournamentDetail.id)
      if (!cancelled) setPartnerRequestSummary(s)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedTournamentDetail?.id, player?.id])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const deepTournamentId = params.get('tournament')
    const deepInviteId = params.get('partner_invite')
    const deepConfirmId = params.get('partner_confirm')
    if (deepTournamentId) openTournamentDetail(deepTournamentId)
    if (deepInviteId) {
      setActiveTab('upcoming')
      fetchPartnerInvites()
    }
    if (deepConfirmId && deepTournamentId) {
      // Requester landed from push — summary will show confirm button
      setActiveTab('upcoming')
    }
  }, [])

  useEffect(() => {
    if (initialTournamentId) {
      openTournamentDetail(initialTournamentId)
      onInitialTournamentConsumed?.()
    }
  }, [initialTournamentId])

  const formatFormatName = (format: string) => {
    const formatMap: Record<string, string> = {
      'round_robin': t.common.tournamentFormatRoundRobin,
      'single_elimination': t.common.tournamentFormatSingleElimination,
      'groups_knockout': t.common.tournamentFormatGroupsKnockout,
      'individual_groups_knockout': t.common.tournamentFormatIndividualGroupsKnockout,
      'ladder': t.common.tournamentFormatLadder,
      'super_teams': 'Super Equipas', // TODO: traduzir
    }
    return formatMap[format] || format
  }

  const isPartnerMatchingEligible = (format?: string, roundRobinType?: string | null) => {
    if (!format) return false
    if (format === 'round_robin') return roundRobinType !== 'individual'
    return !['individual_groups_knockout', 'mixed_american'].includes(format)
  }

  const handlePartnerPhoneLookup = async (phone: string) => {
    const normalized = normalizePhone(phone)
    if (normalized.length < 6) {
      setPartnerInviteeLookup(null)
      return
    }
    setPartnerInviteeLooking(true)
    try {
      const { data } = await supabase
        .from('player_accounts')
        .select('name, court_position')
        .eq('phone_number', normalized)
        .not('user_id', 'is', null)
        .maybeSingle()
      if (data) {
        setPartnerInviteeLookup({ found: true, name: data.name, position: data.court_position || null })
      } else {
        setPartnerInviteeLookup({ found: false, name: null, position: null })
      }
    } catch {
      setPartnerInviteeLookup({ found: false, name: null, position: null })
    }
    setPartnerInviteeLooking(false)
  }

  const handlePartnerPhoneChange = (phone: string) => {
    setPartnerInviteePhone(phone)
    setPartnerInviteeLookup(null)
    if (partnerPhoneLookupRef.current) clearTimeout(partnerPhoneLookupRef.current)
    if (phone.replace(/\s+/g, '').length >= 6) {
      partnerPhoneLookupRef.current = setTimeout(() => handlePartnerPhoneLookup(phone), 500)
    }
  }

  const handleRequestPartner = async (tournament: TournamentFullDetail) => {
    setPartnerLoading(true)
    try {
      const result = await requestPartnerMatch({
        tournamentId: tournament.id,
        categoryId: null,
        sidePreference: partnerSide,
        targetMode: partnerTargetMode,
        minLevel: partnerMinLevel,
        maxLevel: partnerMaxLevel,
        ...(partnerTargetMode === 'direct' && partnerInviteePhone ? { inviteePhone: partnerInviteePhone } : {}),
      })
      if (partnerTargetMode === 'direct' && result?.invitesSent > 0) {
        const name = result?.inviteeName || 'jogador'
        alert(`Convite enviado para ${name}! O jogador pode aceitar em Compete → Convites de Parceiro.`)
      } else if (result?.invitesSent > 0) {
        const delivered = Number(result?.pushDelivered || 0)
        alert(
          `Convites registados para ${result.invitesSent} jogador(es). Cada um pode ver o convite em Compete → Convites de Parceiro (não precisa de notificação push).\n\nNotificações push entregues: ${delivered} (só para quem tem alertas ativos neste dispositivo).`,
        )
      } else {
        alert('Pedido criado, sem candidatos disponíveis de momento.')
      }
      setShowFindPartnerModal(false)
      setPartnerInviteePhone('')
      setPartnerInviteeLookup(null)
      await loadPartnerRequestSummary(tournament.id)
    } catch (error: any) {
      alert(error?.message || 'Não foi possível enviar o pedido.')
    } finally {
      setPartnerLoading(false)
    }
  }

  const handleAcceptInvite = async (invite: PartnerInvite) => {
    try {
      const result = await acceptPartnerInvite(invite.id)
      await fetchPartnerInvites()
      if (selectedTournamentDetail?.id) await loadPartnerRequestSummary(selectedTournamentDetail.id)
      alert(
        result?.awaitingConfirmation
          ? `Aceitaste o convite! Aguarda que ${result.requesterName || 'o parceiro'} confirme a inscrição da dupla.`
          : ((t as any).partner?.pairCreatedSuccess || 'Dupla criada e inscrita com sucesso.'),
      )
    } catch (error: any) {
      alert(error?.message || (t as any).partner?.acceptError || 'Não foi possível aceitar o convite.')
    }
  }

  const handleConfirmPartnerMatch = async (inviteId: string) => {
    try {
      const result = await confirmPartnerMatch(inviteId)
      if (selectedTournamentDetail?.id) {
        await loadPartnerRequestSummary(selectedTournamentDetail.id)
        const refreshed = await fetchTournamentFullDetail(selectedTournamentDetail.id, player?.id)
        if (refreshed) setSelectedTournamentDetail(refreshed)
      }
      if (result?.checkoutUrl) window.open(result.checkoutUrl, '_blank', 'noopener,noreferrer')
      alert(
        result?.checkoutUrl
          ? 'Inscrição criada. Completa o pagamento para confirmar.'
          : 'Inscrição da dupla confirmada com sucesso!',
      )
    } catch (error: any) {
      alert(error?.message || 'Não foi possível confirmar a inscrição.')
    }
  }

  const handleDeclineInvite = async (invite: PartnerInvite) => {
    try {
      await declinePartnerInvite(invite.id)
      await fetchPartnerInvites()
    } catch (error: any) {
      alert(error?.message || (t as any).partner?.declineError || 'Não foi possível recusar o convite.')
    }
  }

  // Se o detalhe do torneio está aberto, mostra a página de detalhe
  const playerPreviewModal = (
    <PlayerPreviewPopup player={previewPlayer} onClose={() => setPreviewPlayer(null)} />
  )

  if (selectedTournamentDetail || selectedTournamentLoading) {
    const td = selectedTournamentDetail
    const enrolledIds = new Set((d?.upcomingTournaments ?? []).map((t) => t.id))
    const isEnrolled = td ? enrolledIds.has(td.id) : false

    return (
      <>
      <div className="space-y-4 animate-fade-in">
        <button
          onClick={() => { setSelectedTournamentDetail(null); setSelectedTournamentLoading(false) }}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" /> {t.common.back}
        </button>

        {selectedTournamentLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-3 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : td ? (
          <div className="space-y-4">
            {/* Header com imagem */}
            {td.image_url ? (
              <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '4/5' }}>
                <img src={td.image_url} alt={td.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h1 className="text-xl font-bold text-white drop-shadow">{td.name}</h1>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-2xl p-6">
                <h1 className="text-xl font-bold text-white">{td.name}</h1>
              </div>
            )}

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${td.is_full ? 'bg-red-100 text-red-700' : td.status === 'active' ? 'bg-green-100 text-green-700' : td.status === 'completed' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700'}`}>
                {td.is_full ? '🔴 Cheio' : td.status === 'active' ? '🟢 Aberto' : td.status === 'completed' ? '✅ Concluído' : td.status === 'draft' ? '📝 Rascunho' : td.status}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                🏸 {formatFormatName(td.format)}
              </span>
              {isEnrolled && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                  ✅ Inscrito
                </span>
              )}
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Data</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(td.start_date)}</p>
                  {td.start_date !== td.end_date && (
                    <p className="text-xs text-gray-500">até {formatDate(td.end_date)}</p>
                  )}
                </div>
              </div>
              <div className="card p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Horário</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {td.daily_start_time || '09:00'} - {td.daily_end_time || '21:00'}
                  </p>
                </div>
              </div>
              <div className="card p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Inscritos</p>
                  <p className="text-sm font-semibold text-gray-900">{td.total_enrolled}</p>
                </div>
              </div>
              <div className="card p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Campos</p>
                  <p className="text-sm font-semibold text-gray-900">{td.number_of_courts}</p>
                </div>
              </div>
            </div>

            {/* Clube */}
            {td.club_name && (
              <div className="card p-4 flex items-center gap-3">
                {td.club_logo ? (
                  <img src={td.club_logo} alt={td.club_name} className="w-10 h-10 rounded-xl object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500">{td.club_name!.includes(' · ') ? 'Clubes' : 'Clube'}</p>
                  <p className="text-sm font-semibold text-gray-900">{td.club_name}</p>
                </div>
              </div>
            )}

            {/* Descrição */}
            {td.description && (
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{(t as any).partner?.description || 'Descrição'}</h3>
                <div className="text-sm text-gray-600 [&_p]:my-1 [&_ul]:pl-4 [&_li]:list-disc" dangerouslySetInnerHTML={{ __html: td.description }} />
              </div>
            )}

            {partnerRequestSummary && (
              <div className="card p-4 border border-blue-100 bg-blue-50/60">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{(t as any).partner?.invitesSent || 'Convites que enviaste'}</h3>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!td) return
                      setPartnerSummaryRefreshing(true)
                      try {
                        await loadPartnerRequestSummary(td.id)
                      } finally {
                        setPartnerSummaryRefreshing(false)
                      }
                    }}
                    disabled={partnerSummaryRefreshing}
                    className="p-1.5 rounded-lg text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    aria-label="Atualizar estado dos convites"
                  >
                    <RefreshCw className={`w-4 h-4 ${partnerSummaryRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1 mb-3">
                  {(t as any).partner?.invitesSentHint || 'Todos os jogadores convidados podem ver o convite em Compete → Convites de Parceiro, mesmo sem alertas no telemóvel.'}
                </p>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-gray-500">{(t as any).partner?.invited || 'Convidados'}</dt>
                    <dd className="font-semibold text-gray-900">{partnerRequestSummary.invitationsTotal}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">{(t as any).partner?.pending || 'Em espera'}</dt>
                    <dd className="font-semibold text-amber-800">{partnerRequestSummary.pending}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">{(t as any).partner?.declined || 'Recusaram'}</dt>
                    <dd className="font-semibold text-gray-800">{partnerRequestSummary.declined}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">{(t as any).partner?.accepted || 'Aceitaram'}</dt>
                    <dd className="font-semibold text-green-700">{partnerRequestSummary.accepted}</dd>
                  </div>
                </dl>
                {(partnerRequestSummary.expired > 0 || partnerRequestSummary.cancelled > 0) && (
                  <p className="text-xs text-gray-500 mt-2">
                    {partnerRequestSummary.expired > 0 && <span>Expirados: {partnerRequestSummary.expired}. </span>}
                    {partnerRequestSummary.cancelled > 0 && <span>Cancelados: {partnerRequestSummary.cancelled}.</span>}
                  </p>
                )}
                <p className="text-xs text-gray-700 mt-3 leading-relaxed">
                  {partnerRequestSummary.status === 'awaiting_confirmation' && partnerRequestSummary.acceptedInviteId
                    ? `${partnerRequestSummary.acceptedInviteeName || 'Um jogador'} aceitou o teu convite. Confirma a inscrição da dupla.`
                    : partnerRequestSummary.pending > 0
                      ? `Ainda há ${partnerRequestSummary.pending} convite(s) por responder — podes conseguir parceiro se alguém aceitar.`
                      : partnerRequestSummary.accepted > 0
                        ? 'Alguém aceitou o convite. Confirma a inscrição abaixo.'
                        : 'Ninguém aceitou ainda e não há convites em espera. Podes usar «Encontrar parceiro» de novo para convidar outros jogadores.'}
                </p>
                {partnerRequestSummary.status === 'awaiting_confirmation' && partnerRequestSummary.acceptedInviteId && (
                  <button
                    type="button"
                    onClick={() => void handleConfirmPartnerMatch(partnerRequestSummary.acceptedInviteId!)}
                    className="mt-3 w-full py-3 px-3 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors"
                  >
                    Confirmar inscrição com {partnerRequestSummary.acceptedInviteeName || 'parceiro'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('Tens a certeza que queres cancelar este pedido de parceiro? Todos os convites pendentes serão cancelados.')) return
                    try {
                      await cancelPartnerRequest(partnerRequestSummary.requestId)
                      setPartnerRequestSummary(null)
                    } catch (err: any) {
                      alert(err?.message || 'Erro ao cancelar o pedido.')
                    }
                  }}
                  className="mt-3 w-full py-2 px-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Cancelar pedido de parceiro
                </button>
              </div>
            )}

            {/* Botão de inscrição / aceitar convite */}
            {!isEnrolled && td.status === 'active' && (
              <div className="space-y-2">
                {pendingInviteForTournament === td.id ? (
                  <>
                    <div className="card p-3 border-2 border-amber-200 bg-amber-50/40 mb-2">
                      <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                        <span>🔒</span> Foste convidado para este torneio exclusivo
                      </p>
                    </div>
                    <button
                      disabled={inviteActionLoading}
                      onClick={async () => {
                        if (!player?.id) return
                        setInviteActionLoading(true)
                        try {
                          await updateTournamentInviteStatus(player.id, td.id, 'accepted')
                          setPendingInviteForTournament(null)
                          alert('Inscrição aceite com sucesso!')
                          const refreshed = await fetchTournamentFullDetail(td.id, player?.id)
                          if (refreshed) setSelectedTournamentDetail(refreshed)
                        } catch (err) {
                          alert('Erro ao aceitar o convite.')
                        } finally {
                          setInviteActionLoading(false)
                        }
                      }}
                      className="flex items-center justify-center gap-2 w-full py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
                    >
                      {inviteActionLoading ? 'A processar...' : 'Aceitar convite e inscrever-me'}
                    </button>
                    <button
                      disabled={inviteActionLoading}
                      onClick={async () => {
                        if (!player?.id) return
                        if (!confirm('Tens a certeza que queres recusar este convite?')) return
                        setInviteActionLoading(true)
                        try {
                          await updateTournamentInviteStatus(player.id, td.id, 'declined')
                          setPendingInviteForTournament(null)
                          setSelectedTournamentDetail(null)
                          setSelectedTournamentLoading(false)
                        } catch (err) {
                          alert('Erro ao recusar o convite.')
                        } finally {
                          setInviteActionLoading(false)
                        }
                      }}
                      className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 font-medium rounded-xl transition-colors"
                    >
                      Recusar convite
                    </button>
                  </>
                ) : (
                  <>
                    <a
                      href={getTournamentRegistrationUrl(td.id, player?.phone_number || undefined)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
                    >
                      {(t as any).partner?.registerMe || 'Inscrever-me'}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    {isPartnerMatchingEligible(td.format, (td as any).round_robin_type || null) && (
                      <button
                        onClick={() => {
                          const lvl = player?.level ?? 3.0
                          setPartnerMinLevel(Math.max(1, parseFloat((lvl - 1).toFixed(1))))
                          setPartnerMaxLevel(Math.min(7, parseFloat((lvl + 1).toFixed(1))))
                          setShowFindPartnerModal(true)
                        }}
                        className="flex items-center justify-center gap-2 w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
                      >
                        {(t as any).partner?.findPartner || 'Encontrar Parceiro'}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Categorias: grupos, jogos e brackets (ou inscritos) */}
            {categoryDetailsLoading ? (
              <div className="card p-6 flex justify-center">
                <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {td.enrolled.length === 0 && categoryDetails.length === 0 ? (
                  <div className="card p-4">
                    <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-red-600" />
                      {(t as any).partner?.enrolledList || 'Inscritos'} ({td.total_enrolled})
                    </h3>
                    <p className="text-gray-500 text-center py-4">{(t as any).partner?.noEnrolled || 'Ainda sem inscritos.'}</p>
                  </div>
                ) : (
                  (() => {
                    const catDetailsMap = new Map(categoryDetails.map(cd => [cd.category_id, cd]))
                    const knockoutOrderLocal: Record<string, number> = { 'round_of_16': 0, 'quarter': 1, 'semi': 2, '3rd': 3, 'final': 4 }
                    const getKOOrder = (round: string) => {
                      const r = round.toLowerCase()
                      for (const [key, val] of Object.entries(knockoutOrderLocal)) { if (r.includes(key)) return val }
                      return 99
                    }
                    const knockoutLabelLocal = (round: string) => {
                      const r = round.toLowerCase()
                      if (r.includes('final') && !r.includes('semi') && !r.includes('quarter')) return 'Final'
                      if (r.includes('3rd')) return '3º/4º Lugar'
                      if (r.includes('semi')) return 'Meia-final'
                      if (r.includes('quarter')) return 'Quartos-de-final'
                      if (r.includes('round_of_16')) return 'Oitavos-de-final'
                      return round
                    }
                    const isAmericanoFormat = ['mixed_american', 'individual_groups_knockout', 'round_robin', 'ladder'].includes(td.format)
                    return td.enrolled.map((cat) => {
                      let catDetail = catDetailsMap.get(cat.category_id)
                      if (!catDetail && categoryDetails.length === 1) catDetail = categoryDetails[0]
                      const hasGroupsOrMatches = !isAmericanoFormat && catDetail?.hasData
                      const isExpanded = expandedDetailCats.has(cat.category_id)
                      const sortedKnockout = catDetail ? [...catDetail.knockoutMatches].sort((a, b) => getKOOrder(a.round) - getKOOrder(b.round)) : []

                      return (
                        <div key={cat.category_id} className="card p-4">
                          <button
                            onClick={() => setExpandedDetailCats(prev => {
                              const next = new Set(prev)
                              if (next.has(cat.category_id)) next.delete(cat.category_id)
                              else next.add(cat.category_id)
                              return next
                            })}
                            className="w-full flex items-center justify-between"
                          >
                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                              {cat.category_name}
                              <span className="text-xs font-normal text-gray-400">{cat.items.length} inscrito{cat.items.length !== 1 ? 's' : ''}</span>
                            </h3>
                            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>

                          {isExpanded && (
                            <div className="mt-3 space-y-3">
                              {td.format === 'ladder' && (
                                <PlayerLadderTournamentPanel
                                  tournamentId={td.id}
                                  categoryId={cat.category_id}
                                  authUserId={userId}
                                  playerAccountId={playerAccountId}
                                  tournamentName={td.name}
                                  onOpenChallengeChat={onOpenCommunityGroupChat}
                                />
                              )}
                              {cat.items.length > 0 && (
                                <div className="space-y-1.5">
                                  {cat.items.map((item, idx) => (
                                    <EnrolledItemRow
                                      key={item.id}
                                      item={item}
                                      index={idx}
                                      onPlayerClick={handleEnrolledPlayerClick}
                                    />
                                  ))}
                                </div>
                              )}
                              {hasGroupsOrMatches && catDetail ? (
                                <>
                                  {Object.keys(catDetail.groups).length > 0 && (
                                    Object.entries(catDetail.groups).sort(([a], [b]) => a.localeCompare(b)).map(([groupName, rows]) => {
                                      const groupTeamIds = new Set(rows.map(r => r.id))
                                      const matchesForGroup = catDetail.groupMatches.filter(m => {
                                        const r = m.round || ''
                                        if (r.includes(groupName) || r === `group_${groupName}` || r === `group ${groupName}`) return true
                                        if ((m.team1_id && groupTeamIds.has(m.team1_id)) || (m.team2_id && groupTeamIds.has(m.team2_id))) return true
                                        return false
                                      })
                                      return (
                                        <div key={groupName}>
                                          {Object.keys(catDetail.groups).length > 1 && (
                                            <p className="text-xs font-bold text-blue-600 mb-1">Grupo {groupName}</p>
                                          )}
                                          <div className="overflow-x-auto">
                                          <table className="w-full text-sm mb-1">
                                            <thead>
                                              <tr className="text-gray-500 border-b">
                                                <th className="py-1 px-1 text-left font-medium w-6">#</th>
                                                <th className="py-1 px-1 text-left font-medium min-w-0">Nome</th>
                                                <th className="py-1 px-1 text-center font-medium w-6">V</th>
                                                <th className="py-1 px-1 text-center font-medium w-6">E</th>
                                                <th className="py-1 px-1 text-center font-medium w-6">D</th>
                                                <th className="py-1 px-1 text-center font-medium w-8">+/-</th>
                                                <th className="py-1 px-1 text-center font-semibold w-8">Pts</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {rows.map((row, i) => {
                                                const diff = row.points_for - row.points_against
                                                return (
                                                  <tr key={row.id} className="border-b border-gray-50">
                                                    <td className="py-1 px-1 text-xs">{i + 1}</td>
                                                    <td className="py-1 px-1 min-w-0">
                                                      <div className="font-medium break-words text-xs">{row.name}</div>
                                                    </td>
                                                    <td className="py-1 px-1 text-center text-green-600 text-xs">{row.wins}</td>
                                                    <td className="py-1 px-1 text-center text-yellow-600 text-xs">{row.draws}</td>
                                                    <td className="py-1 px-1 text-center text-red-500 text-xs">{row.losses}</td>
                                                    <td className={`py-1 px-1 text-center text-[10px] ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>{diff > 0 ? '+' : ''}{diff}</td>
                                                    <td className="py-1 px-1 text-center font-bold text-xs">{row.points}</td>
                                                  </tr>
                                                )
                                              })}
                                            </tbody>
                                          </table>
                                          </div>
                                          {matchesForGroup.length > 0 && (
                                            <div className="space-y-1 mb-1">
                                              <p className="text-[10px] font-medium text-gray-400 uppercase">Jogos do Grupo</p>
                                              {matchesForGroup.map((m) => {
                                                const scores = [m.set1, m.set2, m.set3].filter(Boolean).join(' ')
                                                return (
                                                  <div key={m.id} className="flex justify-between items-center text-xs py-1 px-2 bg-gray-50 rounded">
                                                    <div className="flex-1 min-w-0">
                                                      <span className="text-gray-700">{m.team1_name}</span>
                                                      <span className="text-gray-400 mx-1">vs</span>
                                                      <span className="text-gray-700">{m.team2_name}</span>
                                                    </div>
                                                    <span className="font-semibold text-gray-800 ml-2 flex-shrink-0">{scores || (m.status === 'completed' ? '0-0' : '-')}</span>
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })
                                  )}
                                  {Object.keys(catDetail.groups).length === 0 && catDetail.groupMatches.length > 0 && (
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-medium text-gray-400 uppercase">Jogos</p>
                                      {catDetail.groupMatches.map((m) => {
                                        const scores = [m.set1, m.set2, m.set3].filter(Boolean).join(' ')
                                        return (
                                          <div key={m.id} className="flex justify-between items-center text-xs py-1 px-2 bg-gray-50 rounded">
                                            <div className="flex-1 min-w-0">
                                              <span className="text-gray-700">{m.team1_name}</span>
                                              <span className="text-gray-400 mx-1">vs</span>
                                              <span className="text-gray-700">{m.team2_name}</span>
                                            </div>
                                            <span className="font-semibold text-gray-800 ml-2 flex-shrink-0">{scores || (m.status === 'completed' ? '0-0' : '-')}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                  {sortedKnockout.length > 0 && (
                                    <div className="pt-2 border-t border-gray-100">
                                      <p className="text-xs font-bold text-orange-600 mb-1">Fase Eliminatória</p>
                                      <div className="space-y-1">
                                        {sortedKnockout.map((m) => {
                                          const scores = [m.set1, m.set2, m.set3].filter(Boolean).join(' ')
                                          return (
                                            <div key={m.id} className="flex justify-between items-center text-xs py-1.5 px-2 bg-orange-50 rounded">
                                              <div className="flex-1 min-w-0">
                                                <span className="text-[10px] text-orange-500 font-medium mr-1">{knockoutLabelLocal(m.round)}</span>
                                                <span className="text-gray-700">{m.team1_name}</span>
                                                <span className="text-gray-400 mx-1">vs</span>
                                                <span className="text-gray-700">{m.team2_name}</span>
                                              </div>
                                              <span className="font-semibold text-gray-800 ml-2 flex-shrink-0">{scores || (m.status === 'completed' ? '0-0' : '-')}</span>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : null}
                            </div>
                          )}
                        </div>
                      )
                    })
                  })()
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="card p-8 text-center text-gray-500">{(t as any).partner?.tournamentNotFound || 'Torneio não encontrado.'}</div>
        )}
        {showFindPartnerModal && td && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl p-4 w-full max-w-md space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">{(t as any).partner?.findPartner || 'Encontrar Parceiro'}</h3>
                <button onClick={() => { setShowFindPartnerModal(false); setPartnerInviteePhone(''); setPartnerInviteeLookup(null); }} className="p-1 rounded hover:bg-gray-100">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{(t as any).partner?.positionQuestion || 'Que posição procuras no parceiro?'}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPartnerSide('right')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${partnerSide === 'right' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{(t as any).partner?.right || 'Direita'}</button>
                  <button onClick={() => setPartnerSide('left')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${partnerSide === 'left' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{(t as any).partner?.left || 'Esquerda'}</button>
                  <button onClick={() => setPartnerSide('both')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${partnerSide === 'both' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{(t as any).partner?.both || 'Ambos'}</button>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{(t as any).partner?.targetQuestion || 'Como queres encontrar parceiro?'}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPartnerTargetMode('any')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${partnerTargetMode === 'any' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{(t as any).partner?.anyone || 'Qualquer um'}</button>
                  <button onClick={() => setPartnerTargetMode('following')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${partnerTargetMode === 'following' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{(t as any).partner?.followingOnly || 'Quem sigo'}</button>
                  <button onClick={() => setPartnerTargetMode('direct')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${partnerTargetMode === 'direct' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{(t as any).partner?.directInvite || 'Convidar'}</button>
                </div>
              </div>
              {partnerTargetMode === 'direct' && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">{(t as any).partner?.inviteePhoneLabel || 'Telemóvel do parceiro'}</p>
                  <div className="relative">
                    <input
                      type="tel"
                      value={partnerInviteePhone}
                      onChange={(e) => handlePartnerPhoneChange(e.target.value)}
                      className={`w-full p-2.5 border rounded-lg text-sm ${partnerInviteeLookup?.found ? 'border-green-400 bg-green-50' : partnerInviteeLookup && !partnerInviteeLookup.found ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                      placeholder="+351 912 345 678"
                    />
                    {partnerInviteeLooking && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  {partnerInviteeLookup?.found && (
                    <div className="mt-2 p-2.5 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                      <span className="text-green-600 text-lg">✓</span>
                      <div>
                        <p className="text-sm font-semibold text-green-800">{partnerInviteeLookup.name}</p>
                        {partnerInviteeLookup.position && (
                          <p className="text-xs text-green-600">Posição: {partnerInviteeLookup.position === 'right' ? 'Direita' : partnerInviteeLookup.position === 'left' ? 'Esquerda' : 'Ambos'}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {partnerInviteeLookup && !partnerInviteeLookup.found && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-xs text-red-600">Nenhum jogador encontrado com este número.</p>
                    </div>
                  )}
                  {!partnerInviteeLookup && !partnerInviteeLooking && (
                    <p className="text-xs text-gray-500 mt-1">{(t as any).partner?.inviteePhoneHint || 'O jogador tem que estar registado na app.'}</p>
                  )}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Intervalo de nível</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Mín</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPartnerMinLevel(v => Math.max(1, parseFloat((v - 0.5).toFixed(1))))}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 text-lg font-bold active:bg-gray-100"
                      >−</button>
                      <span className="flex-1 text-center text-sm font-semibold text-gray-800">{partnerMinLevel.toFixed(1)}</span>
                      <button
                        type="button"
                        onClick={() => setPartnerMinLevel(v => Math.min(7, parseFloat((v + 0.5).toFixed(1))))}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 text-lg font-bold active:bg-gray-100"
                      >+</button>
                    </div>
                  </div>
                  <span className="text-gray-400 mt-5">—</span>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Máx</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPartnerMaxLevel(v => Math.max(1, parseFloat((v - 0.5).toFixed(1))))}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 text-lg font-bold active:bg-gray-100"
                      >−</button>
                      <span className="flex-1 text-center text-sm font-semibold text-gray-800">{partnerMaxLevel.toFixed(1)}</span>
                      <button
                        type="button"
                        onClick={() => setPartnerMaxLevel(v => Math.min(7, parseFloat((v + 0.5).toFixed(1))))}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 text-lg font-bold active:bg-gray-100"
                      >+</button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">O teu nível: {player?.level?.toFixed(2) || '—'}</p>
              </div>
              <button
                onClick={() => handleRequestPartner(td)}
                disabled={partnerLoading || partnerMinLevel > partnerMaxLevel || (partnerTargetMode === 'direct' && (!partnerInviteeLookup?.found || partnerInviteePhone.replace(/\s+/g, '').length < 6))}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold"
              >
                {partnerLoading
                  ? ((t as any).partner?.searching || 'A procurar...')
                  : partnerTargetMode === 'direct'
                    ? ((t as any).partner?.sendInvite || 'Enviar Convite')
                    : ((t as any).partner?.find || 'Encontrar')}
              </button>
            </div>
          </div>
        )}
      </div>
      {playerPreviewModal}
    </>
    )
  }

  return (
    <>
    <div className="space-y-4 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-5 h-5" /> {t.common.back}
      </button>
      <h1 className="text-xl font-bold text-gray-900">{t.menu.compete}</h1>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 min-w-0 py-2 px-3 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === 'upcoming' ? 'bg-red-600 text-white' : 'text-gray-600'}`}
        >
          {t.home.tournaments}
        </button>
        <button
          onClick={() => setActiveTab('leagues')}
          className={`flex-1 min-w-0 py-2 px-3 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === 'leagues' ? 'bg-red-600 text-white' : 'text-gray-600'}`}
        >
          {t.games.leagues}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 min-w-0 py-2 px-3 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === 'history' ? 'bg-red-600 text-white' : 'text-gray-600'}`}
        >
          {t.games.history}
        </button>
      </div>

      {activeTab === 'upcoming' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{(t as any).partner?.partnerInvites || 'Convites de Parceiro'}</h3>
            <p className="text-xs text-gray-500 mb-3">{(t as any).partner?.partnerInvitesHint || 'Aparecem aqui mesmo sem notificações push ativadas — abre a app para veres e responderes.'}</p>
            {partnerInvitesLoading ? (
              <p className="text-sm text-gray-500">{(t as any).partner?.loading || 'A carregar...'}</p>
            ) : pendingPartnerInvites.length === 0 ? (
              <p className="text-sm text-gray-500">{(t as any).partner?.noPending || 'Sem convites pendentes.'}</p>
            ) : (
              <div className="space-y-2">
                {pendingPartnerInvites.map((inv) => (
                  <div key={inv.id} className="border border-gray-200 rounded-lg p-3">
                    <p className="text-sm text-gray-800">
                      <span className="font-semibold">{inv.requester_name || 'Jogador'}</span> {(t as any).partner?.invitedYouTo || 'convidou-o para o torneio'} <span className="font-semibold">{inv.tournament_name || 'Torneio'}</span>.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleAcceptInvite(inv)} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold">{t.home.accept}</button>
                      <button onClick={() => handleDeclineInvite(inv)} className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-xs font-semibold">{t.home.decline}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {loadingUpcoming ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (() => {
            const enrolledIds = new Set((d?.upcomingTournaments ?? []).map((t) => t.id))
            const tourById = new Map(upcomingFromTour.map((t) => [t.id, t]))
            const enrolledNotInList = (d?.upcomingTournaments ?? []).filter((t) => !tourById.has(t.id))
            const enrolledFromTour = upcomingFromTour.filter((t) => enrolledIds.has(t.id))
            const othersFromTour = upcomingFromTour.filter((t) => !enrolledIds.has(t.id))
            const enrolledMinimal: UpcomingTournamentFromTour[] = enrolledNotInList.map((t) => ({
              id: t.id,
              name: t.name,
              start_date: t.start_date,
              end_date: t.end_date,
              status: t.status || 'active',
              image_url: null,
              description: null,
            }))
            const enrolledList = [
              ...enrolledMinimal.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()),
              ...enrolledFromTour,
            ]
            const openList = othersFromTour
            const TournamentCard = ({ t, isEnrolled }: { t: UpcomingTournamentFromTour; isEnrolled: boolean }) => {
              const count = tourEnrolledCounts.get(t.id) ?? 0
              return (
              <div
                key={t.id}
                className="card overflow-hidden p-0 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => openTournamentDetail(t.id)}
              >
                <div className="relative w-full" style={{ aspectRatio: '4/5' }}>
                  {t.image_url ? (
                    <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-red-100 to-amber-100 flex flex-col items-center justify-center gap-3">
                      <Trophy className="w-16 h-16 text-red-400/70" />
                      <h3 className="font-bold text-gray-700 text-lg text-center px-4 line-clamp-2">{t.name}</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(t.start_date)}
                      </p>
                      {count > 0 && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {count} inscritos
                        </p>
                      )}
                      {t.host_clubs_label && (
                        <p className="text-xs text-gray-600 flex items-center justify-center gap-1 px-4 text-center max-w-full">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="line-clamp-2">{t.host_clubs_label}</span>
                        </p>
                      )}
                    </div>
                  )}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {count > 0 && (
                      <span className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-600 text-white shadow flex items-center gap-1">
                        <Users className="w-3 h-3" />{count}
                      </span>
                    )}
                    {t.is_invited && (
                      <span className="px-2 py-1 rounded-lg text-xs font-medium bg-amber-500 text-white shadow">🔒 Convite</span>
                    )}
                    {isEnrolled && (
                      <span className="px-2 py-1 rounded-lg text-xs font-medium bg-green-500 text-white shadow">Inscrito</span>
                    )}
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium shadow ${t.is_full ? 'bg-red-600 text-white' : t.status === 'active' || t.status === 'in_progress' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
                      {t.is_full ? 'Cheio' : t.status === 'active' || t.status === 'in_progress' ? 'Aberto' : t.status}
                    </span>
                  </div>
                  {t.image_url && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                      <h3 className="font-bold text-white text-sm line-clamp-1 drop-shadow">{t.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-white/80 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(t.start_date)}
                        </p>
                        {count > 0 && (
                          <p className="text-xs text-white/80 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {count} inscritos
                          </p>
                        )}
                      </div>
                      {t.host_clubs_label && (
                        <p className="text-xs text-white/75 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="line-clamp-2">{t.host_clubs_label}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            return (
              <div className="space-y-6">
                {enrolledList.length > 0 ? (
                  <div className="space-y-4">
                    {enrolledList.map((t) => (
                      <TournamentCard key={t.id} t={t} isEnrolled={true} />
                    ))}
                  </div>
                ) : (
                  <div className="card p-8 text-center text-gray-500">
                    {t.common.noTournamentsEnrolled}
                  </div>
                )}

                {/* Torneios Disponíveis */}
                {(() => {
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <span>🎯</span> {t.home.availableTournaments}
                        </h2>
                      </div>
                      <div className="space-y-4">
                        {loadingAvailable ? (
                          <div className="card p-6 text-center">
                            <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
                          </div>
                        ) : availableTournaments.length > 0 ? (
                          availableTournaments.map((tournament) => (
                            <TournamentCard key={tournament.id} t={tournament} isEnrolled={false} />
                          ))
                        ) : (
                          <div className="card p-6 text-center">
                            <span className="text-4xl mb-2 block">🎯</span>
                            <p className="text-gray-700 font-medium">
                              {player?.level != null
                                ? `Nenhum torneio disponível para o teu nível (${(player?.level ?? 0).toFixed(2)})`
                                : 'Nenhum torneio disponível'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">{t.common.checkTourApp}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })()}
        </div>
      )}

      {activeTab === 'leagues' && (() => {
        const getPlayerLeagueCategory = (leagueCategories?: string[]): string | null => {
          if (!leagueCategories || leagueCategories.length === 0) return null

          // Check if categories are level ranges
          const pLevel = player?.level != null ? Number(player.level) : null
          let foundLevel = false
          if (pLevel != null) {
            for (const cat of leagueCategories) {
              const c = cat.trim()
              const plusMatch = c.match(/^[+>]\s*(\d+(?:\.\d+)?)$/)
              if (plusMatch) {
                foundLevel = true
                if (pLevel >= parseFloat(plusMatch[1])) return c
                continue
              }
              const rangeMatch = c.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/)
              if (rangeMatch) {
                foundLevel = true
                const min = parseFloat(rangeMatch[1])
                const max = parseFloat(rangeMatch[2])
                if (pLevel >= min && pLevel <= max) return c
                continue
              }
            }
            if (foundLevel) return null
          }

          // Check if categories are gender-based
          const genderLabels = ['masculino', 'feminino', 'male', 'female', 'masc', 'fem']
          const isGender = leagueCategories.every(c => genderLabels.includes(c.trim().toLowerCase()))
          if (isGender) {
            const playerCat = player?.player_category as string | undefined
            const playerGender = player?.gender as string | undefined
            const isMale = (playerCat && playerCat.startsWith('M')) || playerGender === 'male'
            const isFemale = (playerCat && playerCat.startsWith('F')) || playerGender === 'female'
            for (const cat of leagueCategories) {
              const lower = cat.trim().toLowerCase()
              if (isMale && (lower === 'masculino' || lower === 'male' || lower === 'masc')) return cat
              if (isFemale && (lower === 'feminino' || lower === 'female' || lower === 'fem')) return cat
            }
          }

          return null
        }
        return (
        <div className="space-y-4">
          {leaguesLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
            </div>
          ) : leagueStandings.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Ligas onde participas</h2>
              {[...leagueStandings].sort((a, b) => {
                const aFinished = a.league_status === 'completed' ? 1 : 0
                const bFinished = b.league_status === 'completed' ? 1 : 0
                return aFinished - bFinished
              }).map((s, idx) => {
                const isFinished = s.league_status === 'completed'
                const categoryLabel = getPlayerLeagueCategory(s.league_categories)
                return (
                  <div key={idx} className={`card p-6 flex flex-col items-center justify-center text-center relative ${isFinished ? 'bg-gray-100 border-gray-300 opacity-75' : ''}`}>
                    {isFinished && (
                      <span className="absolute top-3 right-3 bg-gray-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Terminada</span>
                    )}
                    <h3 className={`text-base font-bold ${isFinished ? 'text-gray-500' : 'text-gray-600'}`}>{s.league_name}</h3>
                    {categoryLabel && (
                      <span className={`mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isFinished ? 'bg-gray-200 text-gray-600' : 'bg-red-100 text-red-700'}`}>Nível {categoryLabel}</span>
                    )}
                    <p className="text-2xl mt-3 flex items-center justify-center gap-2">
                      <span className="text-3xl">{isFinished ? '🏁' : '🏆'}</span>
                      <span className={`font-bold text-3xl ${isFinished ? 'text-gray-500' : 'text-red-600'}`}>{s.position}º</span>
                      <span className={`text-xl ${isFinished ? 'text-gray-400' : 'text-gray-600'}`}> de {s.total_participants} · </span>
                      <span className={`font-semibold text-xl ${isFinished ? 'text-gray-600' : 'text-gray-900'}`}>{s.points} pts</span>
                    </p>
                    <button onClick={() => viewLeague(s.league_id, s.league_name)} className={`mt-4 text-base font-semibold flex items-center gap-1 ${isFinished ? 'text-gray-500' : 'text-red-600'}`}>
                      Ver classificação <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Trophy className="w-16 h-16 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">Ainda não participas em nenhuma liga.</p>
              <p className="text-sm text-gray-400 mt-1">{t.common.enrollInTournaments}</p>
            </div>
          )}
        </div>
        )
      })()}

      {activeTab === 'history' && (() => {
        const knockoutRounds = ['quarter', 'semi', 'final', '3rd', 'round_of_16']
        const isKnockoutRound = (round: string) => knockoutRounds.some(k => round.toLowerCase().includes(k))
        const knockoutOrder: Record<string, number> = { 'round_of_16': 0, 'quarter': 1, 'semi': 2, '3rd': 3, 'final': 4 }
        const getKnockoutOrder = (round: string) => {
          const r = round.toLowerCase()
          for (const [key, val] of Object.entries(knockoutOrder)) { if (r.includes(key)) return val }
          return 99
        }
        const knockoutLabel = (round: string) => {
          const r = round.toLowerCase()
          if (r.includes('final') && !r.includes('semi') && !r.includes('quarter')) return 'Final'
          if (r.includes('3rd')) return '3º/4º Lugar'
          if (r.includes('semi')) return 'Meia-final'
          if (r.includes('quarter')) return 'Quartos-de-final'
          if (r.includes('round_of_16')) return 'Oitavos-de-final'
          return round
        }

        const renderCategoryContent = (catDetail: any, myTeamNames: Set<string>) => {
          const groupMap = new Map<string, any[]>()
          catDetail.standings.forEach((row: any) => {
            const gn = row.group_name || 'Geral'
            if (!groupMap.has(gn)) groupMap.set(gn, [])
            groupMap.get(gn)!.push(row)
          })
          const sortedGroups = Array.from(groupMap.keys()).sort()
          const groupMatches = (catDetail.allMatches || []).filter((m: any) => !isKnockoutRound(m.round))
          const knockoutMatches = (catDetail.allMatches || []).filter((m: any) => isKnockoutRound(m.round))
          knockoutMatches.sort((a: any, b: any) => getKnockoutOrder(a.round) - getKnockoutOrder(b.round))

          return (
            <>
              {sortedGroups.map((groupName) => {
                const groupRows = groupMap.get(groupName) || []
                const groupTeamIds = new Set(groupRows.map((r: any) => r.id))
                const matchesForGroup = groupMatches.filter((m: any) => {
                  const r = m.round || ''
                  if (r.includes(groupName) || r === `group_${groupName}` || r === `group ${groupName}`) return true
                  if (groupTeamIds.has(m.team1_id) || groupTeamIds.has(m.team2_id)) return true
                  return false
                })
                return (
                  <div key={groupName} className="mb-3">
                    {sortedGroups.length > 1 && (
                      <p className="text-xs font-bold text-blue-600 mb-1">Grupo {groupName}</p>
                    )}
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm mb-1">
                      <thead>
                        <tr className="text-gray-500 border-b">
                          <th className="py-1 px-1 text-left font-medium w-6">#</th>
                          <th className="py-1 px-1 text-left font-medium min-w-0">Nome</th>
                          <th className="py-1 px-1 text-center font-medium w-6">V</th>
                          <th className="py-1 px-1 text-center font-medium w-6">E</th>
                          <th className="py-1 px-1 text-center font-medium w-6">D</th>
                          <th className="py-1 px-1 text-center font-medium w-8">+/-</th>
                          <th className="py-1 px-1 text-center font-semibold w-8">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupRows.map((row: any, i: number) => {
                          const diff = (row.points_for ?? 0) - (row.points_against ?? 0)
                          const isMe = myTeamNames.has(row.name)
                          return (
                            <tr key={row.id} className={`border-b border-gray-50 ${isMe ? 'bg-red-50 font-semibold' : ''}`}>
                              <td className="py-1 px-1 text-xs">{i + 1}</td>
                              <td className="py-1 px-1 min-w-0">
                                <div className="font-medium break-words text-xs">{row.name}</div>
                                {row.player1_name && <div className="text-[10px] text-gray-500 break-words">{row.player1_name}</div>}
                                {row.player2_name && <div className="text-[10px] text-gray-500 break-words">{row.player2_name}</div>}
                              </td>
                              <td className="py-1 px-1 text-center text-green-600 text-xs">{row.wins}</td>
                              <td className="py-1 px-1 text-center text-yellow-600 text-xs">{row.draws ?? 0}</td>
                              <td className="py-1 px-1 text-center text-red-500 text-xs">{row.losses}</td>
                              <td className={`py-1 px-1 text-center text-[10px] ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>{diff > 0 ? '+' : ''}{diff}</td>
                              <td className="py-1 px-1 text-center font-bold text-xs">{row.points}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    </div>
                    {matchesForGroup.length > 0 && (
                      <div className="space-y-1 mb-1">
                        <p className="text-[10px] font-medium text-gray-400 uppercase">Jogos do Grupo</p>
                        {matchesForGroup.map((m: any) => {
                          const scores = [m.set1, m.set2, m.set3].filter(Boolean).join(' ')
                          return (
                            <div key={m.id} className="flex justify-between items-center text-xs py-1 px-2 bg-gray-50 rounded">
                              <div className="flex-1 min-w-0">
                                <span className="text-gray-700">{m.team1_name}</span>
                                <span className="text-gray-400 mx-1">vs</span>
                                <span className="text-gray-700">{m.team2_name}</span>
                              </div>
                              <span className="font-semibold text-gray-800 ml-2 flex-shrink-0">{scores || '-'}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {knockoutMatches.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-xs font-bold text-orange-600 mb-1">Fase Eliminatória</p>
                  <div className="space-y-1">
                    {knockoutMatches.map((m: any) => {
                      const scores = [m.set1, m.set2, m.set3].filter(Boolean).join(' ')
                      return (
                        <div key={m.id} className="flex justify-between items-center text-xs py-1.5 px-2 bg-orange-50 rounded">
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-orange-500 font-medium mr-1">{knockoutLabel(m.round)}</span>
                            <span className="text-gray-700">{m.team1_name}</span>
                            <span className="text-gray-400 mx-1">vs</span>
                            <span className="text-gray-700">{m.team2_name}</span>
                          </div>
                          <span className="font-semibold text-gray-800 ml-2 flex-shrink-0">{scores || '-'}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )
        }

        const completedTournaments = (d?.pastTournaments || []).filter((t: any) => {
          const isCompleted = t.status === 'completed' || t.status === 'finished'
          const isCanceled = t.status === 'canceled' || t.status === 'cancelled'
          return isCompleted && !isCanceled
        })
        const visibleTournaments = completedTournaments.slice(0, historyVisibleCount)
        const hasMore = completedTournaments.length > historyVisibleCount

        return (
        <div className="space-y-4">
          {pastTournamentLoading && Object.keys(pastTournamentDetails).length === 0 ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : visibleTournaments.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Torneios concluídos ({completedTournaments.length})</p>
              {visibleTournaments.map((t: any) => {
                const details = effectivePastDetails[t.id]
                const wins = details?.myMatches?.filter((m: any) => m.is_winner === true).length ?? 0
                const draws = details?.myMatches?.filter((m: any) => m.is_winner === null).length ?? 0
                const losses = details?.myMatches?.filter((m: any) => m.is_winner === false).length ?? 0
                const hasCats = details?.categoryStandings && Object.keys(details.categoryStandings).length > 0
                const expandedCats = expandedCategories[t.id] || new Set<string>()

                let myCatIds: string[] = []
                let otherCatIds: string[] = []
                if (hasCats) {
                  Object.entries(details.categoryStandings).forEach(([catId, catDetail]: [string, any]) => {
                    if (catDetail.myMatches && catDetail.myMatches.length > 0) {
                      myCatIds.push(catId)
                    } else {
                      otherCatIds.push(catId)
                    }
                  })
                }

                return (
                  <div key={t.id} className="card overflow-hidden p-0">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{t.name}</h3>
                          <p className="text-sm text-gray-500 mt-0.5">{formatDate(t.start_date)}</p>
                          {details && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {details.playerPosition != null && !hasCats && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-medium">
                                  <Trophy className="w-3.5 h-3.5" /> {details.playerPosition}º lugar
                                </span>
                              )}
                              {(wins > 0 || draws > 0 || losses > 0) && (
                                <span className="inline-flex items-center px-2 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium">
                                  {wins}V{draws > 0 ? ` ${draws}E` : ''} {losses}D
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {!details && (
                          <span className="text-xs text-gray-400 animate-pulse flex-shrink-0">A carregar...</span>
                        )}
                      </div>

                      {hasCats ? (
                        <>
                          {myCatIds.map((catId) => {
                            const catDetail = details.categoryStandings[catId]
                            const myTeamNames = new Set<string>()
                            catDetail.myMatches.forEach((m: any) => {
                              myTeamNames.add(m.team1_name)
                              myTeamNames.add(m.team2_name)
                            })
                            return (
                              <div key={catId} className="mt-4 pt-4 border-t border-gray-200">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-purple-100 text-purple-800 text-xs font-bold">
                                    {catDetail.categoryName}
                                  </span>
                                  {catDetail.playerPosition != null && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-medium">
                                      <Trophy className="w-3 h-3" /> {catDetail.playerPosition}º
                                    </span>
                                  )}
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-medium">A tua categoria</span>
                                </div>
                                {renderCategoryContent(catDetail, myTeamNames)}
                              </div>
                            )
                          })}

                          {otherCatIds.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <p className="text-[10px] font-medium text-gray-400 uppercase mb-2">Outras categorias</p>
                              <div className="space-y-2">
                                {otherCatIds.map((catId) => {
                                  const catDetail = details.categoryStandings[catId]
                                  const isExpanded = expandedCats.has(catId)
                                  return (
                                    <div key={catId} className="border border-gray-200 rounded-lg overflow-hidden">
                                      <button
                                        onClick={() => toggleCategoryExpanded(t.id, catId)}
                                        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs font-bold">
                                            {catDetail.categoryName}
                                          </span>
                                          <span className="text-xs text-gray-500">{catDetail.standings.length} equipas · {(catDetail.allMatches || []).length} jogos</span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                      </button>
                                      {isExpanded && (
                                        <div className="p-3">
                                          {renderCategoryContent(catDetail, new Set<string>())}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {details?.myMatches && details.myMatches.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <p className="text-xs font-medium text-gray-500 mb-2">Os teus resultados</p>
                              <div className="space-y-2">
                                {details.myMatches.map((m: any) => {
                                  const setScores = [m.set1, m.set2, m.set3].filter(Boolean)
                                  const scoreDisplay = setScores.length > 0 ? setScores.join(' ') : '-'
                                  const team1Won = m.team1_score !== undefined && m.team2_score !== undefined && m.team1_score > m.team2_score
                                  return (
                                    <div key={m.id} className="flex justify-between items-start text-sm py-2 px-3 bg-gray-50 rounded-lg">
                                      <div className="flex-1 mr-2 min-w-0">
                                        <div className={`text-gray-700 ${team1Won ? 'font-semibold' : ''}`}>{m.team1_name}</div>
                                        <div className={`text-gray-700 mt-1 ${!team1Won && m.team1_score !== undefined && m.team2_score !== undefined ? 'font-semibold' : ''}`}>{m.team2_name}</div>
                                      </div>
                                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <span className="font-semibold text-gray-900">{scoreDisplay}</span>
                                        {m.is_winner !== undefined && m.is_winner !== null && (
                                          <span className={`text-xs font-medium ${m.is_winner ? 'text-green-600' : 'text-red-600'}`}>{m.is_winner ? 'V' : 'D'}</span>
                                        )}
                                        {m.is_winner === null && (
                                          <span className="text-xs font-medium text-amber-600">E</span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {details?.standings && details.standings.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <p className="text-xs font-medium text-gray-500 mb-2">Classificação final</p>
                              <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-gray-500 border-b">
                                    <th className="py-1.5 px-2 text-left font-medium w-8">#</th>
                                    <th className="py-1.5 px-2 text-left font-medium min-w-0">Nome</th>
                                    <th className="py-1.5 px-1 text-center font-medium w-8">V</th>
                                    <th className="py-1.5 px-1 text-center font-medium w-8">E</th>
                                    <th className="py-1.5 px-1 text-center font-medium w-8">D</th>
                                    <th className="py-1.5 px-1 text-center font-medium w-10">+/-</th>
                                    <th className="py-1.5 px-1 text-center font-semibold w-10">Pts</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {details.standings.map((row: any, i: number) => {
                                    const diff = (row.points_for ?? 0) - (row.points_against ?? 0)
                                    return (
                                      <tr key={row.id} className={`border-b border-gray-50 ${details.playerPosition === i + 1 ? 'bg-red-50 font-semibold' : ''}`}>
                                        <td className="py-1.5 px-2">{i + 1}</td>
                                        <td className="py-1.5 px-2 min-w-0">
                                          <div className="font-medium break-words">{row.name}</div>
                                          {row.player1_name && <div className="text-xs text-gray-500 break-words">{row.player1_name}</div>}
                                          {row.player2_name && <div className="text-xs text-gray-500 break-words">{row.player2_name}</div>}
                                        </td>
                                        <td className="py-1.5 px-1 text-center text-green-600">{row.wins}</td>
                                        <td className="py-1.5 px-1 text-center text-yellow-600">{row.draws ?? 0}</td>
                                        <td className="py-1.5 px-1 text-center text-red-500">{row.losses}</td>
                                        <td className={`py-1.5 px-1 text-center text-xs ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>{diff > 0 ? '+' : ''}{diff}</td>
                                        <td className="py-1.5 px-1 text-center font-bold">{row.points}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}

              {hasMore && (
                <button
                  onClick={() => setHistoryVisibleCount(prev => prev + 5)}
                  className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  Ver mais torneios ({completedTournaments.length - historyVisibleCount} restantes)
                  <ChevronDown className="w-4 h-4" />
                </button>
              )}

              {pastTournamentLoading && Object.keys(pastTournamentDetails).length > 0 && (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Trophy className="w-16 h-16 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">Ainda não tens torneios concluídos.</p>
              <p className="text-sm text-gray-400 mt-1">Os torneios em que participares aparecerão aqui.</p>
            </div>
          )}
          {openGameHistoryLoading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : openGameHistory.length > 0 && (
            <div className="space-y-4">
              {openGameHistory.map((game) => {
                const setScores = [game.set1, game.set2, game.set3].filter(Boolean)
                const scoreDisplay = setScores.length > 0 ? setScores.join(' ') : '-'
                const gameDate = new Date(game.start_time)
                const dateStr = gameDate.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
                const timeStr = gameDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
                const team1Won = game.score1 != null && game.score2 != null && game.score1 > game.score2
                
                const getAvatar = (avatar: string | null | undefined, name: string) => {
                  if (avatar) return avatar
                  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&size=64&bold=true`
                }
                
                const p1Avatar = getAvatar((game as any).player1_avatar, game.player1_name)
                const p2Avatar = getAvatar((game as any).player2_avatar, game.player2_name)
                const p3Avatar = getAvatar((game as any).player3_avatar, game.player3_name)
                const p4Avatar = getAvatar((game as any).player4_avatar, game.player4_name)
                
                return (
                  <div key={game.id} className="card overflow-hidden p-0">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{dateStr}</span>
                          <span>·</span>
                          <span>{timeStr}</span>
                          {game.club_name && (
                            <>
                              <span>·</span>
                              <span className="font-medium text-gray-700">{game.club_name}</span>
                            </>
                          )}
                        </div>
                        {game.is_winner === true && (
                          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
                            Vitória
                          </span>
                        )}
                        {game.is_winner === false && (
                          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">
                            Derrota
                          </span>
                        )}
                        {game.is_winner === null && (
                          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                            Empate
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        <div className={`flex items-center justify-between p-3 rounded-lg ${team1Won ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="flex -space-x-2 flex-shrink-0">
                              <img src={p1Avatar} alt={game.player1_name} className="w-8 h-8 rounded-full border-2 border-white object-cover" />
                              <img src={p2Avatar} alt={game.player2_name} className="w-8 h-8 rounded-full border-2 border-white object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className={`text-sm ${team1Won ? 'font-semibold text-green-900' : 'text-gray-700'}`}>
                                {game.team1_name}
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            <span className={`text-sm font-semibold ${team1Won ? 'text-green-700' : 'text-gray-900'}`}>
                              {game.score1}
                            </span>
                          </div>
                        </div>
                        
                        <div className={`flex items-center justify-between p-3 rounded-lg ${!team1Won && game.score1 != null && game.score2 != null ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="flex -space-x-2 flex-shrink-0">
                              <img src={p3Avatar} alt={game.player3_name} className="w-8 h-8 rounded-full border-2 border-white object-cover" />
                              <img src={p4Avatar} alt={game.player4_name} className="w-8 h-8 rounded-full border-2 border-white object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className={`text-sm ${!team1Won && game.score1 != null && game.score2 != null ? 'font-semibold text-green-900' : 'text-gray-700'}`}>
                                {game.team2_name}
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            <span className={`text-sm font-semibold ${!team1Won && game.score1 != null && game.score2 != null ? 'text-green-700' : 'text-gray-900'}`}>
                              {game.score2}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {setScores.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="font-medium">Sets:</span>
                            <span>{scoreDisplay}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        )
      })()}

      {/* Modal classificação da Liga */}
      {viewingLeague && (() => {
        const allTabs = [
          { key: 'geral', label: 'Geral' },
          ...(leagueCategories || []).map((c) => ({ key: c.category_name, label: c.category_name })),
        ]
        const hasTabs = leagueCategories.length > 0
        const activeLeagueTab = leagueCategoryTab || 'geral'
        const displayStandings = activeLeagueTab === 'geral'
          ? leagueFull
          : leagueCategories.find((c) => c.category_name === activeLeagueTab)?.standings || []

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex flex-col" onClick={() => { setViewingLeague(null); setLeagueCategories([]); setLeagueCategoryTab('') }}>
            <div
              className="bg-white mt-auto sm:mt-12 sm:mx-auto sm:max-w-lg w-full rounded-t-2xl sm:rounded-xl max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
                <h2 className="text-xl font-bold truncate mr-2">{viewingLeague.name}</h2>
                <button onClick={() => { setViewingLeague(null); setLeagueCategories([]); setLeagueCategoryTab('') }} className="text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0">✕</button>
              </div>

              {/* Tabs de categorias */}
              {hasTabs && (
                <div className="flex gap-1 p-2 bg-gray-50 border-b overflow-x-auto flex-shrink-0">
                  {allTabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setLeagueCategoryTab(tab.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                        activeLeagueTab === tab.key ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Conteúdo */}
              <div className="overflow-y-auto flex-1">
                {leagueLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : displayStandings.length > 0 ? (
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-left text-sm font-semibold text-gray-700 w-10">#</th>
                        <th className="px-2 py-2 text-left text-sm font-semibold text-gray-700">Nome</th>
                        <th className="px-2 py-2 text-center text-sm font-semibold text-gray-700 w-14">Pts</th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 w-12">Jogos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayStandings.map((row) => (
                        <tr key={row.position} className={`border-t border-gray-100 ${row.is_current_player ? 'bg-red-100 ring-2 ring-red-200' : ''}`}>
                          <td className={`px-2 py-2 text-sm ${row.is_current_player ? 'font-bold text-red-600' : 'text-gray-500'}`}>{row.position}</td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-gray-200 flex items-center justify-center">
                                {(row.avatar_url || getCachedPlayerData(row.entity_name)?.avatar_url) ? (
                                  <img src={row.avatar_url || getCachedPlayerData(row.entity_name)?.avatar_url || ''} alt={row.entity_name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xs font-bold text-gray-500">{row.entity_name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="truncate max-w-[140px]">
                                <span className={row.is_current_player ? 'font-bold text-gray-900 text-base' : 'font-medium'}>{row.entity_name}</span>
                                {row.is_current_player && <span className="ml-1 text-xs bg-red-600 text-white px-1.5 py-0.5 rounded font-semibold">Tu</span>}
                              </div>
                            </div>
                          </td>
                          <td className={`px-2 py-2 text-center font-bold ${row.is_current_player ? 'text-red-600 text-base' : ''}`}>{row.total_points}</td>
                          <td className={`px-2 py-2 text-center text-sm ${row.is_current_player ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{row.tournaments_played}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">Sem dados de classificação.</p>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal Inscritos por categoria */}
      {viewingEnrolled && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">{viewingEnrolled.name}</h2>
              <button onClick={() => { setViewingEnrolled(null); setEnrolledData([]) }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="overflow-y-auto max-h-[70vh] p-4">
              {enrolledLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : enrolledData.length === 0 ? (
                <p className="text-gray-500 text-center py-6">Sem inscritos ou categorias.</p>
              ) : (
                <div className="space-y-6">
                  {enrolledData.map((cat) => (
                    <div key={cat.category_id}>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        {cat.category_name}
                      </h3>
                      <ul className="space-y-1.5">
                        {cat.items.map((item, idx) => (
                          <li key={item.id}>
                            <EnrolledItemRow
                              item={item}
                              index={idx}
                              onPlayerClick={handleEnrolledPlayerClick}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewingTournament && tournamentDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold">{tournamentDetail.name}</h2>
                <button onClick={() => { setViewingTournament(null); setTournamentDetail(null) }} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDetailTab('standings')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${detailTab === 'standings' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Classificação</button>
                <button onClick={() => setDetailTab('matches')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${detailTab === 'matches' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Os Meus Jogos ({tournamentDetail.myMatches.length})</button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[70vh]">
              {detailTab === 'standings' && (
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-1.5 py-2 text-left text-xs w-8">#</th>
                      <th className="px-1.5 py-2 text-left text-xs">Nome</th>
                      <th className="px-1 py-2 text-center text-xs w-8">V</th>
                      <th className="px-1 py-2 text-center text-xs w-8">E</th>
                      <th className="px-1 py-2 text-center text-xs w-8">D</th>
                      <th className="px-1 py-2 text-center text-xs w-10">+/-</th>
                      <th className="px-1.5 py-2 text-center text-xs font-semibold w-10">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournamentDetail.standings.map((row, i) => {
                      const diff = (row.points_for ?? 0) - (row.points_against ?? 0)
                      const hasPlayers = row.player1_name || row.player2_name
                      return (
                        <tr key={row.id} className="border-t">
                          <td className="px-1.5 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-1.5 py-2">
                            <div className="font-medium truncate max-w-[120px]">{row.name}</div>
                            {hasPlayers && (
                              <div className="text-xs text-gray-500 truncate max-w-[120px]">
                                {[row.player1_name, row.player2_name].filter(Boolean).join(' / ')}
                              </div>
                            )}
                          </td>
                          <td className="px-1 py-2 text-center text-green-600">{row.wins ?? 0}</td>
                          <td className="px-1 py-2 text-center text-yellow-600">{row.draws ?? 0}</td>
                          <td className="px-1 py-2 text-center text-red-500">{row.losses ?? 0}</td>
                          <td className={`px-1 py-2 text-center text-xs ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>{diff > 0 ? '+' : ''}{diff}</td>
                          <td className="px-1.5 py-2 text-center font-bold">{row.points}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              )}
              {detailTab === 'matches' && (
                <div className="divide-y">
                  {tournamentDetail.myMatches.length === 0 ? <div className="p-6 text-center text-gray-500">Sem jogos registados</div> : tournamentDetail.myMatches.map((m) => {
                    const setScores = [m.set1, m.set2, m.set3].filter(Boolean)
                    // Mostrar sempre os jogos de cada set, nunca o resultado 1-0/0-1
                    const scoreDisplay = setScores.length > 0 ? setScores.join(' ') : '-'
                    return (
                    <div key={m.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div><p className="font-medium text-gray-900">{m.team1_name}</p><p className="text-sm text-gray-500">vs</p><p className="font-medium text-gray-900">{m.team2_name}</p></div>
                        <div className="text-right">
                          {m.status === 'completed' ? <span className="text-lg font-bold">{scoreDisplay}</span> : <span className="text-sm text-gray-500">{formatDateTime(m.scheduled_time)}</span>}
                          {m.is_winner === true && <span className="block text-xs mt-1 text-green-600">{t.common.victory}</span>}
                          {m.is_winner === false && <span className="block text-xs mt-1 text-red-600">{t.common.defeat}</span>}
                          {m.is_winner === null && <span className="block text-xs mt-1 text-amber-600">Empate</span>}
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {playerPreviewModal}

    </div>
    </>
  )
}

