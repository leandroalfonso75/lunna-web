/** Seção Estoque: `GET /api/stock/depot` (depósito/Olist) e `GET /api/stock/full` (Full e reposição). */
export interface StockDepotRow {
  sku: string
  description: string | null
  thumbnail: string | null
  status: string | null
  olist: number
  reserved: number
  full: number | null
  full_unavailable: number | null
  total: number
  unit_cost: number | null
  value_olist: number
  value_full: number
  sold_30d: number
  coverage_days: number | null
  full_asks: number | null
  state: 'ok' | 'baixo' | 'sem_estoque' | 'parado'
}

export interface StockDepotResponse {
  summary: { skus: number; units_olist: number; value_olist: number; units_full: number; value_full: number; out_of_stock: number; low: number; stalled: number; without_cost: number }
  rows: StockDepotRow[]
  total: number
  page: number
  per_page: number
  sort: string
  low_coverage_days: number
  synced_at: string | null
}

export interface StockFullRow {
  user_product_id: string
  inventory_id: string | null
  sku: string | null
  title: string | null
  thumbnail: string | null
  item_id: string | null
  price: number | null
  /** anúncio do formato antigo (variações, sem User Product): o ML não dá recomendação */
  legacy?: boolean
  variation_label?: string | null
  coverage_days?: number | null
  in_full: boolean
  restricted: boolean
  star: boolean
  stock: number | null
  urgency: string | null
  urgency_label: string | null
  replenish: boolean
  suggested: number | null
  deadline: string | null
  deadline_label: string | null
  frequency: number | null
  units_30d: number | null
  gmv_30d: number | null
  history: { start_date: string; end_date: string; units_sold: number; days_out_of_stock: number }[]
  days_out: number
  lost_units: number
  lost_revenue: number | null
  olist_available: number | null
  can_send: number | null
  to_buy: number | null
  benefits: string[]
  synced_at: string
}

export interface StockFullResponse {
  summary: { products: number; replenish: number; urgent: number; suggested_units: number; can_send_units: number; to_buy_units: number; out_of_stock: number; lost_revenue: number }
  rows: StockFullRow[]
  total: number
  page: number
  per_page: number
  synced_at: string | null
}
