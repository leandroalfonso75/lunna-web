import { describe, expect, it, vi } from 'vitest'
import { createPainelClient } from './painelClient'

function buildClient(resolvedValue: unknown = {}) {
  const api = vi.fn().mockResolvedValue(resolvedValue)
  return { api, client: createPainelClient(api) }
}

describe('createPainelClient', () => {
  it('getPainel faz GET /api/painel com account_id', async () => {
    const { api, client } = buildClient({ account: { id: 'acc1' } })
    const result = await client.getPainel('acc1')
    expect(api).toHaveBeenCalledWith('/api/painel', { query: { account_id: 'acc1' }, signal: undefined })
    expect(result).toEqual({ account: { id: 'acc1' } })
  })

  it('getPainel repassa o AbortSignal quando informado', async () => {
    const { api, client } = buildClient()
    const controller = new AbortController()
    await client.getPainel('acc1', { signal: controller.signal })
    expect(api).toHaveBeenCalledWith('/api/painel', { query: { account_id: 'acc1' }, signal: controller.signal })
  })

  it('getItems repassa os params já montados (por lib/itemsQuery.ts) direto, sem alterar', async () => {
    const { api, client } = buildClient({ items: [] })
    const params = { account_id: 'acc1', status: 'active', page: '1' }
    await client.getItems(params)
    expect(api).toHaveBeenCalledWith('/api/items', { query: params, signal: undefined })
  })

  it('getAbc faz GET /api/abc com account_id e curve (padrão "all")', async () => {
    const { api, client } = buildClient({ rows: [] })
    await client.getAbc('acc1')
    expect(api).toHaveBeenCalledWith('/api/abc', { query: { account_id: 'acc1', curve: 'all' }, signal: undefined })
  })

  it('getAbc aceita curve explícito', async () => {
    const { api, client } = buildClient()
    await client.getAbc('acc1', 'A')
    expect(api).toHaveBeenCalledWith('/api/abc', { query: { account_id: 'acc1', curve: 'A' }, signal: undefined })
  })

  it('getAbcItem faz GET /api/abc/items/:id com account_id', async () => {
    const { api, client } = buildClient({ indicators: {} })
    await client.getAbcItem('acc1', 'MLB123')
    expect(api).toHaveBeenCalledWith('/api/abc/items/MLB123', { query: { account_id: 'acc1' }, signal: undefined })
  })
})
