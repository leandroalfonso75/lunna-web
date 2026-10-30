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
  /** Lucro e margem antes de descontar o Ads. */
  profit_before_ads: number | null
  margin_before_ads_pct: number | null
  /** Parte do desconto paga pelo Mercado Livre, em R$ por unidade. */
  meli_amount: number
  valid: boolean
  reason: string | null
  start_date: string | null
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
  /** Relâmpago/oferta do dia: unidades que o ML sugere reservar (o Lunna reserva isso ao entrar). */
  stock_reserved: number | null
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
  /** Regras específicas do anúncio, em texto livre. */
  rules_note: string | null
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
  /** Anúncio de catálogo: sincronizado com um tradicional ou não; null = tradicional. */
  catalog: 'sincronizado' | 'sem_sincronizacao' | null
  /** Tradicional sincronizado com um anúncio de catálogo. */
  synced_with_catalog: boolean
  /** Vendas: total do anúncio (ML) e unidades nos últimos 30 dias. */
  sold_total: number | null
  sold_30d: number
  /** Anúncio de catálogo: ganhando ou perdendo a vitrine e, perdendo, o preço para ganhar e a oferta que chega nele. */
  catalog_info: CatalogInfo | null
  full_price: number
  cost: number | null
  base: { price: number; profit: number; margin_pct: number; profit_before_ads: number; margin_before_ads_pct: number; costs: PromotionCosts } | null
  /** Ads dos últimos 15 dias: gasto, unidades vendidas e custo por unidade (zero sem histórico). */
  ads: { spend: number; units: number; unit: number; days: number }
  current: PromotionOfferShort | null
  best: PromotionOfferShort | null
  /** Lucro a mais por unidade se trocar pela melhor oferta. */
  gain: number | null
  offers_count: number
  settings: PromotionSettings
  status: { key: string; label: string; tone: Tone }
  /** Em "Para revisar": a regra que barrou a promoção atual e as que barraram as ofertas. */
  review: {
    current_reason: string | null
    reasons: { reason: string; offers: number }[]
    label: string
    /** A melhor oferta entre as barradas (maior margem), com o que faltou para caber. */
    blocked_best: (PromotionOfferShort & { shortfall: string }) | null
    /** O que mudar nos limites para a melhor barrada caber (null quando não há saída). */
    suggestion: string | null
    /** Campo e valor dos limites que fariam a melhor barrada caber (botão "Usar a sugestão"). */
    suggested: { field: 'min_margin_pct' | 'max_margin_pct' | 'min_price' | 'max_price'; value: number } | null
  } | null
  notes: string | null
  /** "Não automatizar promoções neste anúncio": a rotina e o lote não mexem; a melhor oferta segue sugerida. */
  manual: boolean
}

/** Produto com variações: uma linha para o produto pai (Olist) e os anúncios de todas as variações dentro. */
export interface PromotionGroupRow {
  group: true
  key: string
  parent_olist_id: number
  title: string
  sku: string | null
  thumbnail: string | null
  /** Anúncio que representa o grupo nos limites (aplicados a todas as variações). */
  item_id: string
  count: number
  variations: number
  /** Quantos anúncios do grupo passaram no filtro (só com filtro ativo). */
  matched?: number
  price_min: number
  price_max: number
  gain: number | null
  current_margin: number | null
  best_margin: number | null
  status: { key: string; label: string; tone: Tone }
  statuses: Record<string, number>
  children: PromotionItemRow[]
}

export type PromotionListRow = PromotionItemRow | PromotionGroupRow

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

export interface CatalogInfo {
  state: 'ganhando' | 'compartilhando' | 'perdendo' | 'sem_dados'
  ml_status: string | null
  checked_at: string | null
  /** Preço que o comprador paga hoje (com a promoção atual). */
  price_today: number
  price_to_win: number | null
  winner_price: number | null
  reduce_by?: number
  reduce_pct?: number | null
  suggestion?: PromotionOfferShort | null
  message?: string
}

