/**
 * Shapes devolvidos pelo bloco Painel/Curva ABC da API do Lunna (contrato em
 * `lunna-api/docs/SPEC.md` §10.3–10.6 + `DECISOES.md` §7 + campos extras do
 * prompt W2). Todo estado que decide cor/texto já vem pronto do back
 * (`*_state`, `direction`, `severity`, `kind`) — o front só mapeia.
 */

export type SyncState = 'ok' | 'warn' | 'bad'
export type Direction = 'up' | 'down' | 'flat'
export type Severity = 'bad' | 'warn' | 'info'
export type KpiValueType = 'money' | 'int' | 'pct'
export type ThreeState = 'ok' | 'warn' | 'bad'

/** Ação pendente do Mercado Livre (até 6 por anúncio). */
export interface QualityAction {
  title: string
  label: string | null
}

export interface PeriodRange {
  from: string
  to: string
}

export interface Period {
  today: PeriodRange
  week: PeriodRange
  prev_week: PeriodRange
  month: PeriodRange
  prev_month: PeriodRange
}

export interface SyncNotice {
  title: string
  body: string
}

export interface SyncStatus {
  state: SyncState
  last_ok_at: string | null
  minutes_ago: number | null
  notice: SyncNotice | null
}

export interface PainelAccount {
  id: string
  nickname: string
  seller_id: number
}

export interface PainelSummary {
  total: number
  active: number
  paused: number
  closed: number
  under_review: number
}

export interface KpiDelta {
  value: number
  unit: 'pct' | 'pp'
  direction: Direction
}

export interface Kpi {
  key: string
  label: string
  value: number | null
  value_type: KpiValueType
  sub_label: string | null
  delta: KpiDelta | null
}

export interface DailyPoint {
  day: string
  units: number
  revenue: number
  orders: number
  visits: number
  is_today: boolean
}

export interface DailyScale {
  units_max: number
  visits_max: number
}

export interface TopSeller {
  id: string
  title: string
  units_week: number
  units_prev_week: number
  bar_pct: number
  bar_prev_pct: number
}

export interface Alert {
  key: string
  title: string
  description: string
  severity: Severity
  count: number
}

export interface RecentSale {
  at: string
  item_id: string
  title: string
  quantity: number
  total: number
}

export interface PainelResponse {
  account: PainelAccount
  generated_at: string
  period: Period
  sync: SyncStatus
  summary: PainelSummary
  kpis: Kpi[]
  daily: DailyPoint[]
  daily_scale: DailyScale
  top_sellers: TopSeller[]
  alerts: Alert[]
  recent_sales: RecentSale[]
}

// --- /api/items ---------------------------------------------------------

export type ItemStatusFilter = 'active' | 'paused' | 'closed' | 'all'
export type SortDir = 'asc' | 'desc'

export interface ItemLinks {
  public: string
  seller_panel: string
}

/** Resultado por unidade de um anúncio: lucro líquido = preço − custo − comissão − frete/taxas − despesas fixas. */
export interface ItemEconomics {
  price: number
  /** Custo unitário do Olist (ou manual); null = sem custo. */
  cost: number | null
  cost_source: 'peps' | 'cadastro' | 'custo_medio' | 'kit' | 'manual' | null
  commission: number
  /** Frete pago pelo vendedor + taxa fixa + financiamento. */
  shipping_fees: number
  shipping: number
  fixed_fee: number
  financing: number
  fixed_expenses: number
  fixed_expenses_pct: number
  net_profit: number | null
  net_profit_pct: number | null
  fees_known: boolean
  /** false = o detalhe da tarifa ainda não foi lido: a tarifa inteira entrou como comissão. */
  fees_split: boolean
}

export interface ItemRow {
  id: string
  title: string
  status: string
  status_label: string
  sku: string | null
  price: number | null
  original_price: number | null
  discount_pct: number | null
  listing_type_label: string | null
  full: boolean
  free_shipping: boolean
  catalog: boolean
  variations: number
  stock: number | null
  stock_state: ThreeState | null
  visits_7d: number | null
  prev_visits_7d: number | null
  units_7d: number | null
  prev_units_7d: number | null
  units_today: number | null
  conversion_7d: number | null
  prev_conversion_7d: number | null
  units_delta: number | null
  units_delta_direction: Direction | null
  revenue_7d: number | null
  net_after_fee_7d: number | null
  economics: ItemEconomics | null
  coverage_days: number | null
  coverage_state: ThreeState | null
  quality_score: number | null
  quality_state: ThreeState | null
  quality_level: string | null
  quality_actions: QualityAction[]
  alert_keys: string[]
  lean: boolean
  links: ItemLinks
}

