/** Contratos de `GET /api/promotions` e `GET /api/promotions/items/:id` (seção Promoções). */

type Tone = 'ok' | 'warn' | 'bad' | 'neutral'

/** Custos por unidade num preço: custo do produto, tarifa, frete, imposto, despesas fixas e Ads (15 dias). */
export interface PromotionCosts {
  cost: number
  fee: number
  shipping: number
  tax: number
  fixed_expenses: number
  ads: number
  meli_amount: number
}

/** Uma oferta avaliada: preço que vale para a margem, lucro por unidade (pós Ads) e se serve pela regra. */
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
  costs?: PromotionCosts
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
  /** margin = limites por margem (%); price = por valor (R$). Um desabilita o outro. */
  limit_mode: 'margin' | 'price'
  min_margin_pct: number | null
  max_margin_pct: number | null
  min_price: number | null
  max_price: number | null
  apply_to_sku: boolean
  apply_to_variations: boolean
  automation_enabled: boolean
  /** Margem mínima que vale para o anúncio (a dele ou a geral de Configurações). */
  effective_min_pct: number
  /** Margem máxima que vale (a dele ou a geral; null = sem teto). */
  effective_max_pct: number | null
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
  base: { price: number; profit: number; margin_pct: number; costs: PromotionCosts } | null
  /** Ads dos últimos 15 dias: gasto, unidades vendidas e custo por unidade (zero sem histórico). */
  ads: { spend: number; units: number; unit: number; days: number }
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
  /** Anúncios das outras variações do mesmo produto (produto pai no Olist). */
  variation_items: { item_id: string; title: string; sku: string | null }[]
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
  rules: { min_margin_pct: number; max_margin_pct: number | null }
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

/** Resposta de aplicar/sair: o resultado em texto e o anúncio já relido. */
export interface PromotionActionResult {
  ok: boolean
  message: string
  item: PromotionItemDetail
}

export interface PromotionActionLog {
  id: number
  item_id: string
  title: string | null
  kind: string
  kind_label: string
  source: string
  source_label: string
  ok: boolean
  error: string | null
  from: { name: string; price: number | null; margin_pct: number | null } | null
  to: { name: string; price: number | null; margin_pct: number | null } | null
  gain: number | null
  user: string | null
  created_at: string
}

/** Oferta escolhida na tela (sem ela, vale a melhor). */
export interface PromotionTarget {
  promotion_id: string | null
  promotion_type: string
  action: 'aderir' | 'editar_preco'
}

export interface PromotionSettingsInput {
  limit_mode: 'margin' | 'price'
  min_margin_pct: string
  max_margin_pct: string
  min_price: string
  max_price: string
  apply_to_sku: boolean
  apply_to_variations: boolean
}
