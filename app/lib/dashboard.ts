/**
 * Visão geral do novo layout (27/11/2026): contas puras do painel (variação contra o período anterior, janela anterior,
 * "para onde vai cada R$ 100 vendido" e os itens de "Precisa da sua atenção"). Sem chamadas de API aqui, para testar direto.
 * Toda regra de negócio continua na API: aqui só se compara e se organiza o que ela devolve.
 */
export type DashPeriod = '7d' | '30d'
export const PERIOD_DAYS: Record<DashPeriod, number> = { '7d': 7, '30d': 30 }

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Período da Visão geral = os últimos N dias COMPLETOS (até ontem). Hoje fica no cartão "Hoje até agora": um dia pela
 * metade no fim do gráfico parecia queda de vendas e deixava a comparação injusta.
 */
export function currentWindow(period: DashPeriod, today: Date = new Date()): { from: string; to: string } {
  const days = PERIOD_DAYS[period]
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - (days - 1))
  return { from: isoDate(from), to: isoDate(to) }
}

/** Janela anterior do mesmo tamanho, terminando no dia antes do início do período atual. */
export function previousWindow(period: DashPeriod, today: Date = new Date()): { from: string; to: string } {
  const days = PERIOD_DAYS[period]
  const cur = currentWindow(period, today)
  const [y, m, d] = cur.from.split('-').map(Number) as [number, number, number]
  const prevTo = new Date(y, m - 1, d - 1)
  const prevFrom = new Date(prevTo.getFullYear(), prevTo.getMonth(), prevTo.getDate() - (days - 1))
  return { from: isoDate(prevFrom), to: isoDate(prevTo) }
}

export type Trend = 'up' | 'down' | 'flat'
export interface Delta { pct: number; trend: Trend; good: boolean | null }

/**
 * Variação % contra o anterior. `higherIsBetter` decide se subir é bom (faturamento) ou ruim (custo de Ads);
 * variação abaixo de 0,5% é "estável". Sem base anterior, sem variação.
 */
export function delta(current: number | null | undefined, previous: number | null | undefined, higherIsBetter = true): Delta | null {
  if (current === null || current === undefined || previous === null || previous === undefined || previous === 0) return null
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const trend: Trend = Math.abs(pct) < 0.5 ? 'flat' : pct > 0 ? 'up' : 'down'
  return { pct: Math.round(pct * 10) / 10, trend, good: trend === 'flat' ? null : (trend === 'up') === higherIsBetter }
}

/** Variação em pontos percentuais (para margens). */
export function deltaPp(current: number | null | undefined, previous: number | null | undefined, higherIsBetter = true): Delta | null {
  if (current === null || current === undefined || previous === null || previous === undefined) return null
  const pp = Math.round((current - previous) * 10) / 10
  const trend: Trend = Math.abs(pp) < 0.1 ? 'flat' : pp > 0 ? 'up' : 'down'
  return { pct: pp, trend, good: trend === 'flat' ? null : (trend === 'up') === higherIsBetter }
}

export interface SalesSummaryLike {
  revenue: number; orders: number; units: number; ticket: number; fee: number; shipping_cost: number; tax: number
  fixed_expenses: number; cost: number; ads_cost: number; coupon_cost?: number; net_profit_after_ads: number; net_profit_after_ads_pct: number
}

export interface FlowRow { key: string; label: string; value: number; share: number; kind: 'cost' | 'profit' }

/**
 * "Para onde vai cada R$ 100 vendido": as parcelas do faturamento do período (mesmas contas da seção Vendas), em R$ e em %
 * do faturamento. O lucro pós Ads é o que sobra; se for negativo, aparece como prejuízo.
 */
