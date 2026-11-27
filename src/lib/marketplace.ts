import { supabase } from './supabase'
import { getOrCreateConversation, sendDirectMessage } from './directMessages'

export type MarketplaceCategory = 'raquetes' | 'acessorios' | 'nutricao' | 'outros'
export type MarketplaceCondition = 'novo' | 'usado'
export type MarketplaceSource = 'player' | 'store'
export type MarketplaceSellerType = 'player' | 'store'
export type MarketplaceStatus = 'active' | 'inactive' | 'sold'

export const MARKETPLACE_CATEGORIES: { id: MarketplaceCategory; label: string }[] = [
  { id: 'raquetes', label: 'Raquetes' },
  { id: 'acessorios', label: 'Acessórios' },
  { id: 'nutricao', label: 'Nutrição' },
  { id: 'outros', label: 'Outros' },
]

export const MARKETPLACE_CONDITIONS: { id: MarketplaceCondition; label: string }[] = [
  { id: 'novo', label: 'Novo' },
  { id: 'usado', label: 'Usado' },
]

export interface MarketplaceListing {
  id: string
  title: string
  description: string | null
  category: MarketplaceCategory
  condition: MarketplaceCondition
  photos: string[]
  /** EUR — coluna DB `price` (contrato Hub HUB-115) */
  price: number
  source: MarketplaceSource
  seller_type: MarketplaceSellerType
  seller_user_id: string | null
  seller_player_account_id: string | null
  store_product_id: string | null
  store_url: string | null
  status: MarketplaceStatus
  created_at: string
  updated_at: string
  seller_name?: string | null
  seller_avatar?: string | null
}

export interface MarketplaceListingInput {
  title: string
  description?: string
  category: MarketplaceCategory
  condition: MarketplaceCondition
  photos: string[]
  price: number
}

const STORE_FALLBACK_URL = 'https://store.padel1.app/'

function mapRow(
  row: any,
  seller?: { name?: string | null; avatar_url?: string | null } | null
): MarketplaceListing {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    category: row.category,
    condition: row.condition,
    photos: Array.isArray(row.photos) ? row.photos.filter(Boolean) : [],
    price: Number(row.price) || 0,
    source: row.source,
    seller_type: row.seller_type || (row.source === 'store' ? 'store' : 'player'),
    seller_user_id: row.seller_user_id ?? null,
    seller_player_account_id: row.seller_player_account_id ?? null,
    store_product_id: row.store_product_id ?? null,
    store_url: row.store_url ?? null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    seller_name: seller?.name ?? (row.source === 'store' ? 'Padel1 Store' : null),
    seller_avatar: seller?.avatar_url ?? null,
  }
}

export function formatPriceEur(price: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price)
}

export function categoryLabel(category: string): string {
  return MARKETPLACE_CATEGORIES.find((c) => c.id === category)?.label || category
}

export function conditionLabel(condition: string): string {
  return MARKETPLACE_CONDITIONS.find((c) => c.id === condition)?.label || condition
}

export async function fetchMarketplaceListings(opts?: {
  category?: MarketplaceCategory | 'all'
  condition?: MarketplaceCondition | 'all'
  mineOnly?: boolean
  sellerUserId?: string | null
}): Promise<MarketplaceListing[]> {
  let query = supabase
    .from('marketplace_listings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (opts?.mineOnly && opts.sellerUserId) {
    query = query.eq('seller_user_id', opts.sellerUserId).neq('status', 'inactive')
  } else {
    query = query.eq('status', 'active')
  }

  if (opts?.category && opts.category !== 'all') {
    query = query.eq('category', opts.category)
  }
  if (opts?.condition && opts.condition !== 'all') {
    query = query.eq('condition', opts.condition)
  }

  const { data, error } = await query
  if (error) {
    console.error('[marketplace] list:', error)
    return []
  }
  if (!data?.length) return []

  const sellerIds = [
    ...new Set(
      data.map((r) => r.seller_user_id).filter((id): id is string => Boolean(id))
    ),
  ]

  let sellerMap = new Map<string, { name?: string | null; avatar_url?: string | null }>()
  if (sellerIds.length) {
    const { data: sellers } = await supabase
      .from('player_accounts')
      .select('user_id, name, avatar_url')
      .in('user_id', sellerIds)
    sellerMap = new Map((sellers || []).map((s) => [s.user_id, s]))
  }

  return data.map((row) =>
    mapRow(row, row.seller_user_id ? sellerMap.get(row.seller_user_id) : null)
  )
}

export async function fetchMarketplaceListing(id: string): Promise<MarketplaceListing | null> {
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    if (error) console.error('[marketplace] get:', error)
    return null
  }

  let seller: { name?: string | null; avatar_url?: string | null } | null = null
  if (data.seller_user_id) {
    const { data: s } = await supabase
      .from('player_accounts')
      .select('name, avatar_url')
      .eq('user_id', data.seller_user_id)
      .maybeSingle()
    seller = s
  }

  return mapRow(data, seller)
}

