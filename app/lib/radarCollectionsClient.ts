type ApiFn = (path: string, options?: Record<string, unknown>) => Promise<any>

export type CollectionStatus = 'requested' | 'collecting' | 'done' | 'failed'

export interface RadarCollection {
  id: string
  category_path: string
  status: CollectionStatus
  error: string | null
  items_count: number | null
  requested_by: string | null
  requested_at: string
  started_at: string | null
  finished_at: string | null
}

export const COLLECTION_STATUS_LABEL: Record<CollectionStatus, string> = {
  requested: 'Aguardando coleta',
  collecting: 'Coletando',
  done: 'Concluída',
  failed: 'Falhou'
}

/** Pedido ainda em aberto: não terminou nem falhou. */
export function isActiveCollection(c: Pick<RadarCollection, 'status'>): boolean {
  return c.status === 'requested' || c.status === 'collecting'
}

/**
 * Fila de pedidos de coleta do Radar (`/api/radar/collections`). O pedido só
 * registra a intenção do usuário; nada é coletado nem agendado por aqui.
 */
export function createRadarCollectionsClient(api: ApiFn) {
  return {
    list(): Promise<{ collections: RadarCollection[] }> {
      return api('/api/radar/collections')
    },

    request(categoryPath: string): Promise<{ collection: RadarCollection }> {
      return api('/api/radar/collections', { method: 'POST', body: { category_path: categoryPath } })
    },

    cancel(id: string): Promise<void> {
      return api(`/api/radar/collections/${id}`, { method: 'DELETE' })
    }
  }
}

export type RadarCollectionsClient = ReturnType<typeof createRadarCollectionsClient>
