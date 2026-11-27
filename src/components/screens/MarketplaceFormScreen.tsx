import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Bell, Camera, Trash2, X } from 'lucide-react'
import {
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_CONDITIONS,
  createMarketplaceListing,
  fetchMarketplaceListing,
  removeMarketplaceListing,
  updateMarketplaceListing,
  uploadListingPhoto,
  type MarketplaceCategory,
  type MarketplaceCondition,
} from '../../lib/marketplace'
import {
  checkIsSubscribed,
  isPushSupported,
  subscribeToPush,
} from '../../lib/pushNotifications'

const MAX_PHOTOS = 4
const MAX_PHOTO_BYTES = 5 * 1024 * 1024

export default function MarketplaceFormScreen({
  listingId,
  userId,
  playerAccountId,
  onBack,
  onSaved,
}: {
  listingId: string | null
  userId: string
  playerAccountId: string
  onBack: () => void
  onSaved: (id: string) => void
}) {
  const isEdit = Boolean(listingId)
  const fileRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [pushReminderListingId, setPushReminderListingId] = useState<string | null>(null)
  const [pushEnabling, setPushEnabling] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<MarketplaceCategory>('raquetes')
  const [condition, setCondition] = useState<MarketplaceCondition>('usado')
  const [price, setPrice] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [status, setStatus] = useState<'active' | 'sold'>('active')

  useEffect(() => {
    if (!listingId) return
    let active = true
    setLoading(true)
    fetchMarketplaceListing(listingId)
      .then((row) => {
        if (!active || !row) return
        if (row.seller_user_id !== userId || row.source !== 'player') {
          setError('Só podes editar os teus anúncios.')
          return
        }
        setTitle(row.title)
        setDescription(row.description || '')
        setCategory(row.category)
        setCondition(row.condition)
        setPrice(String(row.price))
        setPhotos(row.photos || [])
        setStatus(row.status === 'sold' ? 'sold' : 'active')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [listingId, userId])

  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return

    const remaining = MAX_PHOTOS - photos.length
    if (remaining <= 0) {
      setError(`Máximo ${MAX_PHOTOS} fotografias`)
      return
    }

    setUploading(true)
    setError('')
    const next: string[] = []
    for (const file of files.slice(0, remaining)) {
      if (!file.type.startsWith('image/')) {
        setError('Só imagens (JPG, PNG, WEBP)')
        continue
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setError('Cada foto pode ter no máximo 5 MB')
        continue
      }
      const url = await uploadListingPhoto(file, userId)
      if (url) next.push(url)
      else setError('Falha no upload da foto')
    }
    if (next.length) setPhotos((prev) => [...prev, ...next].slice(0, MAX_PHOTOS))
    setUploading(false)
  }

  const finishSaved = (id: string) => {
    setPushReminderListingId(null)
    onSaved(id)
  }

  const maybeRemindPushThenFinish = async (id: string, isNewListing: boolean) => {
    if (!isNewListing || !isPushSupported()) {
      finishSaved(id)
      return
    }
    const subscribed = await checkIsSubscribed(playerAccountId).catch(() => false)
    if (subscribed) {
      finishSaved(id)
      return
    }
    setPushReminderListingId(id)
  }

  const handleEnablePushFromReminder = async () => {
    if (!pushReminderListingId) return
    setPushEnabling(true)
    try {
      await subscribeToPush(playerAccountId)
    } finally {
      setPushEnabling(false)
      finishSaved(pushReminderListingId)
    }
  }

  const handleSave = async () => {
    const trimmed = title.trim()
    const priceNum = Number(String(price).replace(',', '.'))
    if (!trimmed) {
      setError('Indica um título')
      return
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError('Preço inválido')
      return
    }
    if (photos.length > MAX_PHOTOS) {
      setError(`Máximo ${MAX_PHOTOS} fotografias`)
      return
    }

    setSaving(true)
    setError('')
    try {
      if (isEdit && listingId) {
        const result = await updateMarketplaceListing({
          id: listingId,
          sellerUserId: userId,
          input: {
            title: trimmed,
            description,
            category,
            condition,
            photos,
            price: priceNum,
            status,
          },
        })
        if (!result.success) {
          setError(result.error || 'Erro ao guardar')
          return
        }
        onSaved(listingId)
      } else {
        const result = await createMarketplaceListing({
          sellerUserId: userId,
          sellerPlayerAccountId: playerAccountId,
          input: {
            title: trimmed,
            description,
            category,
            condition,
            photos,
            price: priceNum,
          },
        })
        if (!result.success || !result.id) {
          setError(result.error || 'Erro ao criar anúncio')
          return
        }
        await maybeRemindPushThenFinish(result.id, true)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    if (!listingId) return
    if (!confirm('Remover este anúncio?')) return
    setSaving(true)
    const result = await removeMarketplaceListing({ id: listingId, sellerUserId: userId })
    setSaving(false)
    if (!result.success) {
      setError(result.error || 'Erro ao remover')
      return
    }
    onBack()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in pb-24">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">
          {isEdit ? 'Editar anúncio' : 'Vender'}
        </h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-xl px-3 py-2">{error}</div>
      )}

      <div className="card p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="Ex.: Raquete Babolat Technical Viper"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
          <div className="flex flex-wrap gap-2">
            {MARKETPLACE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                  category === c.id
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <div className="flex gap-2">
            {MARKETPLACE_CONDITIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCondition(c.id)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                  condition === c.id
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Preço (EUR)</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fotografias ({photos.length}/{MAX_PHOTOS})
          </label>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((url) => (
              <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((prev) => prev.filter((p) => p !== url))}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-red-400 hover:text-red-500"
              >
                <Camera className="w-5 h-5 mb-1" />
                <span className="text-[10px]">{uploading ? '…' : 'Foto'}</span>
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleAddPhotos}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={800}
            placeholder="Detalhes do produto, tamanho, marca…"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          />
        </div>

        {isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado do anúncio</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                  status === 'active'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                Activo
              </button>
              <button
                type="button"
                onClick={() => setStatus('sold')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                  status === 'sold'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                Vendido
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving || uploading}
        className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60"
      >
        {saving ? 'A guardar…' : isEdit ? 'Guardar' : 'Publicar anúncio'}
      </button>

      {isEdit && (
        <button
          onClick={handleRemove}
          disabled={saving}
          className="w-full py-3 rounded-xl border border-red-200 text-red-600 font-semibold flex items-center justify-center gap-2 hover:bg-red-50 disabled:opacity-60"
        >
          <Trash2 className="w-4 h-4" />
          Remover anúncio
        </button>
      )}

      {pushReminderListingId && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
          onClick={() => finishSaved(pushReminderListingId)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Bell className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Anúncio publicado!</h3>
                  <p className="text-xs text-gray-500">Quase a receber ofertas</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Activa as notificações para receberes alertas quando alguém contactar o teu anúncio.
                Sem notificações, podes perder ofertas de compradores.
              </p>
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleEnablePushFromReminder}
                  disabled={pushEnabling}
                  className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60"
                >
                  {pushEnabling ? 'A activar…' : 'Ativar notificações'}
                </button>
                <button
                  type="button"
                  onClick={() => finishSaved(pushReminderListingId)}
                  disabled={pushEnabling}
                  className="w-full py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-60"
                >
                  Agora não
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
