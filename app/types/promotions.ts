/** Contratos de `GET /api/promotions` e `GET /api/promotions/items/:id` (seção Promoções). */

type Tone = 'ok' | 'warn' | 'bad' | 'neutral'

/** Uma oferta avaliada: preço que vale para a margem, lucro por unidade e se serve pela regra de margem. */
export interface PromotionOfferShort {
  promotion_id: string | null
  type: string
  /** Tipo em português (Campanha do vendedor, Evento do ML, Desconto com ML…). */
  label: string
  name: string | null
  status: string
  price: number | null
  margin_pct: number | null
  profit: number | null
  /** Parte do desconto paga pelo Mercado Livre, em R$ por unidade. */
  meli_amount: number
  valid: boolean
  reason: string | null
  finish_date: string | null
  /** manter = como está hoje; editar_preco = mudar o preço da promoção atual; aderir = entrar nesta. */
  action: 'manter' | 'editar_preco' | 'aderir'
}

export interface PromotionOffer extends PromotionOfferShort {
  original_price: number | null
  min_price: number | null
  max_price: number | null
  suggested_price: number | null
  meli_percentage: number | null
  seller_percentage: number | null
  fixed_amount: number | null
  fee: number | null
  flexible: boolean
  start_date: string | null
}

export interface PromotionSettings {
  min_margin_pct: number | null
  max_margin_pct: number | null
  apply_to_sku: boolean
  automation_enabled: boolean
  /** Margem mínima que vale para o anúncio (a dele ou a geral de Configurações). */
  effective_min_pct: number
}

export interface PromotionItemRow {
  item_id: string
  title: string
  sku: string | null
  thumbnail: string | null
  permalink: string | null
  listing_type: string | null
  logistic_type: string | null
  stock: number | null
  full_price: number
  cost: number | null
  base: { price: number; profit: number; margin_pct: number } | null
  current: PromotionOfferShort | null
  best: PromotionOfferShort | null
  /** Lucro a mais por unidade se trocar pela melhor oferta. */
  gain: number | null
  offers_count: number
  settings: PromotionSettings
  status: { key: string; label: string; tone: Tone }
}

export interface PromotionItemDetail extends PromotionItemRow {
  offers: PromotionOffer[]
  sku_items: { item_id: string; title: string; listing_type: string }[]
}

export interface MlPromotionRow {
  promotion_id: string
  type: string
  label: string
  name: string | null
  status: string
  start_date: string | null
  finish_date: string | null
  deadline_date: string | null
  active_items: number
  candidate_items: number
}

export interface PromotionsResponse {
  summary: {
    items: number
    with_promotion: number
    without_promotion: number
    to_switch: number
    switch_gain: number
    below_min: number
    without_cost: number
  }
  counts: Record<string, number>
  items: PromotionItemRow[]
  total: number
  page: number
  per_page: number
  sort: string
  dir: 'asc' | 'desc'
  promotions: MlPromotionRow[]
  rules: { min_margin_pct: number }
  synced_at: string | null
}

export interface PromotionsFilters {
  status: string
  promotionId: string
  q: string
  sort: string
  dir: 'asc' | 'desc'
  page: number
  perPage: number
}

export interface PromotionSettingsInput {
  min_margin_pct: string
  max_margin_pct: string
  apply_to_sku: boolean
}