export interface ItemStatusCounts {
  active: number
  paused: number
  closed: number
  all: number
}

export interface ItemsResponse {
  items: ItemRow[]
  total: number
  page: number
  per_page: number
  status_counts: ItemStatusCounts
  active_filter: { alert: { key: string; title: string } | null }
  active_filters_count: number
  invalid_filters: string[]
  sort: string
  dir: SortDir
}

// --- /api/abc -------------------------------------------------------------

export type Curve = 'A' | 'B' | 'C'
export type CurveFilter = 'all' | Curve
export type AbcGroupKey = 'up' | 'flat' | 'down'

export interface AbcParams {
  tax_pct: number
  min_margin_pct: number
  cut_a: number
  cut_b: number
  up_pct: number
  down_pct: number
}

export interface AbcSummaryRow {
  curve: Curve
  count: number
  revenue: number
  share_pct: number
}

export interface AbcGroup {
  label: string
  description: string
  count: number
  revenue: number
}

export interface AbcGroups {
  up: AbcGroup
  flat: AbcGroup
  down: AbcGroup
}

export interface AbcRow {
  id: string
  title: string
  status_label: string
  sku: string | null
  full: boolean
  curve: Curve
  group: AbcGroupKey | null
  rank: number
  share_pct: number
  cum_pct: number
  visits_30d: number | null
  units_30d: number | null
  units_change_pct: number | null
  units_change_state: ThreeState | null
  is_new: boolean
  conversion_30d: number | null
  revenue_30d: number
  profit_month: number | null
  profit_is_before_cost: boolean
  profit_state: ThreeState | null
  margin_pct: number | null
  margin_state: ThreeState | null
  suggestions_count: number
  urgent_count: number
}

export interface AbcResponse {
  params: AbcParams
  period: PeriodRange
  has_costs: boolean
  details: { done: number; total: number }
  notice: string | null
  summary: AbcSummaryRow[]
  groups: AbcGroups | null
  rows: AbcRow[]
}

// --- /api/abc/items/:id -----------------------------------------------------

export interface AbcIndicators {
  visits: number | null
  prev_visits: number | null
  units: number | null
  prev_units: number | null
  conversion: number | null
  revenue: number
  share_pct: number
  cum_pct: number
}

export interface AbcMonth {
  revenue: number
  fees: number
  shipping: number
  tax: number
  cost: number | null
  profit: number
  margin_pct: number | null
  profit_is_before_cost: boolean
  margin_state: ThreeState | null
  /** `bad` quando o lucro é negativo (com ou sem custo) — SPEC 8.4. */
  profit_state: ThreeState | null
}

export interface AbcUnit {
  price: number
  full_price: number | null
  fee: number
  shipping: number
  tax: number
  cost: number | null
  profit: number
  margin_pct: number | null
  margin_state: ThreeState | null
  /** `bad` quando o lucro é negativo (com ou sem custo) — SPEC 8.4. */
  profit_state: ThreeState | null
}

export interface AbcListing {
  stock: number | null
  pictures: number
  has_video: boolean
  description_len: number
  title_len: number
  quality_score: number | null
  listing_type_label: string | null
}

export type AbcPriceKind = 'suggestion' | 'aligned' | 'none' | 'loading'

export interface AbcCompetitor {
  price: number
  title: string
}

export interface AbcPrice {
  kind: AbcPriceKind
  suggested: number | null
  diff_pct: number | null
  status_text: string | null
  lowest: number | null
  fee: number | null
  shipping: number | null
  tax: number | null
  profit: number | null
  margin_pct: number | null
  max_cost: number | null
  low: boolean
  message: string | null
  competitors: AbcCompetitor[]
}

export interface AbcSuggestion {
  priority: 1 | 2 | 3
  area: string
  title: string
  why: string
}

/** `GET /api/items/:id/ai-plan` (DECISOES §10): plano gerado em background, lido por polling. */
export interface AiPlan {
  id: string
  status: 'pending' | 'running' | 'done' | 'error' | 'cancelled'
  text: string
  error: string | null
  updated_at: string
}

export interface AbcItemDetail {
  indicators: AbcIndicators
  month: AbcMonth
  unit: AbcUnit
  listing: AbcListing
  price: AbcPrice
  suggestions: AbcSuggestion[]
  links: ItemLinks
}
