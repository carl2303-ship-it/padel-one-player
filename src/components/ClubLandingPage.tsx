import {
  Trophy,
  Calendar,
  BarChart3,
  Users,
  CreditCard,
  Gift,
  Smartphone,
  ArrowRight,
  Mail,
  ChevronRight,
  HelpCircle,
  ExternalLink,
  Building2,
  GraduationCap,
  ShoppingBag,
  MessageCircle,
} from 'lucide-react'

const apps = [
  {
    name: 'Padel One Player',
    tagline: 'A app dos jogadores',
    url: 'https://padel1.app',
    color: 'from-red-500 to-orange-500',
    icon: Smartphone,
    features: [
      'Reserva de campos online',
      'Encontrar jogos e jogadores',
      'Torneios e ligas',
      'Comunidade e feed social',
      'Sistema de recompensas',
      'Pagamentos integrados',
    ],
  },
  {
    name: 'Padel One Tour',
    tagline: 'Gestão de torneios',
    url: 'https://tour.padel1.app',
    color: 'from-emerald-500 to-teal-500',
    icon: Trophy,
    features: [
      'Americanos, Grupos, Eliminatórias',
      'Categorias e formatos flexíveis',
      'Geração automática de jogos',
      'Classificações e standings',
      'Sistema de ligas multi-torneio',
      'Exportação PDF de resultados',
    ],
  },
  {
    name: 'Padel One Manager',
    tagline: 'Gestão completa do clube',
    url: 'https://manager.padel1.app',
    color: 'from-blue-500 to-indigo-500',
    icon: Building2,
    features: [
      'Gestão de campos e reservas',
      'Gestão de bar e contas',
      'Academia e tipos de aula',
      'Métricas e relatórios',
      'Precário público online',
      'Staff e permissões',
    ],
  },
]

const benefits = [
  {
    icon: BarChart3,
    title: 'Digitalização total',
    desc: 'Deixa de usar papel e WhatsApp. Toda a gestão do clube numa plataforma integrada.',
  },
  {
    icon: Users,
    title: 'Engagement dos jogadores',
    desc: 'Os jogadores usam a app diariamente para reservar, jogar e interagir. Mais actividade no teu clube.',
  },
  {
    icon: CreditCard,
    title: 'Pagamentos simplificados',
    desc: 'Pagamentos online de reservas, torneios e consumos no bar. Stripe integrado.',
  },
  {
    icon: Gift,
    title: 'Programa de recompensas',
    desc: 'Fideliza jogadores com pontos e prémios. Cada jogo, torneio e consumo gera pontos.',
  },
  {
    icon: GraduationCap,
    title: 'Academia integrada',
    desc: 'Gere aulas pontuais, packs e aulas de grupo. Os jogadores inscrevem-se directamente pela app.',
  },
  {
    icon: ShoppingBag,
    title: 'Gestão de bar',
    desc: 'Cria contas, adiciona itens, controla consumos e gera relatórios do bar do clube.',
  },
]

export default function ClubLandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/icon.png" alt="Padel One" className="w-9 h-9 rounded-xl" />
            <span className="font-bold text-lg text-gray-900">PADEL ONE</span>
            <span className="text-xs font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 ml-1">CLUBES</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/"
              className="px-4 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition"
            >
              Sou Jogador
            </a>
            <a
              href="mailto:info@boostpadel.store"
              className="px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all"
            >
              Contactar
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-200 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur rounded-full px-4 py-1.5 mb-6 border border-blue-100">
            <Building2 className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-700">Para Clubes de Padel</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 leading-tight mb-6">
            O universo{' '}
            <span className="bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
              Padel One
            </span>
            <br />
            para o teu clube
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            3 aplicações integradas para digitalizar o teu clube: gestão de reservas, torneios, bar, academia, comunidade e muito mais.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:info@boostpadel.store"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl hover:shadow-xl hover:shadow-blue-200 transition-all hover:-translate-y-0.5"
            >
              <Mail className="w-5 h-5" />
              Contacte-nos
            </a>
            <a
              href="https://wa.me/351969365059"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold text-gray-700 bg-white rounded-2xl border-2 border-gray-200 hover:border-green-300 hover:shadow-lg transition-all"
            >
              <MessageCircle className="w-5 h-5 text-green-500" />
              WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* 3 Apps */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              3 Apps, 1 Ecossistema
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              Cada aplicação resolve uma necessidade específica. Juntas, transformam a gestão do teu clube.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {apps.map((app) => (
              <div
                key={app.name}
                className="group rounded-3xl border border-gray-100 hover:border-gray-200 hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                <div className={`bg-gradient-to-br ${app.color} p-6 text-white`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <app.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{app.name}</h3>
                      <p className="text-sm opacity-80">{app.tagline}</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <ul className="space-y-3 mb-6">
                    {app.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                        <ChevronRight className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 transition"
                  >
                    Abrir {app.name.split(' ').pop()}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              Porque escolher o Padel One
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              Benefícios reais para o dia-a-dia do teu clube.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="group p-6 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                  <b.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{b.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-6">
            Pronto para digitalizar o teu clube?
          </h2>
          <p className="text-lg text-white/80 max-w-xl mx-auto mb-10">
            Contacta-nos e descobre como o Padel One pode transformar a gestão do teu clube de padel.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:info@boostpadel.store"
              className="inline-flex items-center justify-center gap-2 px-10 py-4 text-lg font-bold text-blue-600 bg-white rounded-2xl hover:shadow-xl transition-all hover:-translate-y-0.5"
            >
              <Mail className="w-5 h-5" />
              info@boostpadel.store
            </a>
            <a
              href="https://wa.me/351969365059"
              className="inline-flex items-center justify-center gap-2 px-10 py-4 text-lg font-bold text-white border-2 border-white/30 rounded-2xl hover:bg-white/10 transition-all"
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp
            </a>
          </div>
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
                O ecossistema completo para clubes de padel. 3 aplicações, 1 plataforma integrada.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-8">
              <div>
                <h4 className="font-semibold text-white text-sm mb-3">Apps</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="https://padel1.app" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Player</a></li>
                  <li><a href="https://tour.padel1.app" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Tour</a></li>
                  <li><a href="https://manager.padel1.app" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Manager</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm mb-3">Links</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="https://padel1.app/help/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition inline-flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" /> Centro de Ajuda
                    </a>
                  </li>
                  <li>
                    <a href="/" className="hover:text-white transition">Sou Jogador</a>
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
