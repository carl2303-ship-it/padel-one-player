import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Building2, Check, MapPin, Phone, Search, Star } from 'lucide-react'
import { useI18n } from '../../lib/i18nContext'
import { fetchAllClubs, type ClubDetail } from '../../lib/clubAndTournaments'

export default function ClubsListScreen({
  playerClubIds, favoriteClubId, onBack, onOpenClubDetail, onSaveFavoriteClub, onToggleClub,
}: {
  playerClubIds: string[]
  favoriteClubId: string | null
  onBack: () => void
  onOpenClubDetail: (clubId: string) => void
  onSaveFavoriteClub: (clubId: string | null) => Promise<void>
  onToggleClub: (clubId: string, add: boolean) => Promise<void>
}) {
  const { t } = useI18n()
  const [clubs, setClubs] = useState<ClubDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchAllClubs().then(list => { setClubs(list); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const sortedClubs = useMemo(() => {
    const fav: ClubDetail[] = []
    const selected: ClubDetail[] = []
    const rest: ClubDetail[] = []
    clubs.forEach(c => {
      if (c.id === favoriteClubId) fav.push(c)
      else if (playerClubIds.includes(c.id)) selected.push(c)
      else rest.push(c)
    })
    return [...fav, ...selected, ...rest]
  }, [clubs, favoriteClubId, playerClubIds])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sortedClubs
    const q = searchQuery.toLowerCase()
    return sortedClubs.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.city && c.city.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    )
  }, [sortedClubs, searchQuery])

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Clubes</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Pesquisar clubes..."
          className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{searchQuery ? 'Nenhum clube encontrado' : t.settings.noClubsAvailable}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(club => {
            const isSelected = playerClubIds.includes(club.id)
            const isFavorite = favoriteClubId === club.id
            const coverImg = club.photo_url_1 || club.cover_image_url || club.logo_url
            return (
              <div
                key={club.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onOpenClubDetail(club.id)}
              >
                <div className="relative h-44 bg-gradient-to-br from-gray-100 to-gray-200">
                  {coverImg ? (
                    <img src={coverImg} alt={club.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="w-16 h-16 text-gray-300" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {isFavorite && (
                    <div className="absolute top-3 left-3 flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      <Star className="w-3 h-3 fill-white" /> Favorito
                    </div>
                  )}
                  {isSelected && !isFavorite && (
                    <div className="absolute top-3 left-3 flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      <Check className="w-3 h-3" /> Selecionado
                    </div>
                  )}
                  {club.logo_url && coverImg !== club.logo_url && (
                    <div className="absolute bottom-3 left-4 w-12 h-12 rounded-xl bg-white shadow-lg overflow-hidden border-2 border-white">
                      <img src={club.logo_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="absolute bottom-3 left-4" style={club.logo_url && coverImg !== club.logo_url ? { left: '4.5rem' } : {}}>
                    <h3 className="text-white font-bold text-lg drop-shadow-md leading-tight">{club.name}</h3>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {club.address && (
                        <div className="flex items-start gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                          <span className="truncate">{club.address}{club.city ? `, ${club.city}` : ''}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {club.num_courts && (
                          <span className="flex items-center gap-1">
                            <span className="font-semibold text-gray-700">{club.num_courts}</span> campos
                          </span>
                        )}
                        {club.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {club.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        if (isSelected && !isFavorite) {
                          onSaveFavoriteClub(club.id)
                        } else if (!isSelected) {
                          onToggleClub(club.id, true)
                        }
                      }}
                      className={`shrink-0 p-2 rounded-full transition-colors ${isFavorite ? 'text-amber-500' : isSelected ? 'text-red-500 hover:text-amber-500' : 'text-gray-300 hover:text-red-500'}`}
                    >
                      <Star className={`w-5 h-5 ${isFavorite ? 'fill-amber-500' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

