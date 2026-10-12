import { describe, expect, it, vi } from 'vitest'
import { defaultFilters } from './radar'
import { createRadarSearchesClient, describeFilters, restoreFilters } from './radarSearchesClient'

describe('radarSearchesClient', () => {
  it('lista as consultas', async () => {
    const api = vi.fn().mockResolvedValue({ searches: [] })
    await createRadarSearchesClient(api).list()
    expect(api).toHaveBeenCalledWith('/api/radar/searches')
  })

  it('salva uma consulta', async () => {
    const api = vi.fn().mockResolvedValue({ search: {} })
    const body = {
      category_path: 'Pet Shop', filters: defaultFilters(), data_ref: '2026-09-23',
      total_items: 1, total_sold: 2, total_revenue: 3, median_price: 4
    }
    await createRadarSearchesClient(api).create(body)
    expect(api).toHaveBeenCalledWith('/api/radar/searches', { method: 'POST', body })
  })
})

describe('restoreFilters', () => {
  it('completa com o padrão o que a consulta antiga não tinha', () => {
    const f = restoreFilters({ category: 'Pet Shop', period: 30 }, defaultFilters())
    expect(f.category).toBe('Pet Shop')
    expect(f.period).toBe(30)
    expect(f.sort).toBe('rev')
    expect(f.seller).toBe('')
  })
})

describe('describeFilters', () => {
  it('resume só o que foge do padrão', () => {
    const f = { ...defaultFilters(), period: 30, catalog: 'only' as const, priceMin: '100', rating: '4.5' }
    expect(describeFilters(f)).toBe('30 dias · só catálogo · preço 100–∞ · nota 4.5+')
  })

  it('"últimos N dias" personalizado vence o período', () => {
    expect(describeFilters({ ...defaultFilters(), customDays: '45' })).toBe('45 dias')
  })

  it('período 0 vira todo o período', () => {
    expect(describeFilters({ ...defaultFilters(), period: 0 })).toBe('todo o período')
  })
})
