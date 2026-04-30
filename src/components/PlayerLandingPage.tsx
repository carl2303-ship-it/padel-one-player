import {
  Calendar,
  Search,
  Trophy,
  Users,
  GraduationCap,
  Gift,
  TrendingUp,
  ChevronRight,
  HelpCircle,
  Mail,
  ArrowRight,
} from 'lucide-react'

const features = [
  {
    icon: Calendar,
    title: 'Reservar Campo',
    desc: 'Reserva campos no teu clube favorito em 5 passos simples. Escolhe data, hora, campo e jogadores.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    icon: Search,
    title: 'Encontrar Jogo',
    desc: 'Procura jogos abertos compatíveis com o teu nível ou cria o teu próprio jogo público.',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    icon: Trophy,
    title: 'Competir',
    desc: 'Inscreve-te em torneios e ligas. Acompanha a tua classificação e sobe no ranking.',
    color: 'from-amber-500 to-amber-600',
  },
  {
    icon: Users,
    title: 'Comunidade',
    desc: 'Segue jogadores, partilha publicações e descobre parceiros para os teus jogos.',
    color: 'from-purple-500 to-purple-600',
  },
  {
    icon: GraduationCap,
    title: 'Aprender',
    desc: 'Encontra aulas de padel no teu clube. Evolui a tua técnica com os melhores treinadores.',
    color: 'from-rose-500 to-rose-600',
  },
  {
    icon: Gift,
    title: 'Recompensas',
    desc: 'Ganha pontos a cada jogo, torneio e consumo no bar. Troca por prémios reais no teu clube.',
    color: 'from-orange-500 to-orange-600',
  },
]

const steps = [
  {
    num: '1',
    title: 'Cria a tua conta',
    desc: 'Regista-te em 2 minutos. Responde ao questionário de nível para o sistema calcular o teu ponto de partida.',
  },
  {
    num: '2',
    title: 'Encontra jogos e reserva',
    desc: 'Procura jogos abertos compatíveis com o teu nível ou reserva um campo e convida os teus amigos.',
  },
  {
    num: '3',
    title: 'Compete e evolui',
    desc: 'Joga torneios, sobe nas ligas e vê o teu nível ELO evoluir automaticamente com cada resultado.',
  },
]

export default function PlayerLandingPage({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/icon.png" alt="Padel One" className="w-9 h-9 rounded-xl" />
            <span className="font-bold text-lg text-gray-900">PADEL ONE</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onLogin}
              className="px-4 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition"
            >
              Entrar
            </button>
            <button
              onClick={onRegister}
              className="px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-red-500 to-red-600 rounded-xl hover:shadow-lg hover:shadow-red-200 transition-all"
            >
              Criar Conta
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-200 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-orange-200 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur rounded-full px-4 py-1.5 mb-6 border border-red-100">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-gray-700">A tua app de Padel</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 leading-tight mb-6">
            Tudo sobre o teu{' '}
            <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
              Padel
            </span>
            <br />
            numa só app
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Reserva campos, encontra jogos, compete em torneios e ligas, acompanha o teu nível e faz parte da maior comunidade de padel.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onRegister}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-red-500 to-red-600 rounded-2xl hover:shadow-xl hover:shadow-red-200 transition-all hover:-translate-y-0.5"
            >
              Começar Agora
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={onLogin}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold text-gray-700 bg-white rounded-2xl border-2 border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all"
            >
              Já tenho conta
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              Tudo o que precisas para jogar
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              Uma plataforma completa para a tua vida de jogador de padel.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="group p-6 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              Como funciona
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              Em 3 passos simples, estás pronto para jogar.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.num} className="relative text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg">
                  <span className="text-2xl font-black text-white">{s.num}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{s.title}</h3>
                <p className="text-gray-500 leading-relaxed">{s.desc}</p>
                {s.num !== '3' && (
                  <ChevronRight className="hidden md:block absolute top-8 -right-4 w-8 h-8 text-gray-300" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ELO System */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 md:p-14 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl" />
            <div className="relative flex flex-col md:flex-row items-center gap-10">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 mb-5">
                  <TrendingUp className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-semibold text-red-300">Sistema ELO</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black mb-4 leading-tight">
                  O teu nível evolui<br />a cada jogo
                </h2>
                <p className="text-gray-300 leading-relaxed mb-6">
                  O Padel One usa um sistema ELO para calcular o teu nível de 0.5 a 7.0. Começa com um questionário de avaliação e depois o sistema ajusta automaticamente com base nos teus resultados. Vitórias contra jogadores mais fortes fazem o teu nível subir mais rapidamente.
                </p>
                <div className="flex flex-wrap gap-3">
                  {['Nível 0.5 - 7.0', 'Ajuste automático', 'Jogos equilibrados'].map((tag) => (
                    <span key={tag} className="px-3 py-1.5 bg-white/10 rounded-lg text-sm font-medium text-gray-200">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="w-48 h-48 bg-gradient-to-br from-red-500 to-orange-500 rounded-3xl flex flex-col items-center justify-center shadow-2xl">
                  <span className="text-5xl font-black">4.5</span>
                  <span className="text-sm font-semibold opacity-80 mt-1">Nível ELO</span>
                  <div className="flex items-center gap-1 mt-2 bg-white/20 rounded-full px-3 py-1">
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-xs font-bold">+0.3</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-red-500 to-orange-500">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-6">
            Pronto para jogar?
          </h2>
          <p className="text-lg text-white/80 max-w-xl mx-auto mb-10">
            Junta-te à comunidade Padel One. Cria a tua conta grátis e começa a jogar hoje.
          </p>
          <button
            onClick={onRegister}
            className="inline-flex items-center gap-2 px-10 py-4 text-lg font-bold text-red-600 bg-white rounded-2xl hover:shadow-xl transition-all hover:-translate-y-0.5"
          >
            Criar Conta Grátis
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img src="/icon.png" alt="Padel One" className="w-8 h-8 rounded-lg" />
                <span className="font-bold text-white text-lg">PADEL ONE</span>
              </div>
              <p className="text-sm max-w-xs leading-relaxed">
                A plataforma completa para jogadores de padel. Reservas, jogos, torneios, rankings e comunidade.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-8">
              <div>
                <h4 className="font-semibold text-white text-sm mb-3">Links</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="https://padel1.app/help/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition inline-flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" /> Centro de Ajuda
                    </a>
                  </li>
                  <li>
                    <button onClick={onLogin} className="hover:text-white transition">Entrar</button>
                  </li>
                  <li>
                    <button onClick={onRegister} className="hover:text-white transition">Criar Conta</button>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm mb-3">Contacto</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="mailto:info@boostpadel.store" className="hover:text-white transition inline-flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> info@boostpadel.store
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm mb-3">Para Clubes</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="/clubs" className="hover:text-white transition inline-flex items-center gap-1">
                      <ChevronRight className="w-3.5 h-3.5" /> Padel One para Clubes
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 text-center text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Padel One. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  )
}
