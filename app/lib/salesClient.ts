import type { SaleDetail, SalesFilters, SalesResponse } from '../types/sales'

type ApiFn = (path: string, options?: Record<string, unknown>) => Promise<any>

/** Monta os parâmetros de `GET /api/sales` a partir dos filtros da tela (só envia o que foi escolhido). */
export function buildSalesQuery(accountId: string, f: SalesFilters): Record<string, string> {
  const query: Record<string, string> = { account_id: accountId, sort: f.sort, dir: f.dir, page: String(f.page), per_page: String(f.perPage) }
  if (f.period === 'custom' && f.from && f.to) {
    query.from = f.from
    query.to = f.to
  } else {
    query.period = f.period
  }
  if (f.status) query.status = f.status
  if (f.shipping) query.shipping = f.shipping
  if (f.logistic) query.logistic = f.logistic
  if (f.q.trim()) query.q = f.q.trim()
  return query
}

/** Leituras da seção Vendas (`/api/sales`). Sem composables do Nuxt, para testar direto. */
export function createSalesClient(api: ApiFn) {
  return {
    list(params: Record<string, string>, options: { signal?: AbortSignal } = {}): Promise<SalesResponse> {
      return api('/api/sales', { query: params, signal: options.signal })
    },
    detail(accountId: string, orderId: number): Promise<SaleDetail> {
      return api(`/api/sales/${orderId}`, { query: { account_id: accountId } })
    },
    /** Baixa de novo os últimos 3 meses (pedidos + envios). Só administradores. */
    sync(accountId: string): Promise<{ queued: boolean }> {
      return api('/api/sales/sync', { method: 'POST', query: { account_id: accountId } })
    }
  }
}

export type SalesClient = ReturnType<typeof createSalesClient>
