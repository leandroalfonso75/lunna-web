/** Seção Financeiro: `GET /api/finance` (DRE do período com comparativo do período anterior). */
export interface Compare {
  value: number
  previous: number
  delta: number
  delta_pct: number | null
  /** true = melhorou, false = piorou, null = igual */
  good: boolean | null
}

export interface StatementLine extends Compare {
  key: string
  label: string
  kind: 'revenue' | 'expense' | 'credit' | 'subtotal' | 'total'
  pct_revenue: number | null
  note?: string
  breakdown?: { label: string; amount: number }[]
}

export interface HealthSignal {
  key: string
  label: string
  value: number | null
  unit: string
  target: string
  tone: 'ok' | 'warn' | 'bad' | 'neutral'
}

export interface FinanceDailyPoint {
  date: string
  previous_date: string | null
  revenue: number
  previous_revenue: number | null
  profit: number
  previous_profit: number | null
  orders: number
  previous_orders: number | null
}

export interface MlStatementGroup {
  group: string
  label: string
  charge: number
  bonus: number
  net: number
  count: number
  neutral: boolean
  lines: { label: string | null; amount: number; count: number }[]
}

export interface ReconciliationItem {
  key: string
  label: string
  lunna: number
  extrato: number
  diff: number
  diff_pct: number | null
  note: string
  /** vendas/envios do período ainda sem cobrança no extrato (ficam fora da comparação) */
  pending?: number
  /** cobrados com valor diferente do calculado */
  different?: number
  /** total do extrato pela data da cobrança (mistura outros períodos e canceladas) */
  calendar?: number
  /** fretes: parte paga pelos compradores nos envios já cobrados */
  buyer_paid?: number
  /** fretes cobrados fora da conta previsto + parte do comprador (até 50) */
  divergent?: { shipment_id: number; order_id: number; date: string; logistic: string | null; expected: number; buyer_paid: number; billed: number; diff: number }[]
}

/** Lançamento manual (abas Receita e Despesas). */
export interface FinanceEntry {
  id: number
  entry_type: 'receita' | 'despesa'
  date: string
  category: string
  description: string
  amount: number
  notes: string | null
  user?: string | null
}

export interface RevenueTab {
  totals: Record<'revenue' | 'refunds' | 'net_revenue' | 'orders' | 'units' | 'ticket' | 'other_income' | 'cancelled', Compare>
  by_logistic: (Compare & { label: string; orders: number; units: number; share: number | null })[]
  by_product: (Compare & { item_id: string; title: string | null; sku: string | null; units: number; share: number | null })[]
  ads_vs_organic: { ads: Compare; organic: Compare; ads_share: number | null }
  weekly: { label: string; revenue: number; previous_revenue: number | null; orders: number }[]
  entries: FinanceEntry[]
}

export interface ExpensesTab {
  items: (Compare & { key: string; label: string; note: string; share: number | null })[]
  total: Compare
  total_share: number | null
  entries: FinanceEntry[]
}

export interface FinanceResponse {
  revenue: RevenueTab
  expenses: ExpensesTab
  period: {
    from: string; to: string; preset: string; month: string | null
    previous_from: string; previous_to: string; previous_label: string; previous_partial: boolean
  }
  basis: 'lunna' | 'extrato'
  filtered: boolean
  kpis: Record<'revenue' | 'net' | 'operating' | 'net_margin' | 'gross_margin' | 'orders' | 'ticket' | 'tacos' | 'ml_cost_pct' | 'returns_pct' | 'refunds', Compare>
  statement: StatementLine[]
  health: HealthSignal[]
  charts: { daily: FinanceDailyPoint[]; expenses: { label: string; amount: number; pct: number | null }[] }
  statement_ml: MlStatementGroup[]
  reconciliation: ReconciliationItem[]
  coverage: { billing_from: string | null; billing_synced_at: string | null; orders_from: string; billing_covers: boolean; orders_cover: boolean }
  months: { value: string; label: string; current: boolean; partial: boolean }[]
}

/** Aba Repasses: conciliação com a conta do Mercado Pago (GET /api/finance/repasses). */
export type RepasseStatus = 'conferido' | 'frete_liberacao' | 'cupom' | 'frete_nao_cobrado' | 'reembolso' | 'mediacao' | 'sem_pagamento' | 'diferenca'
export type RepasseCredit = 'creditado' | 'a_liberar' | 'aguardando_relatorio' | 'nao_localizado' | 'sem_credito'

export interface RepasseSale {
  key: string
  shipment_id: number | null
  order_ids: number[]
  pack_id: number | null
  date: string
  items: string[]
  revenue: number
  expected: number
  lunna_fee: number
  lunna_shipping: number
  billed_fee: number
  billed_shipping: number
  billed: boolean
  mp_gross: number
  mp_fee: number
  mp_shipping: number
  buyer_paid: number
  mp_coupon: number
  mp_other: number
  mp_net: number
  diff: number
  credited: number
  release_date: string | null
  payment_ids: number[]
  payment_statuses: string[]
  status: RepasseStatus
  credit: RepasseCredit
}

export interface RepasseGroup { key: string; label: string; tone: string; count: number; expected: number; mp_net: number; diff: number; credited: number }

export interface RepassesResponse {
  period: { from: string; to: string; previous_from: string; previous_to: string; previous_label: string }
  coverage: { payments_synced_at: string | null; releases_until: string | null; payments_from: string | null; releases_from: string | null; releases_cover_period: boolean }
  totals: { sales: number; expected: number; mp_net: number; credited: number; diff: number; coupon: number; to_release: number }
  by_status: RepasseGroup[]
  by_credit: RepasseGroup[]
  legs: { key: string; label: string; lunna: number; billed: number | null; mp: number; diff: number; sales: number; note: string }[]
  divergent: RepasseSale[]
  account: {
    opening: number | null
    closing: number | null
    credits: number
    debits: number
    previous_credits: number
    previous_debits: number
    rows: { key: string; label: string; credit: number; debit: number; net: number; count: number; previous: number }[]
    reserves: { key: string; label: string; amount: number }[]
    note: string
  }
}
