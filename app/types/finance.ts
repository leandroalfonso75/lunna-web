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
