import { useEffect, useState } from 'react'
import { ArrowLeft, Plus, ShoppingBag, Store } from 'lucide-react'
import {
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_CONDITIONS,
  categoryLabel,
  conditionLabel,
  fetchMarketplaceListings,
  formatPriceEur,
  type MarketplaceCategory,
  type MarketplaceCondition,
  type MarketplaceListing,
} from '../../lib/marketplace'

export default function MarketplaceScreen({
  userId,
  onBack,
  onOpenListing,
  onCreate,
}: {
  userId: string
  onBack: () => void
  onOpenListing: (id: string) => void
  onCreate: () => void
}) {
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<MarketplaceCategory | 'all'>('all')
  const [condition, setCondition] = useState<MarketplaceCondition | 'all'>('all')
  const [tab, setTab] = useState<'all' | 'mine'>('all')

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchMarketplaceListings({
      category,
      condition,
      mineOnly: tab === 'mine',
      sellerUserId: userId,
    })
      .then((rows) => {
        if (active) setListings(rows)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [category, condition, tab, userId])

  return (
    <div className="space-y-4 animate-fade-in pb-24">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Marketplace</h1>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
        >
          <Plus className="w-4 h-4" />
          Vender
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('all')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium ${
            tab === 'all' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Explorar
        </button>
        <button
          onClick={() => setTab('mine')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium ${
            tab === 'mine' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Os meus
        </button>
      </div>

      <div className="overflow-x-auto pb-1 -mx-4 px-4">
        <div className="flex gap-2" style={{ width: 'max-content' }}>
          <button
            onClick={() => setCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              category === 'all' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todas
          </button>
          {MARKETPLACE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                category === c.id ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setCondition('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium ${
            condition === 'all' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Novo + Usado
        </button>
        {MARKETPLACE_CONDITIONS.map((c) => (
          <button
            key={c.id}
            onClick={() => setCondition(c.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              condition === c.id ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">
            {tab === 'mine' ? 'Ainda não tens anúncios.' : 'Nenhum anúncio activo com estes filtros.'}
          </p>
          {tab === 'mine' && (
            <button
              onClick={onCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              Criar anúncio
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {listings.map((listing) => {
            const photo = listing.photos[0]
            return (
              <button
                key={listing.id}
                type="button"
                onClick={() => onOpenListing(listing.id)}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden text-left hover:shadow-md transition-shadow"
              >
                <div className="relative aspect-square bg-gray-100">
                  {photo ? (
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                  {listing.source === 'store' && (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-[#F5C518] text-[#0B1B2B] px-2 py-0.5 rounded-md">
                      <Store className="w-3 h-3" /> Store
                    </span>
                  )}
                  {tab === 'mine' && listing.status !== 'active' && (
                    <span className="absolute top-2 right-2 text-[10px] font-bold uppercase bg-gray-800/80 text-white px-2 py-0.5 rounded-md">
                      {listing.status === 'sold' ? 'Vendido' : 'Inactivo'}
                    </span>
                  )}
                </div>
                <div className="p-2.5 space-y-1">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{listing.title}</p>
                  <p className="text-base font-bold text-red-600">{formatPriceEur(listing.price)}</p>
                  <p className="text-[11px] text-gray-500">
                    {categoryLabel(listing.category)} · {conditionLabel(listing.condition)}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
