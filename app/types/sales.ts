/** Contratos de `GET /api/sales` e `GET /api/sales/:id` (seção Vendas). */

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral'

export interface SaleItemLine {
  item_id: string
  title: string | null
  sku: string | null
  quantity: number
  unit_price: number | null
  sale_fee: number | null
  listing_type: string | null
  thumbnail: string | null
}

export interface SaleShipping {
  id?: number
  status: string | null
  label: string
  tone: Tone
  loaded: boolean
  substatus?: string | null
  logistic_type?: string | null
  logistic_label?: string | null
  method_name?: string | null
  tracking_number?: string | null
  seller_cost?: number | null
  buyer_cost?: number | null
  list_cost?: number | null
  destination?: string | null
  estimated_delivery?: string | null
  dates?: Record<string, string | null>
  history?: { date: string; status: string; substatus: string }[]
}

export interface SaleEconomics {
  revenue: number
  cost: number | null
  fee: number
  shipping_cost: number
  shipping_known: boolean
  fixed_expenses: number
  tax: number
  net_profit: number | null
  net_profit_pct: number | null
}

export interface SaleRow {
  order_id: number
  pack_id: number | null
  date_created: string
  date_closed: string | null
  status: { key: string; label: string; tone: Tone }
  buyer_nickname: string | null
  items: SaleItemLine[]
  units: number
  total_amount: number | null
  paid_amount: number | null
  shipping: SaleShipping
  economics: SaleEconomics | null
}

export interface SalePayment {
  id: number
  status: string
  method: string
  type: string
  installments: number
  total_paid: number
  transaction_amount: number
  refunded: number
  shipping_cost: number
  taxes: number
  coupon: number | null
  date_approved: string | null
}

export interface SaleItemDetail {
  item_id: string
  title: string
  sku: string | null
  category_id: string | null
  condition: string | null
  warranty: string | null
  variation_id: number | null
  variation: string[]
  quantity: number
  unit_price: number
  full_unit_price: number | null
  sale_fee: number
  listing_type: string | null
}

export interface SaleDetail extends SaleRow {
  payments: SalePayment[]
  items_detail: SaleItemDetail[]
  tags: string[] | null
  coupon_amount: number | null
  date_last_updated: string | null
}

export interface SalesSummary {
  orders: number
  units: number
  cancelled: number
  revenue: number
  ticket: number | null
  fee: number
  shipping_cost: number
  tax: number
  fixed_expenses: number
  cost: number
  net_profit: number
  net_profit_pct: number | null
  orders_without_cost: number
}

export interface SalesDay {
  date: string
  orders: number
  units: number
  revenue: number
  net_profit: number
}

export interface SalesResponse {
  period: { from: string; to: string; preset: string }
  summary: SalesSummary
  daily: SalesDay[]
  counts: {
    status: Record<string, number>
    shipping: Record<string, number>
    logistic: Record<string, number>
  }
  sales: SaleRow[]
  total: number
  page: number
  per_page: number
  sort: string
  dir: 'asc' | 'desc'
  sync: { pending_shipments: number; last_order_sync_at: string | null }
}

export interface SalesFilters {
  period: string
  from: string
  to: string
  status: '' | 'paid' | 'cancelled'
  shipping: '' | 'preparing' | 'transit' | 'delivered' | 'problem' | 'none'
  logistic: '' | 'full' | 'flex' | 'coleta' | 'agencia' | 'other'
  q: string
  sort: string
  dir: 'asc' | 'desc'
  page: number
  perPage: number
}
