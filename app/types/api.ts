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
