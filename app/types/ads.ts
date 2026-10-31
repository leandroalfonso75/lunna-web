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

/** Métricas somadas de uma janela (anúncio, família, campanha ou conta). */
export interface AdsAnalysisMetrics {
  cost: number
  revenue: number
  clicks: number
  prints: number
  units: number
  roas: number | null
  acos: number | null
  ctr: number | null
  cvr: number | null
  cpc: number | null
}

export interface AdsAnalysisSignal {
  type: string
  priority: 'alta' | 'media' | 'baixa'
  value: number | null
  detail: string
  item_ids?: string[]
  campaign_id?: number
}

export interface AdsAnalysisItem extends AdsAnalysisMetrics {
  item_id: string
  title: string | null
  status: string
  campaign_id: number | null
  campaign: string | null
  thumbnail: string | null
  permalink: string | null
  price: number | null
  image_quality: string | null
  catalog: boolean | null
  buy_box_winner: boolean | null
  recommended: boolean | null
  date_created: string | null
  age_days: number | null
}

export interface AdsAnalysisFamily {
  key: string
  family_id: string | null
  name: string | null
  domain: string | null
  thumbnail: string | null
  n_items: number
  n_active: number
  campaigns: number[]
  campaign_names: string[]
  metrics: AdsAnalysisMetrics
  previous: AdsAnalysisMetrics
  month: AdsAnalysisMetrics
  variation: { cost: number | null; revenue: number | null; roas: number | null }
  /** ROAS de Equilíbrio = 1 ÷ margem bruta, com o custo real; null sem custo. */
  economics: { price: number; cost: number | null; margin_pct: number; roas_equilibrio: number | null; complete: boolean; alert: string | null } | null
  sample: { cvr_ok: boolean; ctr_ok: boolean }
  items: AdsAnalysisItem[]
  signals: AdsAnalysisSignal[]
  untouchable: { reason: string; until: string | null } | null
}

export interface AdsAnalysisCampaign {
  id: number
  name: string
  status: string
  strategy: string | null
  roas_target: number | null
  acos_target: number | null
  budget: number | null
  daily_budget: number | null
  families: number
  attribution: 'exata' | 'compartilhada'
  metrics: AdsAnalysisMetrics
  equilibrium: number | null
  auction: {
    impression_share: number | null
    top_impression_share: number | null
    lost_by_budget: number | null
    lost_by_ad_rank: number | null
    acos_benchmark: number | null
    consistent: boolean | null
    prev_impression_share: number | null
    synced_at: string | null
  }
  acos_vs_benchmark: number | null
}

export interface AdsAnalysisQueueItem {
  n?: number
  key: string
  class: 'destravar' | 'desperdicio' | 'alocacao' | 'orcamento' | 'posicao' | 'ajuste'
  class_label: string
  title: string
  signal: string
  value: number | null
  value_how: string | null
  evidence: string
  action: string
  check_before: string
  reassess: string
  /** Códigos dos anúncios envolvidos (vazio em item de campanha) e as campanhas em que estão. */
  item_ids: string[]
  campaigns: string[]
  /** perdido = dinheiro gasto sem retorno (vermelho); deixou_de_ganhar = receita que não veio (preto). */
  value_kind: 'perdido' | 'deixou_de_ganhar'
  value_label: string
  /** Já decidido nos últimos 7 dias (feito ou ignorado). */
  decided?: { id: number; status: 'feito' | 'ignorado'; at: string } | null
}

/** Uma decisão da fila, com o "antes" (gravado na hora) e o "depois" (7 dias fechados seguintes; parcial até completar). */
export interface AdsDecision {
  id: number
  key: string
  signal: string
  class: string
  class_label: string
  title: string | null
  action: string | null
  value: number | null
  status: 'feito' | 'ignorado'
  decided_at: string
  user: string | null
  before: { cost?: number; revenue?: number; roas?: number | null; clicks?: number; prints?: number; tacos?: number | null; period?: { from: string; to: string } }
  after: { cost: number; revenue: number; roas: number | null; clicks: number; prints: number; from: string; to: string; days: number; partial: boolean } | null
}

/** `GET /api/ads/diagnosis`: veredito de uma família ou campanha, no formato do plugin. */
export interface AdsDiagnosis {
  scope: { kind: 'familia' | 'campanha'; key: string; name: string | null; items?: number; active?: number; families?: number; period: { from: string; to: string } }
  symptom: string
  verdict: string
  evidence: string[]
  discarded: string[]
  actions: { action: string; reassess: string }[]
  avoid: string[]
  uncertainty: string[]
}

export interface AdsAnalysisHealth extends AdsAnalysisMetrics {
  organic: number
  total_revenue: number
  tacos: number | null
  ads_share: number | null
  tacos_state: 'ok' | 'warn' | 'bad' | 'sem_dados'
  previous: AdsAnalysisMetrics & { organic: number; total_revenue: number; tacos: number | null; ads_share: number | null }
  variation: { cost: number | null; revenue: number | null; roas: number | null; tacos: number | null; organic: number | null }
}

/** `GET /api/ads/analysis`: análise e fila de decisões de Product Ads (só recomenda). */
export interface AdsAnalysis {
  period: { from: string; to: string; days: number; prev_from: string; prev_to: string }
  rules: { min_clicks: number; min_prints: number; relevant_cost: number; maturity_days: number; max_actions: number; tacos_target: number[]; tacos_bad: number; reference_equilibrium: number; note: string }
  health: AdsAnalysisHealth
  campaigns: AdsAnalysisCampaign[]
  families: AdsAnalysisFamily[]
  queue: AdsAnalysisQueueItem[]
  next_round: AdsAnalysisQueueItem[]
  watch: AdsAnalysisQueueItem[]
  untouchables: { key: string; name: string | null; reason: string; until: string | null }[]
  closing: { tacos: number | null; previous_tacos: number | null; target: number[]; direction: string; text: string }
  decisions: AdsDecision[]
  generated_at: string
}
