type ApiFn = (path: string, options?: Record<string, unknown>) => Promise<any>

export type OlistProductStatus = 'A' | 'I' | 'E'

export interface OlistDeposit {
  id: number
  nome: string
  desconsiderar?: boolean
  saldo: number
  reservado: number
  disponivel: number
}

/** Número que a API devolve como texto decimal ("229.9") ou null. */
export type Decimal = string | number | null

export interface OlistProduct {
  id: number
  sku: string | null
  description: string | null
  kind: string | null
  status: OlistProductStatus | null
  variation_kind: string | null
  unit: string | null
  gtin: string | null
  price: Decimal
  promo_price: Decimal
  cost_price: Decimal
  avg_cost_price: Decimal
  stock: {
    balance: Decimal
    reserved: Decimal
    available: Decimal
    location: string | null
    deposits: OlistDeposit[]
  }
  olist_created_at: string | null
  olist_updated_at: string | null
  synced_at: string
}

export interface OlistProductsResponse {
  products: OlistProduct[]
  total: number
  limit: number
  offset: number
  last_synced_at: string | null
}

export interface OlistSyncRun {
  id: string
  trigger: 'auto' | 'manual'
  status: 'running' | 'success' | 'failed'
  products_count: number | null
  error: string | null
  started_at: string
  finished_at: string | null
}

export interface OlistStatus {
  configured: boolean
  connected: boolean
  status?: string
  error?: string | null
  products_count?: number
  last_sync?: OlistSyncRun | null
}

export interface OlistProductsQuery {
  q?: string
  status?: OlistProductStatus | ''
  limit?: number
  offset?: number
}

/**
 * Produtos do Olist ERP guardados no Lunna (`/api/olist/*`). A lista vem do
 * banco do Lunna, atualizado a cada 3 minutos; `sync` pede a atualização agora.
 */
export function createOlistClient(api: ApiFn) {
  return {
    status(): Promise<{ olist: OlistStatus }> {
      return api('/api/olist')
    },

    products(query: OlistProductsQuery = {}): Promise<OlistProductsResponse> {
      const clean: Record<string, string | number> = {}
      if (query.q) clean.q = query.q
      if (query.status) clean.status = query.status
      if (query.limit) clean.limit = query.limit
      if (query.offset) clean.offset = query.offset
      return api('/api/olist/products', { query: clean })
    },

    sync(): Promise<{ sync_run: OlistSyncRun; already_running: boolean }> {
      return api('/api/olist/sync', { method: 'POST' })
    }
  }
}

export type OlistClient = ReturnType<typeof createOlistClient>

export const STATUS_LABEL: Record<string, string> = { A: 'Ativo', I: 'Inativo', E: 'Excluído' }
export const KIND_LABEL: Record<string, string> = { S: 'Simples', K: 'Kit', V: 'Com variações', F: 'Fabricado', M: 'Matéria-prima' }
export const VARIATION_LABEL: Record<string, string> = { N: 'Normal', P: 'Pai', V: 'Variação' }

/** Decimal da API (texto ou número) → número, ou null se vazio/inválido. */
export function toNumber(value: Decimal | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Quantidade de estoque: inteiro quando for inteiro, senão até 3 casas. */
export function formatQty(value: Decimal | undefined): string {
  const n = toNumber(value)
  if (n === null) return '—'
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: Number.isInteger(n) ? 0 : 3 }).format(n)
}