export function moneyFlow(s: SalesSummaryLike | null | undefined): FlowRow[] {
  if (!s || !s.revenue) return []
  const share = (v: number) => Math.round((v / s.revenue) * 1000) / 10
  const rows: FlowRow[] = [
    { key: 'cost', label: 'Custo dos produtos', value: s.cost, share: 0, kind: 'cost' },
    { key: 'fee', label: 'Tarifas do Mercado Livre', value: s.fee, share: 0, kind: 'cost' },
    { key: 'shipping', label: 'Frete', value: s.shipping_cost, share: 0, kind: 'cost' },
    { key: 'tax', label: 'Impostos', value: s.tax, share: 0, kind: 'cost' },
    { key: 'fixed', label: 'Despesas operacionais', value: s.fixed_expenses, share: 0, kind: 'cost' },
    { key: 'ads', label: 'Ads', value: s.ads_cost, share: 0, kind: 'cost' },
    ...(s.coupon_cost ? [{ key: 'coupon', label: 'Cupons', value: s.coupon_cost, share: 0, kind: 'cost' as const }] : []),
    { key: 'profit', label: s.net_profit_after_ads >= 0 ? 'Lucro pós Ads' : 'Prejuízo pós Ads', value: s.net_profit_after_ads, share: 0, kind: 'profit' }
  ]
  return rows.map((r) => ({ ...r, share: share(r.value) }))
}

export interface AttentionItem { key: string; label: string; detail: string; count: number; to: string; tone: 'danger' | 'warning' | 'info' }

interface AttentionInput {
  attention?: { claims: number; questions: number; messages: number } | null
  promotions?: { below_min?: number; to_switch?: number; to_review?: number } | null
  alerts?: { key: string; title: string; description: string; severity: 'bad' | 'warn' | 'info'; count: number }[] | null
}

const ALERT_LINKS: Record<string, string> = {
  under_review: '/anuncios', sales_drop: '/anuncios', low_coverage: '/estoque', visits_no_sales: '/anuncios',
  low_quality: '/curva-abc', paused_selling: '/anuncios'
}

/** "Precisa da sua atenção": o que espera o vendedor, do mais urgente (atender cliente) ao que pode esperar. */
export function attentionItems(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = []
  const a = input.attention
  if (a?.claims) items.push({ key: 'claims', label: 'Reclamações a atender', detail: 'Responder evita perder reputação', count: a.claims, to: '/reclamacoes', tone: 'danger' })
  if (a?.questions) items.push({ key: 'questions', label: 'Perguntas sem resposta', detail: 'Responder rápido ajuda a vender', count: a.questions, to: '/perguntas', tone: 'danger' })
  if (a?.messages) items.push({ key: 'messages', label: 'Mensagens de compradores', detail: 'Pós-venda aguardando', count: a.messages, to: '/mensagens', tone: 'warning' })
  const p = input.promotions
  if (p?.below_min) items.push({ key: 'promo_below', label: 'Promoções abaixo da margem mínima', detail: 'Vendendo com margem menor que a sua regra', count: p.below_min, to: '/promocoes?aba=decidir&filtro=abaixo_minima', tone: 'warning' })
  if (p?.to_switch) items.push({ key: 'promo_switch', label: 'Ofertas melhores disponíveis', detail: 'Trocar de promoção aumenta o lucro', count: p.to_switch, to: '/promocoes?aba=decidir&filtro=trocar', tone: 'info' })
  if (p?.to_review) items.push({ key: 'promo_review', label: 'Promoções para revisar', detail: 'Barradas pelas regras', count: p.to_review, to: '/promocoes?aba=decidir&filtro=para_revisar', tone: 'warning' })
  for (const al of input.alerts ?? []) {
    if (!al.count) continue
    items.push({ key: `alert_${al.key}`, label: al.title, detail: al.description, count: al.count, to: ALERT_LINKS[al.key] ?? '/anuncios', tone: al.severity === 'bad' ? 'danger' : al.severity === 'warn' ? 'warning' : 'info' })
  }
  const rank = { danger: 0, warning: 1, info: 2 }
  return items.sort((x, y) => rank[x.tone] - rank[y.tone])
}

/** Saudação pelo horário. */
export function greeting(date: Date = new Date()): string {
  const h = date.getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}
