import { useState, useEffect } from 'react'
import { supabase, PlayerAccount } from './lib/supabase'
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
  GraduationCap
} from 'lucide-react'
import { fetchAllClubs, fetchClubById, fetchUpcomingTournaments, type ClubDetail, type UpcomingTournamentFromTour } from './lib/clubAndTournaments'

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
            onBack={() => setCurrentScreen('home')}
          />
        )}
        {currentScreen === 'profile' && (
          <ProfileScreen
            player={player}
            onLogout={handleLogout}
            onSaveFavoriteClub={handleSaveFavoriteClub}
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
function GameCardPlaytomic({ match }: { match: PlayerMatchForCard }) {
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
    <div className="flex-shrink-0 w-[280px] sm:w-[300px] rounded-2xl bg-white border border-gray-100 shadow-md overflow-hidden">
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

        {/* Layout: grid 2x2 para bolinhas alinhadas; resultados à direita; linha fina divide equipas */}
        <div className="flex flex-col">
          {/* Equipa 1 – laranja */}
          <div className="flex items-center justify-between gap-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-0 w-[120px] flex-shrink-0">
              <div className="flex flex-col items-center">
                <div className="w-11 h-11 rounded-full bg-orange-400 flex items-center justify-center text-xl font-bold text-white shadow-sm" title={p1}>
                  {initialFor(p1)}
                </div>
                <span className="text-[10px] text-gray-600 truncate max-w-[60px] mt-0.5 text-center" title={p1}>{p1}</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-11 h-11 rounded-full bg-orange-400 flex items-center justify-center text-xl font-bold text-white shadow-sm" title={p2}>
                  {initialFor(p2)}
                </div>
                <span className="text-[10px] text-gray-600 truncate max-w-[60px] mt-0.5 text-center" title={p2}>{p2}</span>
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
          <div className="border-t border-gray-200 my-2" />

          {/* Equipa 2 – azul claro (grid igual para alinhar com equipa 1) */}
          <div className="flex items-center justify-between gap-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-0 w-[120px] flex-shrink-0">
              <div className="flex flex-col items-center">
                <div className="w-11 h-11 rounded-full bg-sky-200 flex items-center justify-center text-xl font-bold text-sky-800 shadow-sm" title={p3}>
                  {initialFor(p3)}
                </div>
                <span className="text-[10px] text-gray-600 truncate max-w-[60px] mt-0.5 text-center" title={p3}>{p3}</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-11 h-11 rounded-full bg-sky-200 flex items-center justify-center text-xl font-bold text-sky-800 shadow-sm" title={p4}>
                  {initialFor(p4)}
                </div>
                <span className="text-[10px] text-gray-600 truncate max-w-[60px] mt-0.5 text-center" title={p4}>{p4}</span>
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
}: {
  player: PlayerAccount | null
  dashboardData: PlayerDashboardData | null
  onRefresh: () => Promise<void>
  onOpenClub: () => void
  onOpenCompete: () => void
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
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
              <div className="stat-tile p-3 flex flex-col items-center text-center">
                <span className="stat-emoji mb-1">🎾</span>
                <span className="text-lg sm:text-xl font-bold text-gray-900">{totalMatches}</span>
                <span className="text-xs text-gray-500 font-medium">Jogos</span>
              </div>
              <div className="stat-tile p-3 flex flex-col items-center text-center">
                <span className="stat-emoji mb-1">🏆</span>
                <span className="text-lg sm:text-xl font-bold text-gray-900">{wins}</span>
                <span className="text-xs text-gray-500 font-medium">Vitórias</span>
              </div>
              <div className="stat-tile p-3 flex flex-col items-center text-center">
                <span className="stat-emoji mb-1">📈</span>
                <span className="text-lg sm:text-xl font-bold text-gray-900">{winRate}%</span>
                <span className="text-xs text-gray-500 font-medium">Taxa vitória</span>
              </div>
              <div className="stat-tile p-3 flex flex-col items-center text-center">
                <span className="stat-emoji mb-1">⭐</span>
                <span className="text-lg sm:text-xl font-bold text-gray-900">{player?.level?.toFixed(1) || '3.0'}</span>
                <span className="text-xs text-gray-500 font-medium">Nível</span>
              </div>
              <div className="stat-tile p-3 flex flex-col items-center text-center col-span-2 sm:col-span-1">
                <span className="stat-emoji mb-1">💎</span>
                <span className="text-lg sm:text-xl font-bold text-amber-600">{rewardPoints}</span>
                <span className="text-xs text-gray-500 font-medium">Pontos reward</span>
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
          <button className="text-red-600 text-sm font-medium flex items-center gap-1">
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
          <button className="text-red-600 text-sm font-medium flex items-center gap-1">
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
            <button className="text-red-600 text-sm font-medium flex items-center gap-1">
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
  onBack,
}: {
  dashboardData: PlayerDashboardData | null
  favoriteClubId: string | null
  onBack: () => void
}) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'mine'>('upcoming')
  const [upcomingFromTour, setUpcomingFromTour] = useState<UpcomingTournamentFromTour[]>([])
  const [loadingUpcoming, setLoadingUpcoming] = useState(true)
  const [viewingLeague, setViewingLeague] = useState<{ id: string; name: string } | null>(null)
  const [leagueFull, setLeagueFull] = useState<any[]>([])
  const [viewingTournament, setViewingTournament] = useState<{ id: string; name: string } | null>(null)
  const [tournamentDetail, setTournamentDetail] = useState<{ standings: any[]; myMatches: any[]; name: string } | null>(null)
  const [detailTab, setDetailTab] = useState<'standings' | 'matches'>('standings')

  const d = dashboardData
  const name = d?.playerName ?? ''

  useEffect(() => {
    let cancelled = false
    const clubId = favoriteClubId || localStorage.getItem('padel_one_player_favorite_club_id')
    fetchUpcomingTournaments(clubId || undefined).then((list) => {
      if (!cancelled) {
        setUpcomingFromTour(list)
        setLoadingUpcoming(false)
      }
    }).catch(() => {
      if (!cancelled) setLoadingUpcoming(false)
    })
    return () => { cancelled = true }
  }, [favoriteClubId])

  const viewLeague = async (id: string, leagueName: string) => {
    const { fetchLeagueFullStandings } = await import('./lib/playerDashboardData')
    const list = await fetchLeagueFullStandings(id, name)
    setViewingLeague({ id, name: leagueName })
    setLeagueFull(list)
  }

  const viewTournament = async (tournamentId: string, tournamentName: string) => {
    const { fetchTournamentStandingsAndMatches } = await import('./lib/playerDashboardData')
    const { supabase } = await import('./lib/supabase')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const { standings, myMatches, tournamentName: tn } = await fetchTournamentStandingsAndMatches(tournamentId, session.user.id)
    setViewingTournament({ id: tournamentId, name: tournamentName })
    setTournamentDetail({ standings, myMatches, name: tn || tournamentName })
    setDetailTab('standings')
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-5 h-5" /> Voltar
      </button>
      <h1 className="text-xl font-bold text-gray-900">Competir</h1>
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium ${activeTab === 'upcoming' ? 'bg-red-600 text-white' : 'text-gray-600'}`}
        >
          Próximos torneios
        </button>
        <button
          onClick={() => setActiveTab('mine')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium ${activeTab === 'mine' ? 'bg-red-600 text-white' : 'text-gray-600'}`}
        >
          Os seus Torneios/Ligas
        </button>
      </div>

      {activeTab === 'upcoming' && (
        <div className="space-y-3">
          {loadingUpcoming ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : upcomingFromTour.length > 0 ? (
            upcomingFromTour.map((t) => (
              <div key={t.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{t.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{formatDate(t.start_date)}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {t.status === 'active' ? 'Aberto' : t.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-2">Inscrições na Padel One Tour</p>
              </div>
            ))
          ) : (
            <div className="card p-6 text-center text-gray-500">
              Nenhum torneio próximo do clube. Consulta a Padel One Tour para mais torneios.
            </div>
          )}
        </div>
      )}

      {activeTab === 'mine' && (
        <div className="space-y-4">
          {d?.upcomingTournaments && d.upcomingTournaments.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Os seus torneios (próximos)</h2>
              <div className="space-y-2">
                {d.upcomingTournaments.map((t) => (
                  <div key={t.id} className="card p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{t.name}</h3>
                      <p className="text-sm text-gray-500">{formatDate(t.start_date)}</p>
                    </div>
                    <button onClick={() => viewTournament(t.id, t.name)} className="text-red-600 text-sm font-medium">Ver classificação</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {d?.pastTournaments && d.pastTournaments.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Os seus torneios (histórico)</h2>
              <div className="space-y-2">
                {d.pastTournaments.map((t) => (
                  <div key={t.id} className="card p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{t.name}</h3>
                      <p className="text-sm text-gray-500">{formatDate(t.start_date)}</p>
                    </div>
                    <button onClick={() => viewTournament(t.id, t.name)} className="text-red-600 text-sm font-medium flex items-center gap-1">
                      <Trophy className="w-4 h-4" /> Ver classificação
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {d?.leagueStandings && d.leagueStandings.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Classificação nas Ligas</h2>
              <div className="space-y-2">
                {d.leagueStandings.map((s, idx) => (
                  <div key={idx} className="card p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{s.league_name}</h3>
                      <p className="text-sm text-gray-500">{s.position}º de {s.total_participants} · {s.points} pts</p>
                    </div>
                    <button onClick={() => viewLeague(s.league_id, s.league_name)} className="text-red-600 text-sm font-medium flex items-center gap-1">
                      Ver todos <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(!d?.upcomingTournaments?.length && !d?.pastTournaments?.length && !d?.leagueStandings?.length) && (
            <div className="card p-8 text-center">
              <Trophy className="w-16 h-16 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">Ainda não tens torneios nem ligas.</p>
              <p className="text-sm text-gray-400 mt-1">Inscreve-te em torneios na Padel One Tour.</p>
            </div>
          )}
        </div>
      )}

      {/* Modais Liga e Torneio (mesmo que no Home) */}
      {viewingLeague && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">{viewingLeague.name}</h2>
              <button onClick={() => setViewingLeague(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="overflow-y-auto max-h-[70vh]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-center">Pts</th>
                    <th className="px-3 py-2 text-center">Torneios</th>
                  </tr>
                </thead>
                <tbody>
                  {leagueFull.map((row) => (
                    <tr key={row.position} className={`border-t ${row.is_current_player ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-2">{row.position}</td>
                      <td className="px-3 py-2 font-medium">
                        {row.entity_name}
                        {row.is_current_player && <span className="ml-1 text-xs bg-red-100 text-red-600 px-1.5 rounded">Tu</span>}
                      </td>
                      <td className="px-3 py-2 text-center">{row.total_points}</td>
                      <td className="px-3 py-2 text-center">{row.tournaments_played}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Jogos</h1>
        <button className="text-red-600 text-sm font-medium flex items-center gap-1">
          Ver tudo <ChevronRight className="w-4 h-4" />
        </button>
      </div>

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
        <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth games-horizontal-scroll">
          <div className="flex gap-4" style={{ width: 'max-content' }}>
            {list.map((match) => (
              <div key={match.id} className="snap-center">
                <GameCardPlaytomic match={match} />
              </div>
            ))}
          </div>
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
}: {
  player: PlayerAccount | null
  onLogout: () => void
  onSaveFavoriteClub: (clubId: string | null) => Promise<void>
}) {
  const [clubs, setClubs] = useState<ClubDetail[]>([])
  const [loadingClubs, setLoadingClubs] = useState(true)
  const favoriteClubId = player?.favorite_club_id ?? localStorage.getItem('padel_one_player_favorite_club_id')

  useEffect(() => {
    fetchAllClubs().then((list) => {
      setClubs(list)
      setLoadingClubs(false)
    }).catch(() => setLoadingClubs(false))
  }, [])

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
          <button className="absolute bottom-0 right-0 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
            <Camera className="w-4 h-4 text-white" />
          </button>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mt-3">{player?.name || 'Jogador'}</h2>
        <p className="text-gray-500 text-sm">{player?.phone}</p>
        
        {/* Level Badge */}
        <div className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-red-50 rounded-full">
          <Target className="w-4 h-4 text-red-600" />
          <span className="font-semibold text-red-600">Nível {player?.level?.toFixed(1) || '3.0'}</span>
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

      {/* Menu Items */}
      <div className="card divide-y divide-gray-100">
        <MenuItem icon={Edit2} label="Editar Perfil" />
        <MenuItem icon={Target} label="Preferências de Jogo" />
        <MenuItem icon={Bell} label="Notificações" />
        <MenuItem icon={Settings} label="Definições" />
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
