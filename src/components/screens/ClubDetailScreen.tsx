import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Building2, Check, ChevronLeft, ChevronRight, ExternalLink, Globe, Mail, MapPin, Navigation, Phone, Plus, Star } from 'lucide-react'
import { useI18n } from '../../lib/i18nContext'
import { fetchClubById, type ClubDetail } from '../../lib/clubAndTournaments'

export default function ClubDetailScreen({ clubId, onBack, isSelected, isFavorite, onToggleClub, onSaveFavoriteClub }: {
  clubId: string
  onBack: () => void
  isSelected?: boolean
  isFavorite?: boolean
  onToggleClub?: (clubId: string, add: boolean) => Promise<void>
  onSaveFavoriteClub?: (clubId: string | null) => Promise<void>
}) {
  const { t } = useI18n()
  const [club, setClub] = useState<ClubDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePhotoIdx, setActivePhotoIdx] = useState(0)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchClubById(clubId).then(data => {
      setClub(data ?? null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [clubId])

  const allPhotos = useMemo(() => {
    if (!club) return []
    const photos: string[] = []
    if (club.photo_url_1) photos.push(club.photo_url_1)
    if (club.photo_url_2 && !photos.includes(club.photo_url_2)) photos.push(club.photo_url_2)
    if (club.cover_image_url && !photos.includes(club.cover_image_url)) photos.push(club.cover_image_url)
    if (club.photos?.length) {
      club.photos.forEach(p => { if (!photos.includes(p)) photos.push(p) })
    }
    if (club.logo_url && !photos.includes(club.logo_url)) photos.push(club.logo_url)
    return photos
  }, [club])

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" /> {t.common.back}
        </button>
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!club) {
    return (
      <div className="space-y-4 animate-fade-in">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" /> {t.common.back}
        </button>
        <div className="text-center py-16">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Clube não encontrado</p>
        </div>
      </div>
    )
  }

  const hasCoordinates = club.latitude && club.longitude
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${club.latitude},${club.longitude}`
    : club.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(club.address + (club.city ? `, ${club.city}` : '') + (club.country ? `, ${club.country}` : ''))}`
      : null
  const mapsEmbedUrl = hasCoordinates
    ? `https://maps.google.com/maps?q=${club.latitude},${club.longitude}&z=15&output=embed`
    : club.address
      ? `https://maps.google.com/maps?q=${encodeURIComponent(club.address + (club.city ? `, ${club.city}` : ''))}&z=15&output=embed`
      : null

  const amenityIcons: Record<string, string> = {
    parking: '🅿️', bar: '🍺', restaurant: '🍽️', showers: '🚿',
    locker_room: '🔒', shop: '🛒', wifi: '📶', gym: '💪',
    pool: '🏊', kids: '👶', physiotherapy: '💆',
  }

  return (
    <div className="animate-fade-in -mx-4 -mt-4">
      {/* Hero photo gallery */}
      <div className="relative h-72 sm:h-80 bg-gradient-to-br from-gray-200 to-gray-300">
        {allPhotos.length > 0 ? (
          <img src={allPhotos[activePhotoIdx]} alt={club.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-20 h-20 text-gray-300" />
          </div>
        )}
        {/* Gradient overlay - pointer-events-none so buttons work */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />
        {/* Navigation arrows */}
        {allPhotos.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); setActivePhotoIdx(i => (i - 1 + allPhotos.length) % allPhotos.length) }} className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setActivePhotoIdx(i => (i + 1) % allPhotos.length) }} className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10 flex gap-2">
              {allPhotos.map((_, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); setActivePhotoIdx(i) }} className={`rounded-full transition-all ${i === activePhotoIdx ? 'bg-white w-5 h-2.5' : 'bg-white/50 w-2.5 h-2.5'}`} />
              ))}
            </div>
          </>
        )}
        {/* Photo counter */}
        {allPhotos.length > 1 && (
          <div className="absolute top-4 right-4 z-10 bg-black/50 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            {activePhotoIdx + 1} / {allPhotos.length}
          </div>
        )}
        {/* Back button */}
        <button onClick={onBack} className="absolute top-4 left-4 z-10 w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        {/* Club name over photo */}
        <div className="absolute bottom-3 left-4 right-4 z-10">
          <div className="flex items-end gap-3">
            {club.logo_url && (
              <div className="w-14 h-14 rounded-xl bg-white shadow-lg overflow-hidden border-2 border-white shrink-0">
                <img src={club.logo_url} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-white text-2xl font-bold drop-shadow-lg leading-tight">{club.name}</h1>
              {club.city && <p className="text-white/80 text-sm drop-shadow-sm">{club.city}{club.country ? `, ${club.country}` : ''}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Action buttons: Jogo aqui / Favorito */}
        {onToggleClub && (
          <div className="flex gap-3">
            <button
              disabled={toggling}
              onClick={async () => {
                setToggling(true)
                try { await onToggleClub(clubId, !isSelected) } catch {}
                setToggling(false)
              }}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                isSelected
                  ? 'bg-red-50 text-red-600 border-2 border-red-200'
                  : 'bg-red-600 text-white hover:bg-red-700'
              } ${toggling ? 'opacity-50' : ''}`}
            >
              {isSelected ? (
                <><Check className="w-4 h-4" /> Jogo aqui</>
              ) : (
                <><Plus className="w-4 h-4" /> Adicionar aos meus clubes</>
              )}
            </button>
            {isSelected && onSaveFavoriteClub && (
              <button
                onClick={async () => {
                  setToggling(true)
                  try { await onSaveFavoriteClub(isFavorite ? null : clubId) } catch {}
                  setToggling(false)
                }}
                className={`px-4 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all border-2 ${
                  isFavorite
                    ? 'bg-amber-50 text-amber-600 border-amber-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-500'
                }`}
              >
                <Star className={`w-5 h-5 ${isFavorite ? 'fill-amber-500 text-amber-500' : ''}`} />
              </button>
            )}
          </div>
        )}

        {club.plan_type === 'preview' && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-sm text-amber-800 font-medium">
              Este clube ainda não está ativo na Padel One. Entre em contacto com o seu clube!
            </p>
          </div>
        )}

        {club.description && (
          <p className="text-gray-600 text-sm leading-relaxed">{club.description}</p>
        )}

        {/* Quick info badges */}
        <div className="flex flex-wrap gap-2">
          {club.num_courts && (
            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              🏟️ {club.num_courts} {club.num_courts === 1 ? 'campo' : 'campos'}
            </div>
          )}
          {club.amenities && club.amenities.length > 0 && club.amenities.map(a => (
            <div key={a} className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-full">
              {amenityIcons[a] || '✨'} {a.charAt(0).toUpperCase() + a.slice(1).replace('_', ' ')}
            </div>
          ))}
        </div>

        {/* Contact info */}
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
          {club.address && (
            <a href={mapsUrl || '#'} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors">
              <MapPin className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{club.address}</p>
                <p className="text-xs text-gray-500">{club.city}{club.country ? `, ${club.country}` : ''}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
            </a>
          )}
          {club.phone && (
            <a href={`tel:${club.phone}`} className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
              <Phone className="w-5 h-5 text-green-600 shrink-0" />
              <span className="text-sm font-medium text-gray-900">{club.phone}</span>
            </a>
          )}
          {club.email && (
            <a href={`mailto:${club.email}`} className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
              <Mail className="w-5 h-5 text-blue-600 shrink-0" />
              <span className="text-sm font-medium text-gray-900">{club.email}</span>
            </a>
          )}
          {club.website && (
            <a href={club.website.startsWith('http') ? club.website : `https://${club.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
              <Globe className="w-5 h-5 text-purple-600 shrink-0" />
              <span className="text-sm font-medium text-gray-900 truncate">{club.website}</span>
              <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
            </a>
          )}
        </div>

        {/* Google Maps embed */}
        {mapsEmbedUrl && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500" /> Localização
            </h3>
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
              <iframe
                src={mapsEmbedUrl}
                width="100%"
                height="220"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Localização de ${club.name}`}
              />
            </div>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-sm text-red-600 font-medium hover:underline py-1">
                <Navigation className="w-4 h-4" /> Abrir no Google Maps
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

