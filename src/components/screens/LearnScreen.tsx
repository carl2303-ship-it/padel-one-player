import { useState, useEffect } from 'react'
import { ArrowLeft, CreditCard, ExternalLink, Globe, GraduationCap, Mail, MapPin, Phone, Plus, TrendingUp, User, Users, X } from 'lucide-react'
import { useI18n } from '../../lib/i18nContext'
import { fetchAvailableClasses, fetchMyClasses, enrollInClass, type Class as ClassData } from '../../lib/classes'

type ClassGender = 'M' | 'F' | 'Misto'

// ---------- Aprender ----------
export default function LearnScreen({
  userId,
  playerAccountId,
  onBack,
  onOpenPlayerProfile,
  onOpenClub,
}: {
  userId: string | null
  playerAccountId: string | null
  onBack: () => void
  onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
  onOpenClub: (clubId: string) => void
}) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'inscrever' | 'minhas-aulas'>('inscrever')
  const [availableClasses, setAvailableClasses] = useState<ClassData[]>([])
  const [myClasses, setMyClasses] = useState<ClassData[]>([])
  const [loading, setLoading] = useState(true)
  const [enrollingClassId, setEnrollingClassId] = useState<string | null>(null)
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null)

  // Carregar aulas disponíveis
  useEffect(() => {
    if (activeTab === 'inscrever') {
      loadAvailableClasses()
    } else if (activeTab === 'minhas-aulas' && userId) {
      loadMyClasses()
    }
  }, [activeTab, userId])

  // Atualizar automaticamente a cada 10 segundos para ver novas inscrições
  useEffect(() => {
    if (activeTab === 'inscrever') {
      const interval = setInterval(() => {
        loadAvailableClasses()
      }, 10000) // Atualizar a cada 10 segundos

      return () => clearInterval(interval)
    }
  }, [activeTab])

  const loadAvailableClasses = async () => {
    setLoading(true)
    try {
      const classes = await fetchAvailableClasses(null, userId, playerAccountId)
      setAvailableClasses(classes)
    } catch (error) {
      console.error('[LearnScreen] Error loading classes:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMyClasses = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const classes = await fetchMyClasses(userId, playerAccountId)
      setMyClasses(classes)
    } catch (error) {
      console.error('[LearnScreen] Error loading my classes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEnroll = async (classId: string) => {
    if (!userId) {
      alert(t.learn.needAuth)
      return
    }

    setEnrollingClassId(classId)
    try {
      const success = await enrollInClass(classId, userId, playerAccountId)
      if (success) {
        alert(t.learn.enrollSuccess)
        // Recarregar aulas em ambas as tabs para garantir que todos veem a atualização
        await loadAvailableClasses()
        if (userId) {
          await loadMyClasses()
        }
      } else {
        alert(t.learn.enrollError)
      }
    } catch (error) {
      console.error('[LearnScreen] Error enrolling:', error)
      alert(t.learn.enrollErrorGeneric)
    } finally {
      setEnrollingClassId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const days = t.common.dayNamesFull
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'] // TODO: traduzir meses
    return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]}`
  }

  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr)
    const days = t.common.dayNamesFull.map(d => d.toUpperCase())
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'] // TODO: traduzir meses
    return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]}`
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  const getGenderIcon = (gender: ClassGender) => {
    if (gender === 'M') return '♂'
    if (gender === 'F') return '♀'
    return '⚥'
  }

  const getGenderLabel = (gender: ClassGender) => {
    if (gender === 'M') return t.games.male
    if (gender === 'F') return t.games.female
    return t.learn.mixed
  }

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t.learn.title}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('inscrever')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'inscrever' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-500'
          }`}
        >
          {t.common.enrollMe}
        </button>
        <button
          onClick={() => setActiveTab('minhas-aulas')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'minhas-aulas' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-500'
          }`}
        >
          {t.learn.myClasses}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">{t.common.loading}</div>
        </div>
      ) : (
        <>
          {activeTab === 'inscrever' && (
            <div className="space-y-4">
              {availableClasses.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {t.learn.noClassesAvailable}
                </div>
              ) : (
                availableClasses.map((classItem) => (
                  <ClassCard 
                    key={classItem.id} 
                    classItem={classItem} 
                    formatDate={formatDate} 
                    formatDateShort={formatDateShort}
                    formatTime={formatTime}
                    getGenderIcon={getGenderIcon} 
                    getGenderLabel={getGenderLabel}
                    onEnroll={handleEnroll}
                    isEnrolling={enrollingClassId === classItem.id}
                    onOpenPlayerProfile={onOpenPlayerProfile}
                    onOpenClub={onOpenClub}
                    onClick={() => setSelectedClass(classItem)}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'minhas-aulas' && (
            <div className="space-y-4">
              {myClasses.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {t.learn.noClassesEnrolled}
                </div>
              ) : (
                myClasses.map((classItem) => (
                  <ClassCard 
                    key={classItem.id} 
                    classItem={classItem} 
                    formatDate={formatDate} 
                    formatDateShort={formatDateShort}
                    formatTime={formatTime}
                    getGenderIcon={getGenderIcon} 
                    getGenderLabel={getGenderLabel}
                    isMyClass={true}
                    onOpenPlayerProfile={onOpenPlayerProfile}
                    onOpenClub={onOpenClub}
                    onClick={() => setSelectedClass(classItem)}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Modal de detalhes da aula */}
      {selectedClass && (
        <ClassDetailsModal
          classItem={selectedClass}
          formatDate={formatDate}
          formatTime={formatTime}
          getGenderIcon={getGenderIcon}
          getGenderLabel={getGenderLabel}
          onClose={() => setSelectedClass(null)}
          onOpenPlayerProfile={onOpenPlayerProfile}
          onOpenClub={onOpenClub}
        />
      )}
    </div>
  )
}

// Componente de Modal de Detalhes da Aula
function ClassDetailsModal({
  classItem,
  formatDate,
  formatTime,
  getGenderIcon,
  getGenderLabel,
  onClose,
  onOpenPlayerProfile,
  onOpenClub,
}: {
  classItem: ClassData
  formatDate: (dateStr: string) => string
  formatTime: (dateStr: string) => string
  getGenderIcon: (gender: ClassGender) => string
  getGenderLabel: (gender: ClassGender) => string
  onClose: () => void
  onOpenPlayerProfile?: (userId: string) => void
  onOpenClub?: (clubId: string) => void
}) {
  const { t } = useI18n()
  const { scheduled_at, title, professor, professor_phone, professor_avatar, club, club_id, level, gender, maxPlayers, participants, price, court_name, notes, club_address, club_city, club_phone, club_email, club_website } = classItem
  const timeStr = formatTime(scheduled_at)
  const filledSlots = participants.length
  const emptySlots = maxPlayers - filledSlots

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">{t.learn.classDetails}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Header da Aula */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-2xl text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-600 mb-1">
                {formatDate(scheduled_at)} às {timeStr}
              </p>
              {court_name && (
                <p className="text-sm text-gray-600">{t.common.court}: {court_name}</p>
              )}
            </div>
          </div>

          {/* Informações da Aula */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-5 h-5 text-gray-400" />
              {club_id && onOpenClub ? (
                <button
                  onClick={() => {
                    onOpenClub(club_id)
                    onClose()
                  }}
                  className="text-red-600 hover:text-red-700 hover:underline font-medium"
                >
                  {club}
                </button>
              ) : (
                <span className="text-gray-700">{club}</span>
              )}
            </div>
            {club_address && (
              <div className="flex items-start gap-3 text-sm ml-8">
                <span className="text-gray-600">{club_address}{club_city ? `, ${club_city}` : ''}</span>
              </div>
            )}
            {club_phone && (
              <div className="flex items-center gap-3 text-sm ml-8">
                <Phone className="w-4 h-4 text-gray-400" />
                <a href={`tel:${club_phone}`} className="text-blue-600 hover:underline">{club_phone}</a>
              </div>
            )}
            {club_email && (
              <div className="flex items-center gap-3 text-sm ml-8">
                <Mail className="w-4 h-4 text-gray-400" />
                <a href={`mailto:${club_email}`} className="text-blue-600 hover:underline">{club_email}</a>
              </div>
            )}
            {club_website && (
              <div className="flex items-center gap-3 text-sm ml-8">
                <Globe className="w-4 h-4 text-gray-400" />
                <a href={club_website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                  {club_website}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            <div className="flex items-center gap-3 text-sm">
              <TrendingUp className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700">{t.home.level}: <span className="font-medium">{level || (t.language === 'pt' ? 'Todos os níveis' : t.language === 'en' ? 'All levels' : t.language === 'es' ? 'Todos los niveles' : 'Tous les niveaux')}</span></span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Users className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700">{getGenderIcon(gender)} <span className="font-medium">{getGenderLabel(gender)}</span></span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <User className="w-5 h-5 text-gray-400" />
              {professor_phone && onOpenPlayerProfile ? (
                <button
                  onClick={async () => {
                    const { findPlayerUserIdByPhone } = await import('../../lib/classes')
                    const userId = await findPlayerUserIdByPhone(professor_phone)
                    if (userId) {
                      onOpenPlayerProfile(userId)
                      onClose()
                    }
                  }}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {professor_avatar ? (
                    <img
                      src={professor_avatar}
                      alt={professor}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white text-xs font-semibold">
                      {professor.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-red-600 hover:text-red-700 hover:underline font-medium">Prof. {professor === 'Sem professor' ? t.common.noProfessor : professor}</span>
                </button>
              ) : (
                <span className="text-gray-700">Prof. {professor === 'Sem professor' ? t.common.noProfessor : professor}</span>
              )}
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Users className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700">Participantes: <span className="font-medium">{filledSlots}/{maxPlayers}</span></span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <CreditCard className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700">Preço: <span className="font-medium">{price}€</span></span>
            </div>
          </div>

          {/* Notas */}
          {notes && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
            </div>
          )}

          {/* Lista de Participantes */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-semibold text-gray-900 mb-4">Participantes ({filledSlots}/{maxPlayers})</h4>
            {participants.length === 0 ? (
              <p className="text-gray-500 text-sm">Ainda não há participantes inscritos</p>
            ) : (
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    {participant.avatar_url ? (
                      <img
                        src={participant.avatar_url}
                        alt={participant.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-semibold">
                        {participant.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {participant.user_id && onOpenPlayerProfile ? (
                      <button
                        onClick={() => {
                          onOpenPlayerProfile(participant.user_id!)
                          onClose()
                        }}
                        className="flex-1 text-left text-gray-900 font-medium hover:text-red-600 transition-colors"
                      >
                        {participant.name}
                      </button>
                    ) : (
                      <span className="flex-1 text-gray-900 font-medium">{participant.name}</span>
                    )}
                  </div>
                ))}
                {Array.from({ length: emptySlots }).map((_, idx) => (
                  <div
                    key={`empty-${idx}`}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <Plus className="w-5 h-5 text-gray-400" />
                    </div>
                    <span className="text-gray-400 text-sm">Vaga disponível</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Componente de Card de Aula
function ClassCard({
  classItem,
  formatDate,
  formatDateShort,
  formatTime,
  getGenderIcon,
  getGenderLabel,
  onEnroll,
  isEnrolling,
  isMyClass = false,
  onOpenPlayerProfile,
  onOpenClub,
  onClick,
}: {
  classItem: ClassData
  formatDate: (dateStr: string) => string
  formatDateShort: (dateStr: string) => string
  formatTime: (dateStr: string) => string
  getGenderIcon: (gender: ClassGender) => string
  getGenderLabel: (gender: ClassGender) => string
  onEnroll?: (classId: string) => void
  isEnrolling?: boolean
  isMyClass?: boolean
  onOpenPlayerProfile?: (userId: string) => void
  onOpenClub?: (clubId: string) => void
  onClick?: () => void
}) {
  const { t } = useI18n()
  const { scheduled_at, title, professor, professor_phone, professor_avatar, club, club_id, level, gender, maxPlayers, participants, price } = classItem
  const dateStr = scheduled_at.split('T')[0]
  const timeStr = formatTime(scheduled_at)
  const isFull = participants.length >= maxPlayers
  const filledSlots = participants.length
  const emptySlots = maxPlayers - filledSlots
  

  return (
    <div className={`card p-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={onClick}>
      <div className="flex gap-4">
        {/* Left side - Icon */}
        <div className="flex-shrink-0">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <div className="text-center mt-2">
            <p className="text-xs font-semibold text-gray-700">Padel</p>
            <p className="text-xs text-gray-500">{t.learn.class}</p>
          </div>
        </div>

        {/* Right side - Details */}
        <div className="flex-1 min-w-0">
          {/* Date */}
          <p className="text-xs text-gray-500 mb-1">
            {formatDateShort(scheduled_at)} | {timeStr}
          </p>

          {/* Title */}
          <h3 className="font-bold text-lg text-gray-900 mb-2">{title}</h3>

          {/* Details row */}
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400" />
              {club_id && onOpenClub ? (
                <button
                  onClick={() => onOpenClub(club_id)}
                  className="text-red-600 hover:text-red-700 hover:underline font-medium"
                >
                  {club}
                </button>
              ) : (
                <span>{club}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <span className="font-medium">{t.home.level}: {level || (t.language === 'pt' ? 'Todos os níveis' : t.language === 'en' ? 'All levels' : t.language === 'es' ? 'Todos los niveles' : 'Tous les niveaux')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="font-medium">{getGenderIcon(gender)} {getGenderLabel(gender)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4 text-gray-400" />
              {professor_phone && onOpenPlayerProfile ? (
                <button
                  onClick={async () => {
                    const { findPlayerUserIdByPhone } = await import('../../lib/classes')
                    const userId = await findPlayerUserIdByPhone(professor_phone)
                    if (userId) {
                      onOpenPlayerProfile(userId)
                    }
                  }}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {professor_avatar ? (
                    <img
                      src={professor_avatar}
                      alt={professor}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white text-xs font-semibold">
                      {professor.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-red-600 hover:text-red-700 hover:underline font-medium">Prof. {professor}</span>
                </button>
              ) : (
                <span>Prof. {professor === 'Sem professor' ? t.common.noProfessor : professor}</span>
              )}
            </div>
          </div>

          {/* Players row */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              {/* Player slots */}
              <div className="flex items-center gap-1.5">
                {participants.map((participant, idx) => (
                  <div
                    key={participant.id}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white text-xs font-semibold border-2 border-white shadow-sm"
                    title={participant.name}
                  >
                    {participant.avatar_url ? (
                      <img
                        src={participant.avatar_url}
                        alt={participant.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span>{participant.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                ))}
                {Array.from({ length: emptySlots }).map((_, idx) => (
                  <div
                    key={`empty-${idx}`}
                    className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center border-2 border-white"
                  >
                    <Plus className="w-4 h-4 text-gray-400" />
                  </div>
                ))}
              </div>
              {/* Counter */}
              <span className="text-sm font-medium text-gray-600 ml-1">
                {filledSlots}/{maxPlayers}
              </span>
            </div>

            {/* Sign up button */}
            {isMyClass ? (
              <div className="px-4 py-2 bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-lg text-center">
                Inscrito
              </div>
            ) : (
              <button 
                onClick={() => onEnroll?.(classItem.id)}
                disabled={isEnrolling || isFull}
                className={`px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors ${
                  isFull 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : isEnrolling
                    ? 'bg-blue-400 cursor-wait'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isEnrolling ? t.common.enrolling : isFull ? t.common.classFull : `${t.common.enrollMe} - ${price}€`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

