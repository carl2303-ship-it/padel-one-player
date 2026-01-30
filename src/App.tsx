import { useState, useEffect } from 'react'
import { supabase, PlayerAccount, Tournament } from './lib/supabase'
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
  Users,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Settings,
  Edit2,
  Camera,
  BookOpen,
  Gamepad2,
  Menu,
  X
} from 'lucide-react'

type Screen = 'home' | 'games' | 'profile'

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

  // Data states
  const [upcomingTournaments, setUpcomingTournaments] = useState<Tournament[]>([])
  const [playerMatches, setPlayerMatches] = useState<any[]>([])

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    setIsLoading(true)
    const savedPhone = localStorage.getItem('padel_one_player_phone')
    
    if (savedPhone) {
      const { data, error } = await supabase
        .from('player_accounts')
        .select('*')
        .eq('phone', savedPhone)
        .single()
      
      if (data && !error) {
        setPlayer(data)
        setIsAuthenticated(true)
        await loadPlayerData(data.id)
      }
    }
    setIsLoading(false)
  }

  const loadPlayerData = async (playerId: string) => {
    // Load upcoming tournaments
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('*')
      .gte('start_date', new Date().toISOString().split('T')[0])
      .order('start_date', { ascending: true })
      .limit(5)
    
    if (tournaments) setUpcomingTournaments(tournaments)

    // Load player's upcoming matches
    const { data: matches } = await supabase
      .from('players')
      .select(`
        id,
        team_id,
        tournament_id,
        tournaments (
          id,
          name,
          start_date,
          location
        )
      `)
      .eq('account_id', playerId)
    
    if (matches) setPlayerMatches(matches)
  }

  const handleLogin = async () => {
    setAuthError('')
    setIsAuthLoading(true)
    
    let normalizedPhone = phone.trim().replace(/\s+/g, '')
    if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+351' + normalizedPhone
    }

    try {
      const { data, error } = await supabase
        .from('player_accounts')
        .select('*')
        .eq('phone', normalizedPhone)
        .single()
      
      if (error || !data) {
        setAuthError('Telefone não encontrado')
        setIsAuthLoading(false)
        return
      }

      if (data.password !== password) {
        setAuthError('Password incorreta')
        setIsAuthLoading(false)
        return
      }

      localStorage.setItem('padel_one_player_phone', normalizedPhone)
      setPlayer(data)
      setIsAuthenticated(true)
      await loadPlayerData(data.id)
    } catch (err) {
      setAuthError('Erro ao fazer login')
    }
    
    setIsAuthLoading(false)
  }

  const handleLogout = () => {
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

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-light">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-padel flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <div>
              <p className="text-xs text-gray-500">Olá,</p>
              <p className="font-semibold text-gray-900">{player?.name?.split(' ')[0] || 'Jogador'}</p>
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
            tournaments={upcomingTournaments}
            matches={playerMatches}
          />
        )}
        {currentScreen === 'games' && <GamesScreen player={player} matches={playerMatches} />}
        {currentScreen === 'profile' && (
          <ProfileScreen player={player} onLogout={handleLogout} />
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
          <div className="w-24 h-24 rounded-3xl bg-gradient-padel flex items-center justify-center shadow-xl">
            <span className="text-4xl font-black text-white">P</span>
          </div>
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
            Ainda não tens conta?{' '}
            <a href="#" className="text-red-600 hover:underline font-medium">Regista-te</a>
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

function HomeScreen({ player, tournaments, matches }: { 
  player: PlayerAccount | null
  tournaments: Tournament[]
  matches: any[]
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Message */}
      <div className="card p-4">
        <p className="text-lg font-semibold text-gray-900">
          Hora de jogar, {player?.name?.split(' ')[0]}! 🚀
        </p>
      </div>

      {/* Quick Actions - Playtomic style */}
      <div className="grid grid-cols-4 gap-3">
        <ActionButton icon={Calendar} label="Reservar" color="lime" />
        <ActionButton icon={BookOpen} label="Aprender" color="blue" />
        <ActionButton icon={Trophy} label="Competir" color="amber" />
        <ActionButton icon={Gamepad2} label="Encontrar Jogo" color="purple" />
      </div>

      {/* Player Stats Card */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            {player?.avatar_url ? (
              <img 
                src={player.avatar_url} 
                alt="Avatar" 
                className="w-16 h-16 rounded-full object-cover border-2 border-red-100"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-padel flex items-center justify-center">
                <span className="text-white font-bold text-xl">
                  {player?.name?.charAt(0)?.toUpperCase() || 'P'}
                </span>
              </div>
            )}
            <span className="level-badge absolute -bottom-1 left-1/2 -translate-x-1/2">
              {player?.level?.toFixed(1) || '3.0'}
            </span>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{player?.name || 'Jogador'}</p>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1">
                <Award className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-gray-600">{player?.wins || 0} vitórias</span>
              </div>
              <div className="flex items-center gap-1">
                <Target className="w-4 h-4 text-red-500" />
                <span className="text-sm text-gray-600">{player?.points || 0} pts</span>
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Upcoming Matches */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Próximos Jogos</h2>
          <button className="text-red-600 text-sm font-medium flex items-center gap-1">
            Ver todos <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        {matches.length > 0 ? (
          <div className="space-y-3">
            {matches.slice(0, 3).map((match, index) => (
              <MatchCard key={index} match={match} />
            ))}
          </div>
        ) : (
          <div className="card p-6 text-center">
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">Sem jogos agendados</p>
            <button className="mt-3 px-4 py-2 btn-primary text-sm">
              Explorar Torneios
            </button>
          </div>
        )}
      </div>

      {/* Tournaments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Torneios Disponíveis</h2>
          <button className="text-red-600 text-sm font-medium flex items-center gap-1">
            Ver todos <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="space-y-3">
          {tournaments.length > 0 ? (
            tournaments.slice(0, 3).map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))
          ) : (
            <div className="card p-6 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">Nenhum torneio disponível</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionButton({ icon: Icon, label, color }: {
  icon: any
  label: string
  color: 'lime' | 'blue' | 'amber' | 'purple'
}) {
  const colorClasses = {
    lime: 'bg-lime-400',
    blue: 'bg-blue-400',
    amber: 'bg-amber-400',
    purple: 'bg-purple-400'
  }

  return (
    <button className="action-btn">
      <div className={`action-btn-icon ${colorClasses[color]}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <span className="text-xs font-medium text-gray-700">{label}</span>
    </button>
  )
}

function MatchCard({ match }: { match: any }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900">{match.tournaments?.name || 'Jogo Amigável'}</p>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {match.tournaments?.start_date ? new Date(match.tournaments.start_date).toLocaleDateString('pt-PT') : '-'}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {match.tournaments?.location || '-'}
            </span>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </div>
  )
}

function TournamentCard({ tournament }: { tournament: Tournament }) {
  return (
    <div className="card overflow-hidden">
      {tournament.image_url && (
        <img 
          src={tournament.image_url} 
          alt={tournament.name}
          className="w-full h-32 object-cover"
        />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 line-clamp-1">{tournament.name}</h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(tournament.date).toLocaleDateString('pt-PT')}
              </span>
              {tournament.start_time && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {tournament.start_time}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
              <MapPin className="w-4 h-4" />
              {tournament.location}
            </div>
          </div>
          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
            tournament.status === 'active' 
              ? 'bg-green-100 text-green-700' 
              : 'bg-gray-100 text-gray-600'
          }`}>
            {tournament.status === 'active' ? 'Aberto' : tournament.status}
          </span>
        </div>
        <button className="w-full mt-3 py-2 btn-secondary text-sm font-medium">
          Ver Detalhes
        </button>
      </div>
    </div>
  )
}

function GamesScreen({ player, matches }: { player: PlayerAccount | null, matches: any[] }) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming')

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Meus Jogos</h1>
        <button className="p-2 btn-primary rounded-lg">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        <button 
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'upcoming' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-500'
          }`}
        >
          Próximos
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'history' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-500'
          }`}
        >
          Histórico
        </button>
      </div>

      {/* Games List */}
      <div className="space-y-3">
        {matches.length > 0 ? (
          matches.map((match, index) => (
            <MatchCard key={index} match={match} />
          ))
        ) : (
          <div className="card p-8 text-center">
            <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Sem jogos agendados</h3>
            <p className="text-gray-500 text-sm mb-4">Cria um jogo ou inscreve-te num torneio</p>
            <button className="px-6 py-3 btn-primary">
              Criar Jogo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ProfileScreen({ player, onLogout }: { player: PlayerAccount | null, onLogout: () => void }) {
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
