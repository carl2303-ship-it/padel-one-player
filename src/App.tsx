import { useState, useEffect } from 'react'
import { supabase, PlayerAccount, PLAYER_CATEGORIES } from './lib/supabase'
import {
  fetchPlayerDashboardData,
  type PlayerDashboardData,
} from './lib/playerDashboardData'
import { 
  Home, 
  Trophy, 
  Calendar, 
  User, 
  ChevronRight,
  Clock,
  MapPin,
  TrendingUp,
  Target,
  Award,
  Bell,
  Search,
  Plus,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Settings,
  Edit2,
  Camera,
  Building2,
  Gamepad2,
  ArrowLeft,
  Phone,
  Mail,
  Globe,
  GraduationCap,
  Users,
  ExternalLink,
  Save,
  X,
  ChevronDown
} from 'lucide-react'
import { fetchAllClubs, fetchClubById, fetchUpcomingTournaments, fetchEnrolledByCategory, getTournamentRegistrationUrl, type ClubDetail, type UpcomingTournamentFromTour, type EnrolledByCategory } from './lib/clubAndTournaments'

type Screen = 'home' | 'games' | 'profile' | 'club' | 'compete'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [player, setPlayer] = useState<PlayerAccount | null>(null)
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [isLoading, setIsLoading] = useState(true)
  
  // Auth states
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [isAuthLoading, setIsAuthLoading] = useState(false)

  // Dashboard data (mesma fonte que Padel One Tour – dados nos dois lados)
  const [dashboardData, setDashboardData] = useState<PlayerDashboardData | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    setIsLoading(true)
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      const { data: playerAccount } = await supabase
        .from('player_accounts')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (playerAccount) {
        setPlayer(playerAccount as any)
        setIsAuthenticated(true)
        const data = await fetchPlayerDashboardData(session.user.id)
        setDashboardData(data)
        setIsLoading(false)
        return
      }
    }

    const savedPhone = localStorage.getItem('padel_one_player_phone')
    if (savedPhone) {
      const { data } = await supabase
        .from('player_accounts')
        .select('*')
        .eq('phone_number', savedPhone)
        .maybeSingle()

      if (data) {
        setPlayer(data as any)
        setIsAuthenticated(true)
        if (data.user_id) {
          const dash = await fetchPlayerDashboardData(data.user_id)
          setDashboardData(dash)
        }
      }
    }
    setIsLoading(false)
  }

  const refreshDashboard = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const data = await fetchPlayerDashboardData(session.user.id)
      setDashboardData(data)
    }
  }

  const handleSaveFavoriteClub = async (clubId: string | null) => {
    if (!player?.id) return
    const { data: updated } = await supabase
      .from('player_accounts')
      .update({ favorite_club_id: clubId })
      .eq('id', player.id)
      .select()
      .single()
    if (updated) {
      setPlayer({ ...player, ...updated } as any)
    }
    if (clubId !== null && clubId !== undefined) {
      localStorage.setItem('padel_one_player_favorite_club_id', clubId)
    } else {
      localStorage.removeItem('padel_one_player_favorite_club_id')
    }
  }

  const handleSaveProfile = async (updates: Partial<PlayerAccount>) => {
    if (!player?.id) return
    const { data: updated, error } = await supabase
      .from('player_accounts')
      .update(updates)
      .eq('id', player.id)
      .select()
      .single()
    if (error) {
      console.error('[PROFILE] Erro ao guardar perfil:', error)
      throw error
    }
    if (updated) {
      setPlayer({ ...player, ...updated } as any)
    }
  }

  const handleLogin = async () => {
    setAuthError('')
    setIsAuthLoading(true)

    try {
      let playerAccount: any = null

      // Login via telefone - usa Edge Function como o Tour
      let normalizedPhone = phone.trim().replace(/\s+/g, '')
      if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = '+351' + normalizedPhone
      }

      console.log('[LOGIN] Procurando telefone via Edge Function:', normalizedPhone)

      // Chamar Edge Function para obter o email (usa Service Role Key, ignora RLS)
      const response = await fetch(
        'https://rqiwnxcexsccguruiteq.supabase.co/functions/v1/get-player-login-email',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxaXdueGNleHNjY2d1cnVpdGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3Njc5MzcsImV4cCI6MjA3NTM0MzkzN30.Dl05zPQDtPVpmvn_Y-JokT3wDq0Oh9uF3op5xcHZpkY',
          },
          body: JSON.stringify({ phone_number: normalizedPhone }),
        }
      )

      const emailData = await response.json()
      console.log('[LOGIN] Resposta da Edge Function:', emailData)

      if (!response.ok || !emailData?.success || !emailData?.email) {
        if (emailData?.error === 'Player account not found') {
          setAuthError('Telefone não encontrado')
        } else if (emailData?.error === 'Player account has no email') {
          setAuthError('Conta sem email associado. Contacta o organizador.')
        } else {
          setAuthError(emailData?.error || 'Erro ao verificar telefone')
        }
        setIsAuthLoading(false)
        return
      }

      const emailToUse = emailData.email
      console.log('[LOGIN] Email obtido:', emailToUse)

      // Fazer login com Supabase Auth
      const { error: authError, data: authData } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: password,
      })

      if (authError) {
        console.log('[LOGIN] Erro de auth:', authError)
        if (authError.message.includes('Invalid login')) {
          setAuthError('Password incorreta')
        } else {
          setAuthError('Erro ao fazer login: ' + authError.message)
        }
        setIsAuthLoading(false)
        return
      }

      console.log('[LOGIN] Login com sucesso! User:', authData?.user?.id)

      // Buscar player_account agora que estamos autenticados
      if (authData?.user) {
        const { data: account } = await supabase
          .from('player_accounts')
          .select('*')
          .eq('user_id', authData.user.id)
          .maybeSingle()
        
        playerAccount = account
        console.log('[LOGIN] Player account:', playerAccount)
      }

      localStorage.setItem('padel_one_player_phone', normalizedPhone)

      if (playerAccount) {
        setPlayer(playerAccount as any)
        if (authData?.user) {
          const data = await fetchPlayerDashboardData(authData.user.id)
          setDashboardData(data)
        }
      }
      setIsAuthenticated(true)
    } catch (err) {
      console.error('Login error:', err)
      setAuthError('Erro ao fazer login')
    }
    
    setIsAuthLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('padel_one_player_phone')
    setPlayer(null)
    setIsAuthenticated(false)
    setPhone('')
    setPassword('')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">A carregar...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen 
      phone={phone}
      setPhone={setPhone}
      password={password}
      setPassword={setPassword}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      error={authError}
      isLoading={isAuthLoading}
      onLogin={handleLogin}
    />
  }

  const displayName = dashboardData?.playerName || player?.name?.split(' ')[0] || 'Jogador'

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-light">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/icon.png" 
              alt="Padel One" 
              className="w-10 h-10 rounded-xl shadow-sm"
            />
            <div>
              <p className="text-xs text-gray-500">Olá,</p>
              <p className="font-semibold text-gray-900">{displayName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full"></span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4">
        {currentScreen === 'home' && (
          <HomeScreen
            player={player}
            dashboardData={dashboardData}
            onRefresh={refreshDashboard}
            onOpenClub={() => setCurrentScreen('club')}
            onOpenCompete={() => setCurrentScreen('compete')}
            onOpenGames={() => setCurrentScreen('games')}
          />
        )}
        {currentScreen === 'games' && (
          <GamesScreen
            player={player}
            dashboardData={dashboardData}
            onRefresh={refreshDashboard}
          />
        )}
        {currentScreen === 'club' && (
          <ClubScreen
            favoriteClubId={player?.favorite_club_id ?? null}
            onBack={() => setCurrentScreen('home')}
          />
        )}
        {currentScreen === 'compete' && (
          <CompeteScreen
            dashboardData={dashboardData}
            favoriteClubId={player?.favorite_club_id ?? null}
            userId={player?.user_id ?? null}
            playerAccountId={player?.id ?? null}
            onBack={() => setCurrentScreen('home')}
          />
        )}
        {currentScreen === 'profile' && (
          <ProfileScreen
            player={player}
            onLogout={handleLogout}
            onSaveFavoriteClub={handleSaveFavoriteClub}
            onSaveProfile={handleSaveProfile}
          />
        )}
      </main>

      {/* Bottom Navigation - 3 items like Playtomic */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom z-50">
        <div className="flex items-center justify-around py-2">
          <NavItem 
            icon={Home} 
            label="Início" 
            active={currentScreen === 'home'} 
            onClick={() => setCurrentScreen('home')} 
          />
          <NavItem 
            icon={Trophy} 
            label="Jogos" 
            active={currentScreen === 'games'} 
            onClick={() => setCurrentScreen('games')} 
          />
          <NavItem 
            icon={User} 
            label="Perfil" 
            active={currentScreen === 'profile'} 
            onClick={() => setCurrentScreen('profile')} 
          />
        </div>
      </nav>
    </div>
  )
}

