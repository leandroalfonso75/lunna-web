import { describe, expect, it, vi } from 'vitest'
import type { SalesFilters } from '../types/sales'
import { buildSalesQuery, createSalesClient } from './salesClient'

const base: SalesFilters = {
  period: '30d', from: '', to: '', status: '', shipping: '', logistic: '', q: '',
  sort: 'date', dir: 'desc', page: 1, perPage: 50
}

describe('buildSalesQuery', () => {
  it('manda só o que foi escolhido', () => {
    expect(buildSalesQuery('acc1', base)).toEqual({
      account_id: 'acc1', sort: 'date', dir: 'desc', page: '1', per_page: '50', period: '30d'
    })
  })

  it('inclui situação, envio, logística e busca (sem espaços nas pontas)', () => {
    const query = buildSalesQuery('acc1', { ...base, status: 'paid', shipping: 'transit', logistic: 'full', q: '  SKU-1 ' })
    expect(query).toMatchObject({ status: 'paid', shipping: 'transit', logistic: 'full', q: 'SKU-1' })
  })

  it('período personalizado manda from/to no lugar de period', () => {
    const query = buildSalesQuery('acc1', { ...base, period: 'custom', from: '2026-09-01', to: '2026-09-30' })
    expect(query).toMatchObject({ from: '2026-09-01', to: '2026-09-30' })
    expect(query).not.toHaveProperty('period')
  })
})

describe('createSalesClient', () => {
  it('list, detail e sync usam as rotas de /api/sales', async () => {
    const api = vi.fn().mockResolvedValue({})
    const client = createSalesClient(api)

    await client.list({ account_id: 'acc1' })
    expect(api).toHaveBeenLastCalledWith('/api/sales', { query: { account_id: 'acc1' }, signal: undefined })

    await client.detail('acc1', 2000001)
    expect(api).toHaveBeenLastCalledWith('/api/sales/2000001', { query: { account_id: 'acc1' } })

    await client.detail('acc1', 2000001, { period: '7d' })
    expect(api).toHaveBeenLastCalledWith('/api/sales/2000001', { query: { account_id: 'acc1', period: '7d' } })

    await client.sync('acc1')
    expect(api).toHaveBeenLastCalledWith('/api/sales/sync', { method: 'POST', query: { account_id: 'acc1' } })
  })
})
