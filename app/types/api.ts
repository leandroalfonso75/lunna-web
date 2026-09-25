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
}

export type CompanyUpdatePayload = Partial<Omit<Company, 'id'>>

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