// ==================== COMPONENTS ====================

function NavItem({ icon: Icon, label, active, onClick }: {
  icon: any
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center px-6 py-2 rounded-lg transition-all ${
        active 
          ? 'text-red-600' 
          : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <Icon className={`w-6 h-6 ${active ? 'stroke-[2.5]' : ''}`} />
      <span className={`text-xs mt-1 ${active ? 'font-semibold' : ''}`}>{label}</span>
    </button>
  )
}

function LoginScreen({ phone, setPhone, password, setPassword, showPassword, setShowPassword, error, isLoading, onLogin }: {
  phone: string
  setPhone: (v: string) => void
  password: string
  setPassword: (v: string) => void
  showPassword: boolean
  setShowPassword: (v: boolean) => void
  error: string
  isLoading: boolean
  onLogin: () => void
}) {

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo */}
        <div className="mb-8 animate-fade-in">
          <img 
            src="/icon.png" 
            alt="Padel One" 
            className="w-24 h-24 rounded-3xl shadow-xl"
          />
        </div>

        {/* Title */}
        <div className="text-center mb-10 animate-slide-up">
          <h1 className="text-4xl font-black text-gray-900 mb-2">
            PADEL <span className="text-red-600">ONE</span>
          </h1>
          <p className="text-gray-500">A tua app de Padel</p>
        </div>

        {/* Login Form */}
        <div className="w-full max-w-sm space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="relative">
            <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              placeholder="Número de telemóvel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onLogin()}
              className="w-full pl-12 pr-12 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <button
            onClick={onLogin}
            disabled={isLoading || !phone || !password}
            className="w-full py-4 btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Entrar
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>

          <p className="text-center text-gray-500 text-sm">
            Introduz o teu número de telemóvel e password
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="px-6 pb-8">
        <div className="grid grid-cols-3 gap-3">
          <FeatureCard icon={Trophy} label="Torneios" />
          <FeatureCard icon={Calendar} label="Reservas" />
          <FeatureCard icon={TrendingUp} label="Rankings" />
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <div className="card p-3 text-center">
      <Icon className="w-6 h-6 text-red-600 mx-auto mb-1" />
      <p className="text-xs text-gray-600">{label}</p>
    </div>
  )
}