/** Regras da automação (rotina e lote), por empresa. */
export interface PromotionAutomation {
  routine_enabled: boolean
  routine_mode: 'simulation' | 'apply'
  /** Hora cheia (0 a 23) e dias da semana (0 = domingo … 6 = sábado) da rotina, no horário de Brasília. */
  schedule_hour: number
  schedule_days: number[]
  /** Qual lucro vale para a margem mínima/máxima. */
  margin_basis: 'after_ads' | 'before_ads'
  /** O preço final busca a margem mínima ou a máxima (a outra é barreira). */
  price_target: 'min' | 'max'
  /** Pode subir o preço final para entrar em outra promoção (dentro da máxima). */
  allow_price_increase: boolean
  allow_margin_drop: boolean
  /** Pontos percentuais que a margem pode cair (com allow_margin_drop). */
  margin_drop_tolerance: number | null
  allow_lightning: boolean
  include_catalog: boolean
}

/** Anúncio de catálogo que seguiu sem ganhar depois de voltar ao preço anterior. */
export interface CatalogAlert {
  id: number
  item_id: string
  title: string | null
  ml_status: string | null
  message: string | null
  checked_at: string | null
}

export interface PromotionsResponse {
  summary: {
    items: number
    with_promotion: number
    without_promotion: number
    to_switch: number
    switch_gain: number
    below_min: number
    to_review: number
    without_cost: number
  }
  counts: Record<string, number>
  items: PromotionListRow[]
  total: number
  page: number
  per_page: number
  sort: string
  dir: 'asc' | 'desc'
  promotions: MlPromotionRow[]
  rules: { min_margin_pct: number; max_margin_pct: number | null }
  automation: PromotionAutomation
  catalog_alerts: CatalogAlert[]
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
  /** Quantos outros anúncios foram para a fila com a mesma promoção. */
  queued?: number
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
  /** Aplicado mesmo assim: a regra do Lunna que a oferta feria. */
  forced_reason: string | null
  from: { name: string; price: number | null; margin_pct: number | null } | null
  to: { name: string; price: number | null; margin_pct: number | null } | null
  gain: number | null
  user: string | null
  created_at: string
}

/** Uma execução da rotina automática (agendada ou "Simular agora"). */
export interface PromotionRun {
  id: number
  mode: 'simulation' | 'apply'
  mode_label: string
  trigger: string
  trigger_label: string
  status: 'running' | 'done' | 'failed'
  started_at: string
  finished_at: string | null
  error: string | null
  /** simulado | aplicado | erro | revisar | sem_mudanca | regra_propria | automacao_desligada | anuncios */
  totals: Record<string, number>
}

export interface PromotionRunRow {
  item_id: string
  title: string | null
  sku: string | null
  thumbnail: string | null
  kind: string
  kind_label: string
  /** true = a rotina mudaria/mudou a promoção; false = não mexeu (revisar, regra própria…). */
  changes: boolean
  ok: boolean
  reason: string | null
  before: { name: string; price: number | null; margin_pct: number | null; profit: number | null } | null
  after: { name: string; price: number | null; margin_pct: number | null; profit: number | null } | null
  price_change_pct: number | null
  gain: number | null
}

export interface PromotionRunDetail extends PromotionRun {
  gain_total: number
  price_up: number
  price_down: number
  gain_up: number
  gain_down: number
  rows: PromotionRunRow[]
}

export interface PromotionRunsResponse {
  routine: { enabled: boolean; mode: 'simulation' | 'apply' }
  running: boolean
  runs: PromotionRun[]
}

/** Levar a mesma promoção aos outros anúncios do SKU e/ou das outras variações do produto (em fila). */
export interface PromotionSpread {
  alsoSku: boolean
  alsoVariations: boolean
}

/** Oferta escolhida na tela (sem ela, vale a melhor). */
export interface PromotionTarget {
  promotion_id: string | null
  promotion_type: string
  action: 'aderir' | 'editar_preco'
  /** Outro preço final (só ofertas de faixa, dentro da faixa do ML). */
  price?: number
  /** "Aplicar mesmo assim": aplica ferindo as regras do Lunna (fica no Histórico a regra ferida). */
  force?: boolean
}

/** Campos de número: o formulário pode entregar texto ou número (`v-model` de input type="number"). */
export interface PromotionSettingsInput {
  limit_mode: 'margin' | 'price'
  min_margin_pct: string | number
  max_margin_pct: string | number
  min_price: string | number
  max_price: string | number
  apply_to_sku: boolean
  apply_to_variations: boolean
  rules_note: string
}
