/** Contratos de `GET /api/ads` e `GET /api/ads/items` (seção Ads). */
import type { Tone } from './sales'

export interface AdsMetrics {
  clicks: number
  prints: number
  cost: number
  total_amount: number
  direct_amount: number
  indirect_amount: number
  units: number
  direct_units: number
  indirect_units: number
  organic_units: number
  organic_amount: number
  acos: number | null
  roas: number | null
  ctr: number | null
  cpc: number | null
  cvr: number | null
}

export interface AdsDay {
  date: string
  cost: number
  total_amount: number
  clicks: number
  units: number
}

export interface AdsCampaign {
  id: number
  name: string
  status: { key: string; label: string; tone: Tone }
  strategy: string | null
  channel: string | null
  acos_target: number | null
  roas_target: number | null
  daily_budget: number | null
  budget: number | null
  automatic_budget: boolean | null
  date_created: string | null
  last_updated: string | null
  metrics: AdsMetrics
  acos_state: 'ok' | 'warn' | 'bad' | 'neutral'
  ads_count: number
  daily: { date: string; cost: number; total_amount: number }[]
}

export interface AdsResponse {
  period: { from: string; to: string; preset: string; days: number }
  summary: AdsMetrics
  previous: AdsMetrics | null
  daily: AdsDay[]
  campaigns: AdsCampaign[]
  sync: { last_sync_at: string | null; recent_sync_at: string | null; campaigns: number; ads: number }
}

export interface AdsItemFlag {
  key: 'sem_venda' | 'acos_alto' | 'bom'
  label: string
  tone: Tone
}

export interface AdsItem {
  item_id: string
  title: string | null
  thumbnail: string | null
  permalink: string | null
  price: number | null
  status: string
  status_label: string
  campaign: { id: number | null; name: string; status: string | null }
  listing_type: string | null
  logistic_type: string | null
  catalog: boolean | null
  buy_box_winner: boolean | null
  recommended: boolean | null
  has_discount: boolean | null
  metrics: AdsMetrics
  flag: AdsItemFlag | null
}

/** Período escolhido: atalho (today, yesterday, 7d…) ou datas (period = 'custom'). */
export interface AdsRange {
  period: string
  from: string
  to: string
}

export interface AdsItemsResponse {
  window: string
  /** true quando o período foi consultado no Mercado Livre na hora (hoje, ontem, datas, 60 dias). */
  live: boolean
  live_error: boolean
  items: AdsItem[]
  total: number
  page: number
  per_page: number
  sort: string
  dir: 'asc' | 'desc'
  totals: AdsMetrics
  flags: Record<string, number>
}

export interface AdsItemsFilters {
  campaignId: string
  status: '' | 'active' | 'paused'
  flag: '' | 'sem_venda' | 'acos_alto' | 'bom'
  q: string
  sort: string
  dir: 'asc' | 'desc'
  page: number
  perPage: number
}
