import { useEffect, useState } from 'react'
import { ArrowLeft, MessageCircle, ShoppingBag, Store } from 'lucide-react'
import {
  categoryLabel,
  conditionLabel,
  contactMarketplaceSeller,
  fetchMarketplaceListing,
  formatPriceEur,
  type MarketplaceListing,
} from '../../lib/marketplace'
import { checkIsSubscribed, isPushSupported } from '../../lib/pushNotifications'

export default function MarketplaceDetailScreen({
  listingId,
  myUserId,
  myPlayerAccountId,
  onBack,
  onOpenChat,
  onEdit,
}: {
  listingId: string
  myUserId: string
  myPlayerAccountId: string
  onBack: () => void
  onOpenChat: (conversationId: string, otherUserId: string) => void
  onEdit: (id: string) => void
}) {
  const [listing, setListing] = useState<MarketplaceListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [contacting, setContacting] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchMarketplaceListing(listingId)
      .then((row) => {
        if (active) {
          setListing(row)
          setPhotoIndex(0)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [listingId])

  const isMine = listing?.seller_user_id === myUserId
  const photos = listing?.photos?.length ? listing.photos : []

  const handleContact = async () => {
    if (!listing || contacting) return
    setContacting(true)
    try {
      const result = await contactMarketplaceSeller({ myUserId, listing })
      if (!result.success) {
        alert(result.error || 'Não foi possível contactar')
        return
      }
      if (result.mode === 'store_url' && result.storeUrl) {
        window.open(result.storeUrl, '_blank', 'noopener,noreferrer')
        return
      }
      if (result.conversationId && result.otherUserId) {
        // Push ao vendedor já vai via sendDirectMessage. Nudge se o comprador não tiver notificações.
        if (isPushSupported()) {
          const subscribed = await checkIsSubscribed(myPlayerAccountId).catch(() => false)
          if (!subscribed) {
            alert('Mensagem enviada. Activa as notificações no menu para saberes quando o vendedor responder.')
          }
        }
        onOpenChat(result.conversationId, result.otherUserId)
      }
    } finally {
      setContacting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="space-y-4 animate-fade-in">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <p className="text-center text-gray-500 py-12">Anúncio não encontrado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in pb-28">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1 truncate">Anúncio</h1>
        {isMine && (
          <button
            onClick={() => onEdit(listing.id)}
            className="text-sm font-semibold text-red-600 px-2 py-1"
          >
            Editar
          </button>
        )}
      </div>

      <div className="-mx-4">
        <div className="relative aspect-[4/3] bg-gray-100">
          {photos.length > 0 ? (
            <img
              src={photos[Math.min(photoIndex, photos.length - 1)]}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="w-16 h-16 text-gray-300" />
            </div>
          )}
          {listing.source === 'store' && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 text-xs font-bold uppercase bg-[#F5C518] text-[#0B1B2B] px-2.5 py-1 rounded-md">
              <Store className="w-3.5 h-3.5" /> Padel1 Store
            </span>
          )}
        </div>
        {photos.length > 1 && (
          <div className="flex gap-2 px-4 pt-3 overflow-x-auto">
            {photos.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setPhotoIndex(i)}
                className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 ${
                  i === photoIndex ? 'border-red-600' : 'border-transparent'
                }`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-900 leading-tight">{listing.title}</h2>
        <p className="text-2xl font-bold text-red-600">{formatPriceEur(listing.price)}</p>
        <div className="flex flex-wrap gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {categoryLabel(listing.category)}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {conditionLabel(listing.condition)}
          </span>
        </div>
      </div>

      {listing.description && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Descrição</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{listing.description}</p>
        </div>
      )}

      <div className="card p-4 flex items-center gap-3">
        {listing.seller_avatar ? (
          <img src={listing.seller_avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-padel flex items-center justify-center text-white font-bold">
            {(listing.seller_name || 'P').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs text-gray-500">Vendedor</p>
          <p className="font-semibold text-gray-900 truncate">
            {listing.seller_name || (listing.source === 'store' ? 'Padel1 Store' : 'Jogador')}
          </p>
        </div>
      </div>

      {!isMine && listing.status === 'active' && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-3 pt-2 bg-gradient-to-t from-white via-white to-transparent">
          <button
            onClick={handleContact}
            disabled={contacting}
            className="w-full max-w-lg mx-auto flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60"
          >
            <MessageCircle className="w-5 h-5" />
            {contacting ? 'A abrir chat…' : 'Contactar'}
          </button>
        </div>
      )}
    </div>
  )
}
