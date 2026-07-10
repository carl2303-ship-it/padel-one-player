import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
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
  Check,
  Bot,
  Zap,
  Instagram,
  Globe,
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

const DEFAULT_PACKS = [
  {
    code: 'light',
    name: 'Pack Light',
    tagline: 'Mantém a tua app de reservas actual',
    description: 'O plano perfeito para os clubes que querem ficar com a sua aplicação actual de Gestão de Reservas!',
    price_monthly: 89,
    price_annual: 990,
    compare_price_monthly: 129,
    compare_price_annual: 1548,
    landing_features: [
      'Módulo 1 — Tour + App Player Light',
      'Módulo 3 — Agente IA Light',
      'Módulo 4 — Gestão de Bar com QR Code',
    ],
    is_popular: false,
  },
  {
    code: 'total',
    name: 'Pack Padel One Total',
    tagline: 'Independência digital completa',
    description: 'A solução definitiva de independência digital. Substitui por completo qualquer software concorrente e automatiza a receção a 100% via Inteligência Artificial.',
    price_monthly: 149,
    price_annual: 1590,
    compare_price_monthly: 219,
    compare_price_annual: 2199,
    landing_features: [
      'TODOS OS MÓDULOS (1, 2, 3 e 4)',
      'Manager + App Player completa',
      'Gestão de Bar com QR Code',
      'Agente IA Completo — reserva automática de campos',
    ],
    is_popular: true,
  },
];

interface PlatformPack {
  code: string;
  name: string;
  tagline: string | null;
  description: string | null;
  price_monthly: number;
  price_annual: number;
  compare_price_monthly: number | null;
  compare_price_annual: number | null;
  landing_features: string[];
  is_popular: boolean;
}

const aiChannels = [
  { icon: MessageCircle, name: 'WhatsApp', desc: 'Responde automaticamente a mensagens dos clientes' },
  { icon: Instagram, name: 'Instagram', desc: 'Responde a DMs e comentários no Instagram do clube' },
  { icon: Globe, name: 'Facebook', desc: 'Gere mensagens no Messenger do clube' },
  { icon: Mail, name: 'Email', desc: 'Responde a emails de reservas e dúvidas' },
  { icon: Globe, name: 'Website', desc: 'Chat ao vivo no site do clube' },
]

export default function ClubLandingPage() {
  const [packs, setPacks] = useState<PlatformPack[]>(DEFAULT_PACKS as PlatformPack[]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.rpc('get_active_packs_public');
      if (data && data.length > 0) {
        setPacks(data.map((p: PlatformPack) => ({
          ...p,
          price_monthly: Number(p.price_monthly),
          price_annual: Number(p.price_annual),
          compare_price_monthly: p.compare_price_monthly != null ? Number(p.compare_price_monthly) : null,
          compare_price_annual: p.compare_price_annual != null ? Number(p.compare_price_annual) : null,
        })));
      }
    };
    load();
  }, []);

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

      {/* AI Agent */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-purple-50 rounded-full px-4 py-1.5 mb-4 border border-purple-100">
              <Bot className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium text-purple-700">Novo</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              AI Agent para o teu clube
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Um assistente inteligente que responde automaticamente a todas as questões dos teus clientes, 24/7. Simplifica a vida do gerente do clube.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="space-y-4">
                {aiChannels.map((ch) => (
                  <div
                    key={ch.name}
                    className="flex items-start gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shrink-0">
                      <ch.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{ch.name}</h4>
                      <p className="text-xs text-gray-500">{ch.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-3xl p-8 border border-purple-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Bot className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Padel One AI</h3>
                  <p className="text-sm text-gray-500">O teu assistente virtual</p>
                </div>
              </div>
              <ul className="space-y-3">
                {[
                  'Responde a perguntas sobre horários e disponibilidade',
                  'Informa sobre preços, aulas e torneios',
                  'Ajuda jogadores a fazer reservas',
                  'Disponível 24 horas por dia, 7 dias por semana',
                  'Aprende com os dados do teu clube',
                  'Reduz o trabalho manual do gerente em 80%',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <Zap className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6 p-3 bg-white/60 rounded-xl border border-purple-100">
                <p className="text-xs text-purple-600 font-semibold text-center">
                  Incluído no Pack Padel One Total — variante completa com reservas automáticas
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Packs */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              Escolhe o teu Pack
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto mb-8">
              Dois packs pensados para clubes — com tudo o que precisas, a preço especial face aos módulos individuais.
            </p>
            <div className="inline-flex items-center bg-white rounded-xl p-1 border border-gray-200 shadow-sm">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  billingCycle === 'monthly' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Mensal
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  billingCycle === 'annual' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Anual
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {packs.map((pack) => {
              const price = billingCycle === 'monthly' ? pack.price_monthly : pack.price_annual;
              const compare = billingCycle === 'monthly' ? pack.compare_price_monthly : pack.compare_price_annual;
              const period = billingCycle === 'monthly' ? '/mês' : '/ano';
              const savings = compare && compare > price
                ? Math.round((1 - price / compare) * 100)
                : null;

              return (
                <div
                  key={pack.code}
                  className={`relative rounded-3xl bg-white border-2 overflow-hidden transition-all hover:shadow-xl ${
                    pack.is_popular ? 'border-blue-500 shadow-lg scale-[1.02]' : 'border-gray-100'
                  }`}
                >
                  {pack.is_popular && (
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-center text-xs font-bold py-1.5">
                      Mais Completo
                    </div>
                  )}
                  <div className={`p-8 ${pack.is_popular ? 'pt-10' : ''}`}>
                    <h3 className="text-2xl font-black text-gray-900 mb-1">{pack.name}</h3>
                    {pack.tagline && (
                      <p className="text-sm font-medium text-blue-600 mb-3">{pack.tagline}</p>
                    )}
                    <p className="text-sm text-gray-500 mb-6 leading-relaxed">{pack.description}</p>

                    <div className="mb-6">
                      {compare != null && (
                        <p className="text-sm text-gray-400 line-through mb-1">
                          {compare.toFixed(2).replace('.00', '')}€{period}
                          <span className="text-xs ml-2 no-underline text-gray-400">(módulos individuais)</span>
                        </p>
                      )}
                      <div className="flex items-end gap-1">
                        <span className="text-5xl font-black text-gray-900">
                          {price.toFixed(2).replace('.00', '')}€
                        </span>
                        <span className="text-sm text-gray-400 mb-2">{period}</span>
                      </div>
                      {savings != null && billingCycle === 'monthly' && (
                        <p className="text-xs text-green-600 font-semibold mt-1">Poupa {savings}% vs módulos individuais</p>
                      )}
                    </div>

                    <ul className="space-y-3 mb-8">
                      {(pack.landing_features || []).map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                          <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <a
                      href={`mailto:info@boostpadel.store?subject=${encodeURIComponent(`Interesse no ${pack.name}`)}`}
                      className={`block text-center py-4 rounded-xl text-sm font-bold transition-all ${
                        pack.is_popular
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-200'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      Contactar — {pack.name}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">
            Preços sem IVA. Pagamento mensal ou anual via Stripe.
          </p>
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
