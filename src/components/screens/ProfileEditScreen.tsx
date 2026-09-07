import { useState, useEffect } from 'react'
import { ChevronRight, Camera, GraduationCap, ExternalLink, Save, HelpCircle, Shield } from 'lucide-react'
import { useI18n } from '../../lib/i18nContext'
import { supabase, type PlayerAccount } from '../../lib/supabase'
import { geocodeAddress } from '../../lib/geocoding'

export default function ProfileEditScreen({
  player,
  onLogout: _onLogout,
  onSaveProfile,
  onOpenInfo,
}: {
  player: PlayerAccount | null
  onLogout: () => void
  onSaveProfile: (updates: Partial<PlayerAccount>) => Promise<void>
  onOpenInfo: (type: 'help' | 'howItWorks' | 'privacy') => void
}) {
  void _onLogout
  const { t } = useI18n()
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Editable fields
  const [editName, setEditName] = useState(player?.name || '')
  const [editEmail, setEditEmail] = useState(player?.email || '')
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !player?.id) return

    // Validar tamanho (max 1MB)
    if (file.size > 1 * 1024 * 1024) {
      setSaveMsg(t.settings.imageMaxSize)
      setTimeout(() => setSaveMsg(''), 3000)
      return
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      setSaveMsg(t.settings.fileMustBeImage)
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
      setSaveMsg(t.settings.photoUpdated)
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) {
      console.error('[AVATAR] Upload error:', err)
      setSaveMsg(t.settings.photoUploadError)
      setTimeout(() => setSaveMsg(''), 3000)
    } finally {
      setUploadingAvatar(false)
      // Reset input para permitir re-upload do mesmo ficheiro
      e.target.value = ''
    }
  }

  const handleSave = async () => {
    // Validar campos obrigatórios (exceto Sobre mim)
    const missing: string[] = []
    if (!editName.trim()) missing.push(t.settings.name)
    if (!editEmail.trim()) missing.push(t.settings.email)
    if (!editGender) missing.push(t.settings.gender)
    if (!editBirthDate) missing.push(t.settings.birthDate)
    if (!editLocation.trim()) missing.push(t.settings.location)
    if (!editHand) missing.push(t.settings.preferredHand)
    if (!editPosition) missing.push(t.settings.courtPosition)
    if (!editPreferredTime) missing.push(t.settings.preferredTime)

    if (missing.length > 0) {
      setSaveMsg(`${t.settings.fillRequiredFields} ${missing.join(', ')}`)
      setTimeout(() => setSaveMsg(''), 5000)
      return
    }

    setSaving(true)
    setSaveMsg('')
    try {
      const updates: Partial<PlayerAccount> = {
        name: editName.trim(),
        email: editEmail.trim(),
        gender: editGender as any,
        birth_date: editBirthDate,
        location: editLocation.trim(),
        preferred_hand: editHand as any,
        court_position: editPosition as any,
        bio: editBio.trim() || undefined,
        game_type: 'competitive',
        preferred_time: editPreferredTime as any,
      }

      if (editLocation.trim() && editLocation.trim() !== (player?.location || '')) {
        const geo = await geocodeAddress(editLocation.trim())
        if (geo) {
          ;(updates as any).lat = geo.lat
          ;(updates as any).lng = geo.lng
        }
      }

      await onSaveProfile(updates)
      setSaveMsg(t.settings.profileSaved)
      setTimeout(() => setSaveMsg(''), 3000)
    } catch {
      setSaveMsg(t.settings.saveError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Profile Header - Simples */}
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
        <h2 className="text-xl font-bold text-gray-900 mt-3">{player?.name || t.settings.player}</h2>
        <p className="text-gray-500 text-sm">{player?.phone_number || player?.phone}</p>
        
      </div>

      {/* Success/Error Message */}
      {saveMsg && (
        <div className={`text-center text-sm font-medium py-2 px-4 rounded-lg ${saveMsg.includes(t.settings.saveError) || saveMsg.includes(t.settings.fillRequiredFields) ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {saveMsg}
        </div>
      )}

      {/* Profile Edit Section - Sempre aberto */}
      <div className="card p-4 space-y-4">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.name} <span className="text-red-600">*</span></label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder={t.settings.namePlaceholder}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.email}</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder={t.settings.emailPlaceholder}
              />
            </div>

            {/* Género */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.gender} <span className="text-red-600">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'male', label: t.games.male },
                  { value: 'female', label: t.games.female },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditGender(opt.value)}
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

            {/* Data de Nascimento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.birthDate} <span className="text-red-600">*</span></label>
              <input
                type="date"
                value={editBirthDate}
                onChange={(e) => setEditBirthDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              />
            </div>

            {/* Localização */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.location} <span className="text-red-600">*</span></label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  placeholder={t.settings.locationPlaceholder}
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!navigator.geolocation) return
                    navigator.geolocation.getCurrentPosition(async (pos) => {
                      const { reverseGeocode } = await import('../../lib/geocoding')
                      const addr = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
                      if (addr) setEditLocation(addr.split(',').slice(0, 3).join(',').trim())
                    }, () => {})
                  }}
                  className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
                  title="Usar GPS"
                >
                  📍
                </button>
              </div>
            </div>

            {/* Mão Preferida */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.preferredHand} <span className="text-red-600">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'right', label: t.settings.right },
                  { value: 'left', label: t.settings.left },
                  { value: 'ambidextrous', label: t.settings.ambidextrous },
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.courtPosition} <span className="text-red-600">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'right', label: t.settings.right },
                  { value: 'left', label: t.settings.left },
                  { value: 'both', label: t.settings.both },
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

            {/* Tipo de Jogo Preferido — apenas competitivo (todos contam para ranking) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.preferredGameType}</label>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">🏆 {t.games.competitive}</p>
            </div>

            {/* Horário Preferido */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.preferredTime} <span className="text-red-600">*</span></label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'morning', label: t.common.morning },
                  { value: 'afternoon', label: t.common.afternoon },
                  { value: 'evening', label: t.common.evening },
                  { value: 'all_day', label: t.common.allDay },
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.aboutMe}</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                placeholder={t.settings.aboutMePlaceholder}
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
                  {t.settings.saveProfile}
                </>
              )}
            </button>
      </div>

      {/* Centro de Ajuda, Ajuda rápida, Como funciona, Privacidade */}
      <div className="card overflow-hidden">
        <a href="https://padel1.app/help" target="_blank" rel="noopener noreferrer" className="w-full p-4 flex items-center justify-between hover:bg-red-50 transition-colors bg-red-50/30">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-red-600" />
            <div>
              <span className="font-semibold text-gray-900 block">{t.help.helpCenter}</span>
              <span className="text-xs text-gray-500">{t.help.helpCenterDesc}</span>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-red-600" />
        </a>
        <div className="border-t border-gray-100" />
        <button onClick={() => onOpenInfo('help')} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-gray-400" />
            <span className="font-medium text-gray-900">{t.common.help}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
        <div className="border-t border-gray-100" />
        <button onClick={() => onOpenInfo('howItWorks')} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-5 h-5 text-gray-400" />
            <span className="font-medium text-gray-900">{t.howItWorks.title}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
        <div className="border-t border-gray-100" />
        <button onClick={() => onOpenInfo('privacy')} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-gray-400" />
            <span className="font-medium text-gray-900">{t.privacy.title}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

    </div>
  )
}

// ---------- Registo (Criar Conta com Questionário de Nível — 12 perguntas) ----------

// Definição das 12 perguntas do questionário (função que recebe traduções)
const getQuizQuestions = (t: typeof translations.pt): { id: string; title: string; options: { value: number; label: string }[] }[] => [
  {
    id: 'q1', title: t.register.q1Title,
    options: [
      { value: 0, label: t.register.q1o0 },
      { value: 1, label: t.register.q1o1 },
      { value: 2, label: t.register.q1o2 },
      { value: 3, label: t.register.q1o3 },
    ],
  },
  {
    id: 'q2', title: t.register.q2Title,
    options: [
      { value: 0, label: t.register.q2o0 },
      { value: 1, label: t.register.q2o1 },
      { value: 2, label: t.register.q2o2 },
      { value: 3, label: t.register.q2o3 },
    ],
  },
  {
    id: 'q3', title: t.register.q3Title,
    options: [
      { value: 0, label: t.register.q3o0 },
      { value: 1, label: t.register.q3o1 },
      { value: 2, label: t.register.q3o2 },
      { value: 3, label: t.register.q3o3 },
    ],
  },
  {
    id: 'q4', title: t.register.q4Title,
    options: [
      { value: 0, label: t.register.q4o0 },
      { value: 1, label: t.register.q4o1 },
      { value: 2, label: t.register.q4o2 },
      { value: 3, label: t.register.q4o3 },
    ],
  },
  {
    id: 'q5', title: t.register.q5Title,
    options: [
      { value: 0, label: t.register.q5o0 },
      { value: 1, label: t.register.q5o1 },
      { value: 2, label: t.register.q5o2 },
      { value: 3, label: t.register.q5o3 },
    ],
  },
  {
    id: 'q6', title: t.register.q6Title,
    options: [
      { value: 0, label: t.register.q6o0 },
      { value: 1, label: t.register.q6o1 },
      { value: 2, label: t.register.q6o2 },
      { value: 3, label: t.register.q6o3 },
    ],
  },
  {
    id: 'q7', title: t.register.q7Title,
    options: [
      { value: 0, label: t.register.q7o0 },
      { value: 1, label: t.register.q7o1 },
      { value: 2, label: t.register.q7o2 },
      { value: 3, label: t.register.q7o3 },
    ],
  },
  {
    id: 'q8', title: t.register.q8Title,
    options: [
      { value: 0, label: t.register.q8o0 },
      { value: 1, label: t.register.q8o1 },
      { value: 2, label: t.register.q8o2 },
      { value: 3, label: t.register.q8o3 },
    ],
  },
  {
    id: 'q9', title: t.register.q9Title,
    options: [
      { value: 0, label: t.register.q9o0 },
      { value: 1, label: t.register.q9o1 },
      { value: 2, label: t.register.q9o2 },
      { value: 3, label: t.register.q9o3 },
    ],
  },
  {
    id: 'q10', title: t.register.q10Title,
    options: [
      { value: 0, label: t.register.q10o0 },
      { value: 1, label: t.register.q10o1 },
      { value: 2, label: t.register.q10o2 },
      { value: 3, label: t.register.q10o3 },
    ],
  },
  {
    id: 'q11', title: t.register.q11Title,
    options: [
      { value: 0, label: t.register.q11o0 },
      { value: 1, label: t.register.q11o1 },
      { value: 2, label: t.register.q11o2 },
      { value: 3, label: t.register.q11o3 },
    ],
  },
  {
    id: 'q12', title: t.register.q12Title,
    options: [
      { value: 0, label: t.register.q12o0 },
      { value: 1, label: t.register.q12o1 },
      { value: 2, label: t.register.q12o2 },
      { value: 3, label: t.register.q12o3 },
    ],
  },
]

// Agrupar perguntas em páginas de 3 (função que recebe traduções)
const getQuizPages = (t: typeof translations.pt) => {
  const questions = getQuizQuestions(t)
  return [
    { label: t.register.quizExperience, questions: questions.slice(0, 3) },
    { label: t.register.quizTechnique, questions: questions.slice(3, 6) },
    { label: t.register.quizShots, questions: questions.slice(6, 9) },
    { label: t.register.quizStrategy, questions: questions.slice(9, 12) },
  ]
}