function formatDate(s: string) {
  const d = new Date(s)
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}
function formatDateTime(s: string) {
  const d = new Date(s)
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function formatDateWithTime(s: string) {
  const d = new Date(s)
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${date} | ${time}`
}
function parseTeamMembers(teamName: string): string[] {
  if (!teamName?.trim()) return ['?']
  const parts = teamName.split(/\s*\/\s*|\s*&\s*|,/).map((s) => s.trim()).filter(Boolean)
  return parts.length >= 1 ? parts.slice(0, 2) : ['?']
}
function initialFor(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase().slice(0, 2)
  return t.slice(0, 2).toUpperCase()
}

// Tipos para os dados integrados do Tour (PlayerMatch = formato do dashboardData)
type PlayerMatchForCard = import('./lib/playerDashboardData').PlayerMatch
type TournamentForCard = import('./lib/playerDashboardData').TournamentSummary

function ActionButton({ icon: Icon, label, color, onClick, emoji }: {
  icon: any
  label: string
  color: 'lime' | 'blue' | 'amber' | 'purple' | 'emerald'
  onClick?: () => void
  emoji?: string
}) {
  const colorClasses = {
    lime: 'bg-lime-400',
    blue: 'bg-blue-400',
    amber: 'bg-amber-400',
    purple: 'bg-purple-400',
    emerald: 'bg-emerald-400'
  }
  return (
    <button type="button" onClick={onClick} className="action-btn">
      <div className={`action-btn-icon ${colorClasses[color]} flex items-center justify-center`}>
        {emoji ? <span className="text-2xl">{emoji}</span> : <Icon className="w-6 h-6 text-white" />}
      </div>
      <span className="text-xs font-medium text-gray-700">{label}</span>
    </button>
  )
}

function MatchCard({ match }: { match: PlayerMatchForCard }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900">{match.tournament_name}</p>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {match.start_time ? formatDate(match.start_time) : '-'}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              Campo {match.court || '-'}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{match.team1_name} vs {match.team2_name}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </div>
  )
}

/** Parseia "6-2" em [6, 2] para exibir sets ao estilo Playtomic */
function parseSetScores(setStr: string): [string, string] | null {
  if (!setStr?.includes('-')) return null
  const [a, b] = setStr.split('-').map((s) => s.trim())
  return a != null && b != null ? [a, b] : null
}

/** Garante 2 jogadores por equipa (padel = 4 jogadores). Fallback quando não há player1_name..player4_name. */
function twoPlayersPerTeam(teamName: string): [string, string] {
  const members = parseTeamMembers(teamName)
  const a = members[0] || '?'
  const b = members[1] || '?'
  return [a, b]
}

/** Card ao estilo Playtomic: layout vertical – equipa 1 em cima, resultado no meio, equipa 2 em baixo; nomes abaixo de cada bolinha; troféu ao lado do resultado da equipa vencedora */
function GameCardPlaytomic({ match, fullWidth }: { match: PlayerMatchForCard; fullWidth?: boolean }) {
  const p1 = match.player1_name ?? twoPlayersPerTeam(match.team1_name)[0]
  const p2 = match.player2_name ?? twoPlayersPerTeam(match.team1_name)[1]
  const p3 = match.player3_name ?? twoPlayersPerTeam(match.team2_name)[0]
  const p4 = match.player4_name ?? twoPlayersPerTeam(match.team2_name)[1]
  const setStrings = [match.set1, match.set2, match.set3].filter(Boolean) as string[]
  const parsedSets = setStrings.map(parseSetScores)
  const hasSets = parsedSets.some(Boolean)
  const isTournament = Boolean(match.tournament_id && match.tournament_name)
  const team1Scores = parsedSets.map((p) => (p ? p[0] : '-'))
  const team2Scores = parsedSets.map((p) => (p ? p[1] : '-'))
  const team1Won = match.status === 'completed' && match.score1 != null && match.score2 != null && match.score1 > match.score2
  const team2Won = match.status === 'completed' && match.score1 != null && match.score2 != null && match.score2 > match.score1

  return (
    <div className={`rounded-2xl bg-white border border-gray-100 shadow-md overflow-hidden ${fullWidth ? 'w-full' : 'flex-shrink-0 w-[280px] sm:w-[300px]'}`}>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-medium text-gray-500">
            {match.start_time ? formatDateWithTime(match.start_time) : '-'}
          </span>
          {isTournament && (
            <span className="flex items-center gap-1 text-amber-600" title={match.tournament_name}>
              <Trophy className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium truncate max-w-[120px]">{match.tournament_name}</span>
            </span>
          )}
        </div>

        {/* Layout: grid 2x2 bolinhas alinhadas no topo; resultados à direita; linha fina divide equipas */}
        <div className="flex flex-col">
          {/* Equipa 1 – laranja */}
          <div className="flex items-start justify-between gap-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-0 w-[120px] flex-shrink-0 items-start">
              <div className="flex flex-col items-center min-h-[52px]">
                <div className="w-11 h-11 rounded-full bg-orange-400 flex items-center justify-center text-xl font-bold text-white shadow-sm flex-shrink-0" title={p1}>
                  {initialFor(p1)}
                </div>
                <span className="text-[10px] text-gray-600 truncate max-w-[60px] mt-0.5 text-center line-clamp-2 min-h-[24px]" title={p1}>{p1}</span>
              </div>
              <div className="flex flex-col items-center min-h-[52px]">
                <div className="w-11 h-11 rounded-full bg-orange-400 flex items-center justify-center text-xl font-bold text-white shadow-sm flex-shrink-0" title={p2}>
                  {initialFor(p2)}
                </div>
                <span className="text-[10px] text-gray-600 truncate max-w-[60px] mt-0.5 text-center line-clamp-2 min-h-[24px]" title={p2}>{p2}</span>
              </div>
            </div>
            {match.status === 'completed' && (hasSets || match.score1 != null) && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {team1Won && (
                  <span className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-sm flex-shrink-0" title="Equipa vencedora">🏆</span>
                )}
                <span className={team1Won ? 'text-2xl font-bold text-gray-900' : 'text-2xl font-medium text-gray-400'}>
                  {hasSets ? team1Scores.join(' ') : match.score1}
                </span>
              </div>
            )}
          </div>

          {/* Linha fina a dividir equipa 1 da equipa 2 */}
          <div className="border-t border-gray-200/60 my-2" />

          {/* Equipa 2 – azul claro (grid igual para alinhar com equipa 1) */}
          <div className="flex items-start justify-between gap-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-0 w-[120px] flex-shrink-0 items-start">
              <div className="flex flex-col items-center min-h-[52px]">
                <div className="w-11 h-11 rounded-full bg-sky-200 flex items-center justify-center text-xl font-bold text-sky-800 shadow-sm flex-shrink-0" title={p3}>
                  {initialFor(p3)}
                </div>
                <span className="text-[10px] text-gray-600 truncate max-w-[60px] mt-0.5 text-center line-clamp-2 min-h-[24px]" title={p3}>{p3}</span>
              </div>
              <div className="flex flex-col items-center min-h-[52px]">
                <div className="w-11 h-11 rounded-full bg-sky-200 flex items-center justify-center text-xl font-bold text-sky-800 shadow-sm flex-shrink-0" title={p4}>
                  {initialFor(p4)}
                </div>
                <span className="text-[10px] text-gray-600 truncate max-w-[60px] mt-0.5 text-center line-clamp-2 min-h-[24px]" title={p4}>{p4}</span>
              </div>
            </div>
            {match.status === 'completed' && (hasSets || match.score1 != null) && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {team2Won && (
                  <span className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-sm flex-shrink-0" title="Equipa vencedora">🏆</span>
                )}
                <span className={team2Won ? 'text-2xl font-bold text-gray-900' : 'text-2xl font-medium text-gray-400'}>
                  {hasSets ? team2Scores.join(' ') : match.score2}
                </span>
              </div>
            )}
          </div>

          {/* Para jogos por jogar: hora/court centrado se não há resultados */}
          {match.status !== 'completed' && (
            <div className="text-xs text-gray-500 text-center mt-1">
              {match.start_time ? formatDateWithTime(match.start_time).split(' | ')[1] : ''}
              {match.court ? ` · C.${match.court}` : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TournamentCard({
  tournament,
  onViewStandings,
}: {
  tournament: TournamentForCard
  onViewStandings?: () => void
}) {
  return (
    <div className="card overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 line-clamp-1">{tournament.name}</h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(tournament.start_date)}
              </span>
              {tournament.enrolled_count !== undefined && (
                <span className="text-xs text-red-600">{tournament.enrolled_count} inscritos</span>
              )}
            </div>
          </div>
          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
            tournament.status === 'active' || tournament.status === 'in_progress'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {tournament.status === 'active' || tournament.status === 'in_progress' ? 'Em curso' : tournament.status}
          </span>
        </div>
        {onViewStandings && (
          <button onClick={onViewStandings} className="w-full mt-3 py-2 btn-secondary text-sm font-medium">
            Ver classificação
          </button>
        )}
      </div>
    </div>
  )
}

function HomeScreen({
  player,
  dashboardData,
  onRefresh,
  onOpenClub,
  onOpenCompete,
  onOpenGames,
}: {
  player: PlayerAccount | null
  dashboardData: PlayerDashboardData | null
  onRefresh: () => Promise<void>
  onOpenClub: () => void
  onOpenCompete: () => void
  onOpenGames: () => void
}) {
  void onRefresh
  const [viewingTournament, setViewingTournament] = useState<{ id: string; name: string } | null>(null)
  const [tournamentDetail, setTournamentDetail] = useState<{
    standings: any[]
    myMatches: any[]
    name: string
  } | null>(null)
  const [detailTab, setDetailTab] = useState<'standings' | 'matches'>('standings')

  const d = dashboardData
  const name = d?.playerName || player?.name?.split(' ')[0] || 'Jogador'
  const wins = d?.stats.wins ?? player?.wins ?? 0
  const points = d?.leagueStandings?.[0]?.points ?? player?.points ?? 0
  const upcomingMatches = d?.upcomingMatches ?? []
  const upcomingTournaments = d?.upcomingTournaments ?? []

  const viewTournament = async (tournamentId: string, tournamentName: string) => {
    const { fetchTournamentStandingsAndMatches } = await import('./lib/playerDashboardData')
    const { supabase } = await import('./lib/supabase')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const { standings, myMatches, tournamentName: tn } = await fetchTournamentStandingsAndMatches(
      tournamentId,
      session.user.id
    )
    setViewingTournament({ id: tournamentId, name: tournamentName })
    setTournamentDetail({ standings, myMatches, name: tn || tournamentName })
    setDetailTab('standings')
  }

  const totalMatches = d?.stats?.totalMatches ?? 0
  const winRate = d?.stats?.winRate ?? 0
  const rewardPoints = d?.leagueStandings?.[0]?.points ?? points

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Quick Actions */}
      <div className="grid grid-cols-5 gap-3">
        <ActionButton icon={Calendar} label="Reservar" color="lime" />
        <ActionButton icon={Building2} label="Clube Favorito" color="blue" onClick={onOpenClub} />
        <ActionButton icon={Trophy} label="Competir" color="amber" onClick={onOpenCompete} />
        <ActionButton icon={Gamepad2} label="Encontrar Jogo" color="purple" emoji="🎾" />
        <ActionButton icon={GraduationCap} label="Aprender" color="emerald" />
      </div>

      {/* Player Stats Card – premium com emojis */}
      <div className="card-stats-premium p-5 sm:p-6">
        <div className="flex items-start gap-5 sm:gap-6 relative z-10">
          <div className="relative flex-shrink-0">
            {player?.avatar_url ? (
              <img
                src={player.avatar_url}
                alt="Avatar"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-white shadow-lg ring-2 ring-red-100"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-padel flex items-center justify-center shadow-lg ring-2 ring-red-100">
                <span className="text-white font-bold text-2xl sm:text-3xl">
                  {player?.name?.charAt(0)?.toUpperCase() || 'P'}
                </span>
              </div>
            )}
            <span className="level-badge absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-xs sm:text-sm px-2.5 py-1 shadow">
              ⭐ {player?.level?.toFixed(1) || '3.0'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg sm:text-xl text-gray-900">{player?.name || name || 'Jogador'}</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 items-start">
              <div className="stat-tile p-3 flex flex-col items-center">
                <span className="stat-emoji h-8 flex items-center justify-center mb-1">🎾</span>
                <span className="text-lg sm:text-xl font-bold text-gray-900 text-center">{totalMatches}</span>
                <span className="text-xs text-gray-500 font-medium text-center leading-tight">Jogos</span>
              </div>
              <div className="stat-tile p-3 flex flex-col items-center">
                <span className="stat-emoji h-8 flex items-center justify-center mb-1">🏆</span>
                <span className="text-lg sm:text-xl font-bold text-gray-900 text-center">{wins}</span>
                <span className="text-xs text-gray-500 font-medium text-center leading-tight">Vitórias</span>
              </div>
              <div className="stat-tile p-3 flex flex-col items-center">
                <span className="stat-emoji h-8 flex items-center justify-center mb-1">📈</span>
                <span className="text-lg sm:text-xl font-bold text-gray-900 text-center">{winRate}%</span>
                <span className="text-xs text-gray-500 font-medium text-center leading-tight">Taxa vitória</span>
              </div>
              <div className="stat-tile p-3 flex flex-col items-center">
                <span className="stat-emoji h-8 flex items-center justify-center mb-1">⭐</span>
                <span className="text-lg sm:text-xl font-bold text-gray-900 text-center">{player?.level?.toFixed(1) || '3.0'}</span>
                <span className="text-xs text-gray-500 font-medium text-center leading-tight">Nível</span>
              </div>
              <div className="stat-tile p-3 col-span-2 sm:col-span-1 flex flex-col items-center">
                <span className="stat-emoji h-8 flex items-center justify-center mb-1">💎</span>
                <span className="text-lg sm:text-xl font-bold text-amber-600 text-center">{rewardPoints}</span>
                <span className="text-xs text-gray-500 font-medium text-center leading-tight">Pontos reward</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Próximos Jogos – lista horizontal ao estilo Playtomic */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>📅</span> Próximos Jogos
          </h2>
          <button onClick={onOpenGames} className="text-red-600 text-sm font-medium flex items-center gap-1">
            Ver todos <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {upcomingMatches.length > 0 ? (
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth games-horizontal-scroll">
            <div className="flex gap-4" style={{ width: 'max-content' }}>
              {upcomingMatches.map((match) => (
                <div key={match.id} className="snap-center">
                  <GameCardPlaytomic match={match} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-6 text-center">
            <span className="text-4xl mb-2 block">🎾</span>
            <p className="text-gray-700 font-medium">Sem jogos agendados</p>
            <p className="text-sm text-gray-500 mt-1">Inscreve-te num torneio e entra na ação 🚀</p>
          </div>
        )}
      </div>

      {/* Os Meus Torneios */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>🏆</span> Os Meus Torneios
          </h2>
          <button onClick={onOpenCompete} className="text-red-600 text-sm font-medium flex items-center gap-1">
            Ver todos <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          {upcomingTournaments.length > 0 ? (
            upcomingTournaments.slice(0, 3).map((tournament) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                onViewStandings={() => viewTournament(tournament.id, tournament.name)}
              />
            ))
          ) : (
            <div className="card p-6 text-center">
              <span className="text-4xl mb-2 block">🏆</span>
              <p className="text-gray-700 font-medium">Nenhum torneio em que estejas inscrito</p>
              <p className="text-sm text-gray-500 mt-1">Entra na Padel One Tour e compete 🔥</p>
            </div>
          )}
        </div>
      </div>

      {/* Resultados Recentes – lista horizontal ao estilo Playtomic */}
      {d && d.recentMatches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>📊</span> Resultados Recentes
            </h2>
            <button onClick={onOpenGames} className="text-red-600 text-sm font-medium flex items-center gap-1">
              Ver todos <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth games-horizontal-scroll">
            <div className="flex gap-4" style={{ width: 'max-content' }}>
              {d.recentMatches.map((match) => (
                <div key={match.id} className="snap-center">
                  <GameCardPlaytomic match={match} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Torneio – integração Tour */}
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
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Nome</th><th className="px-3 py-2 text-center">V</th><th className="px-3 py-2 text-center">D</th><th className="px-3 py-2 text-center">Pts</th></tr>
                  </thead>
                  <tbody>
                    {tournamentDetail.standings.map((row, i) => (
                      <tr key={row.id} className="border-t">
                        <td className="px-3 py-2">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{row.name}</td>
                        <td className="px-3 py-2 text-center text-green-600">{row.wins}</td>
                        <td className="px-3 py-2 text-center text-red-500">{row.losses}</td>
                        <td className="px-3 py-2 text-center font-bold">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {detailTab === 'matches' && (
                <div className="divide-y">
                  {tournamentDetail.myMatches.length === 0 ? <div className="p-6 text-center text-gray-500">Sem jogos registados</div> : tournamentDetail.myMatches.map((m) => (
                    <div key={m.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div><p className="font-medium text-gray-900">{m.team1_name}</p><p className="text-sm text-gray-500">vs</p><p className="font-medium text-gray-900">{m.team2_name}</p></div>
                        <div className="text-right">
                          {m.status === 'completed' ? <span className="text-lg font-bold">{m.team1_score} - {m.team2_score}</span> : <span className="text-sm text-gray-500">{formatDateTime(m.scheduled_time)}</span>}
                          {m.is_winner !== undefined && <span className={`block text-xs mt-1 ${m.is_winner ? 'text-green-600' : 'text-red-600'}`}>{m.is_winner ? 'Vitória' : 'Derrota'}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Clube Favorito (detalhes do clube escolhido no perfil) ----------
function ClubScreen({ favoriteClubId, onBack }: { favoriteClubId: string | null; onBack: () => void }) {
  const [club, setClub] = useState<ClubDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const id = favoriteClubId || localStorage.getItem('padel_one_player_favorite_club_id')
    if (!id) {
      setClub(null)
      setLoading(false)
      return
    }
    fetchClubById(id).then((data) => {
      if (!cancelled) {
        setClub(data ?? null)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [favoriteClubId])

  if (loading) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" /> Voltar
        </button>
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!club) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" /> Voltar
        </button>
        <div className="card p-8 text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Ainda não escolheste o teu clube.</p>
          <p className="text-sm text-gray-400 mt-1">Vai ao Perfil e escolhe o teu clube favorito na lista de clubes Padel One.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-5 h-5" /> Voltar
      </button>
      <div className="card overflow-hidden">
        {club.logo_url && (
          <img src={club.logo_url} alt={club.name} className="w-full h-40 object-cover object-center" />
        )}
        <div className="p-5">
          <h1 className="text-xl font-bold text-gray-900">{club.name}</h1>
          {club.description && (
            <p className="text-gray-600 mt-2 text-sm leading-relaxed">{club.description}</p>
          )}
          <div className="mt-4 space-y-2">
            {club.address && (
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{club.address}{club.city ? `, ${club.city}` : ''}{club.country ? `, ${club.country}` : ''}</span>
              </div>
            )}
            {club.phone && (
              <a href={`tel:${club.phone}`} className="flex items-center gap-2 text-sm text-red-600 hover:underline">
                <Phone className="w-4 h-4" /> {club.phone}
              </a>
            )}
            {club.email && (
              <a href={`mailto:${club.email}`} className="flex items-center gap-2 text-sm text-red-600 hover:underline">
                <Mail className="w-4 h-4" /> {club.email}
              </a>
            )}
            {club.website && (
              <a href={club.website.startsWith('http') ? club.website : `https://${club.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-red-600 hover:underline">
                <Globe className="w-4 h-4" /> {club.website}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Competir: Próximos torneios + Os seus Torneios/Ligas ----------
function CompeteScreen({
  dashboardData,
  favoriteClubId,
  userId,
  playerAccountId,
  onBack,
}: {
  dashboardData: PlayerDashboardData | null
  favoriteClubId: string | null
  userId: string | null
  playerAccountId: string | null
  onBack: () => void
}) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'leagues' | 'history'>('upcoming')
  const [upcomingFromTour, setUpcomingFromTour] = useState<UpcomingTournamentFromTour[]>([])
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
  const [pastTournamentDetails, setPastTournamentDetails] = useState<Record<string, { standings: any[]; myMatches: any[]; playerPosition?: number; tournamentName: string }>>({})
  const [pastTournamentLoading, setPastTournamentLoading] = useState(false)
  const [leaguesDirect, setLeaguesDirect] = useState<PlayerDashboardData['leagueStandings']>([])
  const [leaguesLoading, setLeaguesLoading] = useState(false)
  const [leaguesFetched, setLeaguesFetched] = useState(false)
  const [historyFetched, setHistoryFetched] = useState(false)

  const d = dashboardData
  const name = d?.playerName ?? ''

  // Use ligas do dashboardData se existirem, senão usa as buscadas diretamente
  const leagueStandings = (d?.leagueStandings?.length ?? 0) > 0 ? d!.leagueStandings : leaguesDirect

  useEffect(() => {
    let active = true
    const clubId = favoriteClubId || localStorage.getItem('padel_one_player_favorite_club_id')
    fetchUpcomingTournaments(clubId || undefined).then((list) => {
      if (active) { setUpcomingFromTour(list); setLoadingUpcoming(false) }
    }).catch(() => {
      if (active) setLoadingUpcoming(false)
    })
    return () => { active = false }
  }, [favoriteClubId])

  // Buscar ligas quando abre o tab Ligas (via Edge Function - bypass RLS)
  useEffect(() => {
    if (activeTab !== 'leagues') return
    if ((d?.leagueStandings?.length ?? 0) > 0 || leaguesFetched) return
    if (!playerAccountId) return
    let active = true
    setLeaguesLoading(true)
    ;(async () => {
      try {
        // Usar Edge Function porque o user pode não ter Supabase Auth session (login por telefone)
        const resp = await fetch(
          `https://rqiwnxcexsccguruiteq.supabase.co/functions/v1/get-player-leagues`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_account_id: playerAccountId }),
          }
        )
        if (active && resp.ok) {
          const data = await resp.json()
          console.log('[Leagues] Got', data?.leagues?.length ?? 0, 'leagues')
          if (data?.leagues?.length && active) {
            setLeaguesDirect(data.leagues)
          }
        } else {
          console.error('[Leagues] Edge Function error:', resp.status)
        }
      } catch (err) {
        console.error('[Leagues] ERROR:', err)
      }
      if (active) { setLeaguesLoading(false); setLeaguesFetched(true) }
    })()
    return () => { active = false }
  }, [activeTab, d?.leagueStandings?.length, leaguesFetched, playerAccountId])

  // Usar pastTournamentDetails do dashboardData se disponíveis
  useEffect(() => {
    if (d?.pastTournamentDetails && Object.keys(d.pastTournamentDetails).length > 0 && Object.keys(pastTournamentDetails).length === 0) {
      setPastTournamentDetails(d.pastTournamentDetails)
      setHistoryFetched(true)
    }
  }, [d?.pastTournamentDetails])

  // Carregar detalhes dos torneios passados quando abre o tab history
  useEffect(() => {
    if (activeTab !== 'history') return
    if (!d?.pastTournaments?.length) return
    if (!userId) return
    if (historyFetched || Object.keys(pastTournamentDetails).length > 0) return
    let active = true
    console.log('[History] Fetching', d.pastTournaments.length, 'tournaments, userId:', userId)
    setPastTournamentLoading(true)
    ;(async () => {
      try {
        const { fetchTournamentStandingsAndMatches } = await import('./lib/playerDashboardData')
        const results: Record<string, { standings: any[]; myMatches: any[]; playerPosition?: number; tournamentName: string }> = {}
        for (const t of (d.pastTournaments ?? [])) {
          if (!active) break
          try {
            const data = await fetchTournamentStandingsAndMatches(t.id, userId!)
            results[t.id] = { standings: data.standings, myMatches: data.myMatches, playerPosition: data.playerPosition, tournamentName: data.tournamentName }
            console.log(`[History] ${t.name}: ${data.standings.length} standings, ${data.myMatches.length} matches`)
            if (active) setPastTournamentDetails({ ...results })
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
  }, [activeTab, d?.pastTournaments?.length, historyFetched, userId])

  const viewLeague = async (id: string, leagueName: string) => {
    setViewingLeague({ id, name: leagueName })
    setLeagueFull([])
    setLeagueCategories([])
    setLeagueLoading(true)
    try {
      const resp = await fetch(
        `https://rqiwnxcexsccguruiteq.supabase.co/functions/v1/get-league-standings`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ league_id: id, player_name: name }),
        }
      )
      if (resp.ok) {
        const data = await resp.json()
        setLeagueFull(data.standings || [])
        setLeagueCategories(data.categories || [])
      }
    } catch (err) {
      console.error('[League] Error:', err)
    }
    setLeagueLoading(false)
  }

  const viewTournament = async (tournamentId: string, tournamentName: string) => {
    const cached = pastTournamentDetails[tournamentId]
    if (cached) {
      setViewingTournament({ id: tournamentId, name: tournamentName })
      setTournamentDetail({ standings: cached.standings, myMatches: cached.myMatches, name: cached.tournamentName })
      setDetailTab('standings')
      return
    }
    if (!userId) return
    const { fetchTournamentStandingsAndMatches } = await import('./lib/playerDashboardData')
    const { standings, myMatches, tournamentName: tn } = await fetchTournamentStandingsAndMatches(tournamentId, userId)
    setViewingTournament({ id: tournamentId, name: tournamentName })
    setTournamentDetail({ standings, myMatches, name: tn || tournamentName })
    setDetailTab('standings')
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

  return (
    <div className="space-y-4 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-5 h-5" /> Voltar
      </button>
      <h1 className="text-xl font-bold text-gray-900">Competir</h1>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 min-w-0 py-2 px-3 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === 'upcoming' ? 'bg-red-600 text-white' : 'text-gray-600'}`}
        >
          Próximos
        </button>
        <button
          onClick={() => setActiveTab('leagues')}
          className={`flex-1 min-w-0 py-2 px-3 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === 'leagues' ? 'bg-red-600 text-white' : 'text-gray-600'}`}
        >
          Ligas
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 min-w-0 py-2 px-3 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === 'history' ? 'bg-red-600 text-white' : 'text-gray-600'}`}
        >
          Histórico
        </button>
      </div>

      {activeTab === 'upcoming' && (
        <div className="space-y-4">
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
            const TournamentCard = ({ t, isEnrolled }: { t: UpcomingTournamentFromTour; isEnrolled: boolean }) => (
              <div key={t.id} className="card overflow-hidden p-0 flex">
                <div className="w-24 sm:w-32 flex-shrink-0">
                  {t.image_url ? (
                    <img src={t.image_url} alt={t.name} className="w-full h-full min-h-[140px] object-cover rounded-l-xl" />
                  ) : (
                    <div className="w-full h-full min-h-[140px] bg-gradient-to-br from-red-100 to-amber-100 flex items-center justify-center rounded-l-xl">
                      <Trophy className="w-12 h-12 text-red-400/70" />
                    </div>
                  )}
                </div>
                <div className="flex-1 p-4 sm:p-5 min-w-0 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-gray-900 text-base sm:text-lg line-clamp-2">{t.name}</h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isEnrolled && (
                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700">Inscrito</span>
                      )}
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {t.status === 'active' ? 'Aberto' : t.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    {formatDate(t.start_date)}
                  </p>
                  {t.description && (
                    <div className="text-sm text-gray-600 mt-2 line-clamp-3 flex-1 [&_p]:my-0 [&_p]:last:mb-0" dangerouslySetInnerHTML={{ __html: t.description }} />
                  )}
                  {isEnrolled ? (
                    <button
                      type="button"
                      onClick={() => viewEnrolled(t.id, t.name)}
                      className="mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors w-fit"
                    >
                      <Users className="w-4 h-4" />
                      Ver inscritos por categoria
                    </button>
                  ) : (
                    <a
                      href={getTournamentRegistrationUrl(t.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors w-fit"
                    >
                      Link de inscrição
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            )
            return (enrolledList.length > 0 || openList.length > 0) ? (
              <div className="space-y-6">
                {enrolledList.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Torneios onde já estás inscrito
                    </h2>
                    <div className="space-y-4">
                      {enrolledList.map((t) => (
                        <TournamentCard key={t.id} t={t} isEnrolled={true} />
                      ))}
                    </div>
                  </div>
                )}
                {openList.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Torneios abertos à inscrição
                    </h2>
                    <div className="space-y-4">
                      {openList.map((t) => (
                        <TournamentCard key={t.id} t={t} isEnrolled={false} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="card p-8 text-center text-gray-500">
                Nenhum torneio próximo do clube. Consulta a Padel One Tour para mais torneios.
              </div>
            )
          })()}
        </div>
      )}

      {activeTab === 'leagues' && (
        <div className="space-y-4">
          {leaguesLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
            </div>
          ) : leagueStandings.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Ligas onde participas</p>
              {leagueStandings.map((s, idx) => (
                <div key={idx} className="card p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{s.league_name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{s.position}º de {s.total_participants} · {s.points} pts</p>
                  </div>
                  <button onClick={() => viewLeague(s.league_id, s.league_name)} className="text-red-600 text-sm font-medium flex items-center gap-1">
                    Ver classificação <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Trophy className="w-16 h-16 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">Ainda não participas em nenhuma liga.</p>
              <p className="text-sm text-gray-400 mt-1">Inscreve-te em torneios associados a ligas na Padel One Tour.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {pastTournamentLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : d?.pastTournaments && d.pastTournaments.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Torneios concluídos</p>
              {d.pastTournaments.map((t) => {
                const details = pastTournamentDetails[t.id]
                const wins = details?.myMatches?.filter((m) => m.is_winner).length ?? 0
                const losses = details?.myMatches?.filter((m) => m.is_winner === false).length ?? 0
                return (
                  <div key={t.id} className="card overflow-hidden p-0">
                    <div className="p-4">
                      {/* Cabeçalho do torneio */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{t.name}</h3>
                          <p className="text-sm text-gray-500 mt-0.5">{formatDate(t.start_date)}</p>
                          {details && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {details.playerPosition != null && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-medium">
                                  <Trophy className="w-3.5 h-3.5" /> {details.playerPosition}º lugar
                                </span>
                              )}
                              {(wins > 0 || losses > 0) && (
                                <span className="inline-flex items-center px-2 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium">
                                  {wins}V {losses}D
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {!details && !pastTournamentLoading && (
                          <span className="text-xs text-gray-400 animate-pulse flex-shrink-0">A carregar...</span>
                        )}
                      </div>

                      {/* Todos os resultados do jogador */}
                      {details?.myMatches && details.myMatches.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-2">Os teus resultados</p>
                          <div className="space-y-2">
                            {details.myMatches.map((m) => (
                              <div key={m.id} className="flex justify-between items-center text-sm py-2 px-3 bg-gray-50 rounded-lg">
                                <span className="text-gray-700 truncate flex-1 mr-2">
                                  {m.team1_name} vs {m.team2_name}
                                </span>
                                <span className="font-semibold text-gray-900 flex-shrink-0">
                                  {m.team1_score}-{m.team2_score}
                                </span>
                                {m.is_winner !== undefined && (
                                  <span className={`ml-2 text-xs font-medium flex-shrink-0 ${m.is_winner ? 'text-green-600' : 'text-red-600'}`}>
                                    {m.is_winner ? 'V' : 'D'}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Classificação completa */}
                      {details?.standings && details.standings.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-2">Classificação final</p>
                          <div className="overflow-x-auto -mx-1">
                            <table className="w-full text-sm min-w-[200px]">
                              <thead>
                                <tr className="text-left text-gray-500 border-b">
                                  <th className="py-1.5 px-2 font-medium">#</th>
                                  <th className="py-1.5 px-2 font-medium">Nome</th>
                                  <th className="py-1.5 px-2 text-center font-medium">V</th>
                                  <th className="py-1.5 px-2 text-center font-medium">D</th>
                                  <th className="py-1.5 px-2 text-center font-medium">Pts</th>
                                </tr>
                              </thead>
                              <tbody>
                                {details.standings.map((row, i) => (
                                  <tr key={row.id} className={`border-b border-gray-50 ${details.playerPosition === i + 1 ? 'bg-red-50 font-semibold' : ''}`}>
                                    <td className="py-1.5 px-2">{i + 1}</td>
                                    <td className="py-1.5 px-2 font-medium truncate max-w-[140px]">{row.name}</td>
                                    <td className="py-1.5 px-2 text-center text-green-600">{row.wins}</td>
                                    <td className="py-1.5 px-2 text-center text-red-500">{row.losses}</td>
                                    <td className="py-1.5 px-2 text-center font-bold">{row.points}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Trophy className="w-16 h-16 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">Ainda não tens torneios concluídos.</p>
              <p className="text-sm text-gray-400 mt-1">Os torneios em que participares aparecerão aqui.</p>
            </div>
          )}
        </div>
      )}

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
                <h2 className="text-base font-bold truncate mr-2">{viewingLeague.name}</h2>
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
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 w-8">#</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Nome</th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 w-12">Pts</th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 w-8">T</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayStandings.map((row) => (
                        <tr key={row.position} className={`border-t border-gray-100 ${row.is_current_player ? 'bg-red-50' : ''}`}>
                          <td className="px-2 py-1.5 text-gray-500 text-xs">{row.position}</td>
                          <td className="px-2 py-1.5 truncate max-w-[180px]">
                            <span className={row.is_current_player ? 'font-semibold' : 'font-medium'}>{row.entity_name}</span>
                            {row.is_current_player && <span className="ml-1 text-xs bg-red-100 text-red-600 px-1 rounded">Tu</span>}
                          </td>
                          <td className="px-2 py-1.5 text-center font-bold">{row.total_points}</td>
                          <td className="px-2 py-1.5 text-center text-gray-500 text-xs">{row.tournaments_played}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                          <li key={item.id} className="text-sm text-gray-900 py-1.5 px-3 bg-gray-50 rounded-lg">
                            <span className="font-medium text-gray-600">{idx + 1}.</span>{' '}
                            {item.player_names?.length ? (
                              <span>{item.player_names.join(' · ')}</span>
                            ) : item.player1_name != null || item.player2_name != null ? (
                              <span>{[item.player1_name, item.player2_name].filter(Boolean).join(' / ')}</span>
                            ) : (
                              <span>{item.name}</span>
                            )}
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
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Nome</th><th className="px-3 py-2 text-center">V</th><th className="px-3 py-2 text-center">D</th><th className="px-3 py-2 text-center">Pts</th></tr>
                  </thead>
                  <tbody>
                    {tournamentDetail.standings.map((row, i) => (
                      <tr key={row.id} className="border-t">
                        <td className="px-3 py-2">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{row.name}</td>
                        <td className="px-3 py-2 text-center text-green-600">{row.wins}</td>
                        <td className="px-3 py-2 text-center text-red-500">{row.losses}</td>
                        <td className="px-3 py-2 text-center font-bold">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {detailTab === 'matches' && (
                <div className="divide-y">
                  {tournamentDetail.myMatches.length === 0 ? <div className="p-6 text-center text-gray-500">Sem jogos registados</div> : tournamentDetail.myMatches.map((m) => (
                    <div key={m.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div><p className="font-medium text-gray-900">{m.team1_name}</p><p className="text-sm text-gray-500">vs</p><p className="font-medium text-gray-900">{m.team2_name}</p></div>
                        <div className="text-right">
                          {m.status === 'completed' ? <span className="text-lg font-bold">{m.team1_score} - {m.team2_score}</span> : <span className="text-sm text-gray-500">{formatDateTime(m.scheduled_time)}</span>}
                          {m.is_winner !== undefined && <span className={`block text-xs mt-1 ${m.is_winner ? 'text-green-600' : 'text-red-600'}`}>{m.is_winner ? 'Vitória' : 'Derrota'}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function GamesScreen({
  player: _player,
  dashboardData,
  onRefresh,
}: {
  player: PlayerAccount | null
  dashboardData: PlayerDashboardData | null
  onRefresh: () => Promise<void>
}) {
  void onRefresh
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming')
  const d = dashboardData
  const upcoming = d?.upcomingMatches ?? []
  const recent = d?.recentMatches ?? []
  const list = activeTab === 'upcoming' ? upcoming : recent

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900">Jogos</h1>

      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'upcoming' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          Próximos
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          Histórico
        </button>
      </div>

      {list.length > 0 ? (
        <div className="space-y-3">
          {list.map((match) => (
            <div key={match.id} className="w-full">
              <GameCardPlaytomic match={match} fullWidth />
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <span className="text-4xl mb-2 block">🎾</span>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Sem jogos</h3>
          <p className="text-gray-500 text-sm mb-4">Cria um jogo ou inscreve-te num torneio para começar</p>
          <button className="px-6 py-3 btn-primary">Criar Jogo</button>
        </div>
      )}
    </div>
  )
}

function ProfileScreen({
  player,
  onLogout,
  onSaveFavoriteClub,
  onSaveProfile,
}: {
  player: PlayerAccount | null
  onLogout: () => void
  onSaveFavoriteClub: (clubId: string | null) => Promise<void>
  onSaveProfile: (updates: Partial<PlayerAccount>) => Promise<void>
}) {
  const [clubs, setClubs] = useState<ClubDetail[]>([])
  const [loadingClubs, setLoadingClubs] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const favoriteClubId = player?.favorite_club_id ?? localStorage.getItem('padel_one_player_favorite_club_id')

  // Editable fields
  const [editName, setEditName] = useState(player?.name || '')
  const [editEmail, setEditEmail] = useState(player?.email || '')
  const [editCategory, setEditCategory] = useState<string>(player?.player_category || '')
  const [editGender, setEditGender] = useState<string>(player?.gender || '')
  const [editBirthDate, setEditBirthDate] = useState(player?.birth_date || '')
  const [editLocation, setEditLocation] = useState(player?.location || '')
  const [editHand, setEditHand] = useState<string>(player?.preferred_hand || '')
  const [editPosition, setEditPosition] = useState<string>(player?.court_position || '')
  const [editBio, setEditBio] = useState(player?.bio || '')
  const [editGameType, setEditGameType] = useState<string>(player?.game_type || '')
  const [editPreferredTime, setEditPreferredTime] = useState<string>(player?.preferred_time || '')

  // Sync fields when player changes
  useEffect(() => {
    if (player) {
      setEditName(player.name || '')
      setEditEmail(player.email || '')
      setEditCategory(player.player_category || '')
      setEditGender(player.gender || '')
      setEditBirthDate(player.birth_date || '')
      setEditLocation(player.location || '')
      setEditHand(player.preferred_hand || '')
      setEditPosition(player.court_position || '')
      setEditBio(player.bio || '')
      setEditGameType(player.game_type || '')
      setEditPreferredTime(player.preferred_time || '')
    }
  }, [player])

  useEffect(() => {
    fetchAllClubs().then((list) => {
      setClubs(list)
      setLoadingClubs(false)
    }).catch(() => setLoadingClubs(false))
  }, [])

  // Filter categories by gender prefix
  const genderPrefix = editGender === 'male' ? 'M' : editGender === 'female' ? 'F' : null
  const filteredCategories = genderPrefix
    ? PLAYER_CATEGORIES.filter((c) => c.gender === genderPrefix)
    : PLAYER_CATEGORIES

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !player?.id) return

    // Validar tamanho (max 1MB)
    if (file.size > 1 * 1024 * 1024) {
      setSaveMsg('A imagem deve ter no máximo 1MB')
      setTimeout(() => setSaveMsg(''), 3000)
      return
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      setSaveMsg('O ficheiro deve ser uma imagem')
      setTimeout(() => setSaveMsg(''), 3000)
      return
    }

    setUploadingAvatar(true)
    setSaveMsg('')
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const filePath = `${player.id}.${ext}`

      // Apagar avatar anterior se existir
      await supabase.storage.from('player-avatars').remove([filePath])

      // Upload novo avatar
      const { error: uploadError } = await supabase.storage
        .from('player-avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (uploadError) throw uploadError

      // Gerar URL pública
      const { data: urlData } = supabase.storage
        .from('player-avatars')
        .getPublicUrl(filePath)

      const avatar_url = urlData.publicUrl + '?t=' + Date.now()

      // Guardar URL no perfil
      await onSaveProfile({ avatar_url })
      setSaveMsg('Foto atualizada!')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) {
      console.error('[AVATAR] Upload error:', err)
      setSaveMsg('Erro ao carregar foto')
      setTimeout(() => setSaveMsg(''), 3000)
    } finally {
      setUploadingAvatar(false)
      // Reset input para permitir re-upload do mesmo ficheiro
      e.target.value = ''
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      await onSaveProfile({
        name: editName.trim() || undefined,
        email: editEmail.trim() || undefined,
        player_category: (editCategory || null) as any,
        gender: (editGender || undefined) as any,
        birth_date: editBirthDate || undefined,
        location: editLocation.trim() || undefined,
        preferred_hand: (editHand || undefined) as any,
        court_position: (editPosition || undefined) as any,
        bio: editBio.trim() || undefined,
        game_type: (editGameType || undefined) as any,
        preferred_time: (editPreferredTime || undefined) as any,
      })
      setSaveMsg('Perfil guardado!')
      setEditing(false)
      setTimeout(() => setSaveMsg(''), 3000)
    } catch {
      setSaveMsg('Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Profile Header */}
      <div className="card p-6 text-center">
        <div className="relative inline-block">
          {player?.avatar_url ? (
            <img 
              src={player.avatar_url} 
              alt="Avatar" 
              className="w-24 h-24 rounded-full object-cover border-4 border-red-100 mx-auto"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-padel flex items-center justify-center mx-auto">
              <span className="text-3xl font-bold text-white">
                {player?.name?.charAt(0)?.toUpperCase() || 'P'}
              </span>
            </div>
          )}
          <label className="absolute bottom-0 right-0 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:bg-red-700 transition-colors">
            {uploadingAvatar ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera className="w-4 h-4 text-white" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
              className="hidden"
            />
          </label>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mt-3">{player?.name || 'Jogador'}</h2>
        <p className="text-gray-500 text-sm">{player?.phone_number || player?.phone}</p>
        
        {/* Category + Level Badge */}
        <div className="flex items-center justify-center gap-2 mt-3">
          {player?.player_category && (
            <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-bold">
              {player.player_category}
            </span>
          )}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-full">
            <Target className="w-3.5 h-3.5 text-red-600" />
            <span className="font-semibold text-red-600 text-sm">Nível {player?.level?.toFixed(1) || '3.0'}</span>
          </div>
        </div>
        
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-2xl font-bold text-red-600">{player?.level?.toFixed(1) || '3.0'}</p>
            <p className="text-xs text-gray-500">Nível</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{player?.wins || 0}</p>
            <p className="text-xs text-gray-500">Vitórias</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-500">{player?.points || 0}</p>
            <p className="text-xs text-gray-500">Pontos</p>
          </div>
        </div>
      </div>

      {/* Success/Error Message */}
      {saveMsg && (
        <div className={`text-center text-sm font-medium py-2 px-4 rounded-lg ${saveMsg.includes('Erro') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {saveMsg}
        </div>
      )}

      {/* Profile Edit Section */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setEditing(!editing)}
          className="w-full p-4 flex items-center justify-between border-b border-gray-100"
        >
          <div className="flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-gray-900">Editar Perfil</h3>
          </div>
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${editing ? 'rotate-180' : ''}`} />
        </button>

        {editing && (
          <div className="p-4 space-y-4">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder="O teu nome"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder="email@exemplo.com"
              />
            </div>

            {/* Género */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'male', label: 'Masculino' },
                  { value: 'female', label: 'Feminino' },
                  { value: 'other', label: 'Outro' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setEditGender(opt.value)
                      // Reset category if gender prefix changes
                      const newPrefix = opt.value === 'male' ? 'M' : opt.value === 'female' ? 'F' : null
                      if (editCategory && newPrefix && !editCategory.startsWith(newPrefix)) {
                        setEditCategory('')
                      }
                    }}
                    className={`py-2 px-2 rounded-lg text-sm font-medium border transition-colors ${
                      editGender === opt.value
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-red-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Categoria */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <div className="grid grid-cols-6 gap-1.5">
                {filteredCategories.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setEditCategory(editCategory === cat.value ? '' : cat.value)}
                    className={`py-2 rounded-lg text-sm font-bold transition-colors ${
                      editCategory === cat.value
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              {!editGender && (
                <p className="text-xs text-gray-400 mt-1">Seleciona o género para filtrar as categorias</p>
              )}
            </div>

            {/* Data de Nascimento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
              <input
                type="date"
                value={editBirthDate}
                onChange={(e) => setEditBirthDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              />
            </div>

            {/* Localização */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Localização</label>
              <input
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder="Cidade ou região"
              />
            </div>

            {/* Mão Preferida */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mão Preferida</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'right', label: 'Direita' },
                  { value: 'left', label: 'Esquerda' },
                  { value: 'ambidextrous', label: 'Ambidestro' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditHand(editHand === opt.value ? '' : opt.value)}
                    className={`py-2 px-2 rounded-lg text-sm font-medium border transition-colors ${
                      editHand === opt.value
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-red-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Posição em Campo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Posição em Campo</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'right', label: 'Direita' },
                  { value: 'left', label: 'Esquerda' },
                  { value: 'both', label: 'Ambas' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditPosition(editPosition === opt.value ? '' : opt.value)}
                    className={`py-2 px-2 rounded-lg text-sm font-medium border transition-colors ${
                      editPosition === opt.value
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-red-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tipo de Jogo Preferido */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Jogo Preferido</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'competitive', label: 'Competitivo' },
                  { value: 'friendly', label: 'Amigável' },
                  { value: 'both', label: 'Ambos' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditGameType(editGameType === opt.value ? '' : opt.value)}
                    className={`py-2 px-2 rounded-lg text-sm font-medium border transition-colors ${
                      editGameType === opt.value
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-red-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Horário Preferido */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Horário de Jogo Preferido</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'morning', label: 'Manhã' },
                  { value: 'afternoon', label: 'Tarde' },
                  { value: 'evening', label: 'Noite' },
                  { value: 'all_day', label: 'Dia todo' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditPreferredTime(editPreferredTime === opt.value ? '' : opt.value)}
                    className={`py-2 px-1 rounded-lg text-xs font-medium border transition-colors ${
                      editPreferredTime === opt.value
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-red-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sobre mim</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                placeholder="Uma breve descrição sobre ti..."
              />
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Perfil
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Clube Favorito – lista de clubes Padel One */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-gray-900">Clube Favorito</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">Escolhe o teu clube na lista de clubes geridos pela Padel One.</p>
        </div>
        <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
          {loadingClubs ? (
            <div className="p-4 text-center text-gray-500">A carregar clubes...</div>
          ) : clubs.length === 0 ? (
            <div className="p-4 text-center text-gray-500">Nenhum clube disponível.</div>
          ) : (
            <>
              <button
                onClick={() => onSaveFavoriteClub(null)}
                className={`w-full p-4 flex items-center justify-between text-left ${!favoriteClubId ? 'bg-red-50' : 'hover:bg-gray-50'}`}
              >
                <span className="text-gray-600">Nenhum</span>
                {!favoriteClubId && <span className="text-xs text-red-600 font-medium">✓</span>}
              </button>
              {clubs.map((club) => (
                <button
                  key={club.id}
                  onClick={() => onSaveFavoriteClub(club.id)}
                  className={`w-full p-4 flex items-center gap-3 text-left ${favoriteClubId === club.id ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                >
                  {club.logo_url ? (
                    <img src={club.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <span className="font-medium text-gray-900 flex-1 truncate">{club.name}</span>
                  {favoriteClubId === club.id && <span className="text-xs text-red-600 font-medium">✓</span>}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Logout */}
      <button 
        onClick={onLogout}
        className="w-full card p-4 flex items-center gap-3 text-red-600 hover:bg-red-50 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        <span className="font-medium">Terminar Sessão</span>
      </button>
    </div>
  )
}

function MenuItem({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-gray-400" />
        <span className="font-medium text-gray-900">{label}</span>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400" />
    </button>
  )
}

export default App
