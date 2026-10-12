import { describe, expect, it, vi } from 'vitest'
import { createRadarCollectionsClient, isActiveCollection } from './radarCollectionsClient'

describe('radarCollectionsClient', () => {
  it('lista os pedidos', async () => {
    const api = vi.fn().mockResolvedValue({ collections: [] })
    await createRadarCollectionsClient(api).list()
    expect(api).toHaveBeenCalledWith('/api/radar/collections')
  })

  it('registra um pedido com o caminho da categoria', async () => {
    const api = vi.fn().mockResolvedValue({ collection: { id: '1' } })
    await createRadarCollectionsClient(api).request('Pet Shop > Cães')
    expect(api).toHaveBeenCalledWith('/api/radar/collections', { method: 'POST', body: { category_path: 'Pet Shop > Cães' } })
  })

  it('cancela um pedido pelo id', async () => {
    const api = vi.fn().mockResolvedValue(undefined)
    await createRadarCollectionsClient(api).cancel('abc')
    expect(api).toHaveBeenCalledWith('/api/radar/collections/abc', { method: 'DELETE' })
  })

  it('só pedidos requested/collecting estão em aberto', () => {
    expect(isActiveCollection({ status: 'requested' })).toBe(true)
    expect(isActiveCollection({ status: 'collecting' })).toBe(true)
    expect(isActiveCollection({ status: 'done' })).toBe(false)
    expect(isActiveCollection({ status: 'failed' })).toBe(false)
  })
})