export async function createMarketplaceListing(params: {
  sellerUserId: string
  sellerPlayerAccountId: string
  input: MarketplaceListingInput
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const photos = (params.input.photos || []).slice(0, 4)
  const { data, error } = await supabase
    .from('marketplace_listings')
    .insert({
      title: params.input.title.trim(),
      description: params.input.description?.trim() || null,
      category: params.input.category,
      condition: params.input.condition,
      photos,
      price: params.input.price,
      source: 'player',
      seller_type: 'player',
      seller_user_id: params.sellerUserId,
      seller_player_account_id: params.sellerPlayerAccountId,
      status: 'active',
    })
    .select('id')
    .single()

  if (error) {
    console.error('[marketplace] create:', error)
    return { success: false, error: error.message }
  }
  return { success: true, id: data.id }
}

export async function updateMarketplaceListing(params: {
  id: string
  sellerUserId: string
  input: Partial<MarketplaceListingInput> & { status?: MarketplaceStatus }
}): Promise<{ success: boolean; error?: string }> {
  const patch: Record<string, unknown> = {}
  if (params.input.title !== undefined) patch.title = params.input.title.trim()
  if (params.input.description !== undefined) {
    patch.description = params.input.description.trim() || null
  }
  if (params.input.category !== undefined) patch.category = params.input.category
  if (params.input.condition !== undefined) patch.condition = params.input.condition
  if (params.input.photos !== undefined) patch.photos = params.input.photos.slice(0, 4)
  if (params.input.price !== undefined) patch.price = params.input.price
  if (params.input.status !== undefined) patch.status = params.input.status

  const { error } = await supabase
    .from('marketplace_listings')
    .update(patch)
    .eq('id', params.id)
    .eq('seller_user_id', params.sellerUserId)
    .eq('source', 'player')

  if (error) {
    console.error('[marketplace] update:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

/** Soft-remove: status=inactive (mesmo contrato que Hub Store). */
export async function removeMarketplaceListing(params: {
  id: string
  sellerUserId: string
}): Promise<{ success: boolean; error?: string }> {
  return updateMarketplaceListing({
    id: params.id,
    sellerUserId: params.sellerUserId,
    input: { status: 'inactive' },
  })
}

export async function uploadListingPhoto(file: File, userId: string): Promise<string | null> {
  const ext =
    (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('marketplace-photos').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) {
    console.error('[marketplace] photo upload:', error)
    return null
  }
  const { data } = supabase.storage.from('marketplace-photos').getPublicUrl(path)
  return data?.publicUrl || null
}

export function buildContactPrefill(listing: MarketplaceListing): string {
  const price = formatPriceEur(listing.price)
  return `Olá! Tenho interesse no teu anúncio «${listing.title}» (${price} · ${conditionLabel(listing.condition)}). Ainda disponível?`
}

/**
 * Contactar vendedor:
 * - player (ou store com seller_user_id): DM + mensagem pré-preenchida (+ push via sendDirectMessage)
 * - store sem seller_user_id: fallback URL Store
 */
export async function contactMarketplaceSeller(params: {
  myUserId: string
  listing: MarketplaceListing
}): Promise<{
  success: boolean
  mode: 'dm' | 'store_url'
  conversationId?: string
  otherUserId?: string
  storeUrl?: string
  error?: string
}> {
  const listing = params.listing

  if ((listing.source === 'store' || listing.seller_type === 'store') && !listing.seller_user_id) {
    const storeUrl = listing.store_url || STORE_FALLBACK_URL
    return { success: true, mode: 'store_url', storeUrl }
  }

  const sellerUserId = listing.seller_user_id
  if (!sellerUserId) {
    return { success: false, mode: 'dm', error: 'Vendedor sem conta de chat' }
  }
  if (sellerUserId === params.myUserId) {
    return { success: false, mode: 'dm', error: 'Este anúncio é teu' }
  }

  const conv = await getOrCreateConversation(params.myUserId, sellerUserId)
  if (!conv.success || !conv.conversationId) {
    return { success: false, mode: 'dm', error: conv.error || 'Não foi possível abrir a conversa' }
  }

  // Push ao vendedor via infra existente em sendDirectMessage
  const msg = await sendDirectMessage({
    conversationId: conv.conversationId,
    senderId: params.myUserId,
    content: buildContactPrefill(listing),
    recipientUserId: sellerUserId,
  })
  if (!msg.success) {
    return { success: false, mode: 'dm', error: msg.error || 'Não foi possível enviar a mensagem' }
  }

  return {
    success: true,
    mode: 'dm',
    conversationId: conv.conversationId,
    otherUserId: sellerUserId,
  }
}
