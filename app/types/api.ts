/**
 * Shapes devolvidos pela API do Lunna (contrato em
 * `lunna-api/docs/DECISOES.md`, seção 7). Ao contrário de outros painéis do
 * ecossistema, aqui as respostas NÃO vêm envelopadas em `{data: ...}` — cada
 * endpoint devolve o objeto direto (`{user, company, ml_accounts}`, etc.).
 */

export type UserRole = 'admin' | 'member'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface Company {
  id: string
  name: string
  tax_pct: number
  min_margin_pct: number
  /** Margem máxima geral das promoções (opcional; null = sem teto). */
  max_margin_pct?: number | null
  /** Rotina automática da seção Promoções: ligada e em que modo (simulation = só registra; apply = aplica no ML). */
  promo_routine_enabled?: boolean
  promo_routine_mode?: 'simulation' | 'apply'
  /** Promoções: permitir reduzir a margem ao buscar a mínima, até a tolerância (pontos percentuais). */
  promo_allow_margin_drop?: boolean
  promo_margin_drop_tolerance?: number | null
  /** Promoções: anúncios de catálogo entram na automação (com conferência de 1 em 1 hora). */
  promo_include_catalog?: boolean
  promo_schedule_hour?: number
  /** Base do custo de Ads por unidade em Anúncios e Promoções: 7, 15 ou 30 dias fechados. */
  ads_cost_days?: 7 | 15 | 30
  promo_schedule_days?: number[]
  promo_margin_basis?: 'after_ads' | 'before_ads'
  promo_price_target?: 'min' | 'max'
  promo_allow_price_increase?: boolean
  promo_allow_lightning?: boolean
  abc_cut_a: number
  abc_cut_b: number
  group_up_pct: number
  group_down_pct: number
  /** Plano de ação com IA via OpenRouter (DECISOES.md §10) — por empresa. */
  ai_model: string | null
  /** `true` quando a empresa tem chave **e** modelo configurados. */
  ai_configured: boolean
  /** `"…" + últimos 4 caracteres da chave`, ou `null` sem chave. A chave em si nunca vem da API. */
  ai_key_hint: string | null
}

/**
 * `ai_configured`/`ai_key_hint` são derivados pela API — nunca enviados.
 * `openrouter_api_key`/`remove_openrouter_api_key` não existem no shape de
 * leitura (`Company`): a chave em si nunca é devolvida pela API.
 */
export type CompanyUpdatePayload = Partial<Omit<Company, 'id' | 'ai_configured' | 'ai_key_hint'>> & {
  openrouter_api_key?: string
  remove_openrouter_api_key?: boolean
}

export interface SyncRun {
  id: string
  started_at: string
  finished_at: string | null
  ok: boolean | null
  items: number | null
  orders: number | null
  detail: string | null
}

export type MlAccountStatus = 'active' | 'reauth_required'

export interface MlAccount {
  id: string
  seller_id: number
  nickname: string
  status: MlAccountStatus
  last_error: string | null
  connected_at: string
  last_sync: SyncRun | null
}

/** `POST /auth/sign_in` / `POST /auth/sign_up` — corpo da resposta. */
export interface AuthResponse {
  token: string
  user: User
  company: Company
  ml_accounts: MlAccount[]
}

/** `GET /api/me`. */
export interface MeResponse {
  user: User
  company: Company
  ml_accounts: MlAccount[]
}

/** Toda falha da API do Lunna. */
export interface ApiErrorBody {
  errors: string[]
}
