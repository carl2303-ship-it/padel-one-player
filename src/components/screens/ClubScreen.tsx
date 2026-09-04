import { useState, useEffect } from 'react'
import { ArrowLeft, Building2, MapPin, Phone, Mail, Globe } from 'lucide-react'
import { useI18n } from '../../lib/i18nContext'
import { fetchClubById, type ClubDetail } from '../../lib/clubAndTournaments'

export default function ClubScreen({ favoriteClubId, onBack }: { favoriteClubId: string | null; onBack: () => void }) {
  const { t } = useI18n()
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
          <ArrowLeft className="w-5 h-5" /> {t.common.back}
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
          <ArrowLeft className="w-5 h-5" /> {t.common.back}
        </button>
        <div className="card p-8 text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{t.common.noClubSelected}</p>
          <p className="text-sm text-gray-400 mt-1">{t.common.goToProfile}</p>
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
          {club.plan_type === 'preview' && (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800 font-medium">
                Este clube ainda não está ativo na Padel One. Entre em contacto com o seu clube! Obrigado.
              </p>
            </div>
          )}
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
