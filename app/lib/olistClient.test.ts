import { describe, expect, it, vi } from 'vitest'
import { createOlistClient, formatQty, toNumber } from './olistClient'

describe('olistClient', () => {
  it('status faz GET /api/olist', async () => {
    const api = vi.fn().mockResolvedValue({ olist: { connected: true } })
    await createOlistClient(api).status()
    expect(api).toHaveBeenCalledWith('/api/olist')
  })

  it('products manda só os filtros preenchidos', async () => {
    const api = vi.fn().mockResolvedValue({ products: [] })
    await createOlistClient(api).products({ q: 'secador', status: '', limit: 50, offset: 0 })
    expect(api).toHaveBeenCalledWith('/api/olist/products', { query: { q: 'secador', limit: 50 } })
  })

  it('products repassa situação e página', async () => {
    const api = vi.fn().mockResolvedValue({ products: [] })
    await createOlistClient(api).products({ status: 'A', limit: 50, offset: 100 })
    expect(api).toHaveBeenCalledWith('/api/olist/products', { query: { status: 'A', limit: 50, offset: 100 } })
  })

  it('sync faz POST /api/olist/sync', async () => {
    const api = vi.fn().mockResolvedValue({ sync_run: {}, already_running: false })
    await createOlistClient(api).sync()
    expect(api).toHaveBeenCalledWith('/api/olist/sync', { method: 'POST' })
  })
})

describe('toNumber', () => {
  it('converte decimais em texto e trata vazio', () => {
    expect(toNumber('229.9')).toBe(229.9)
    expect(toNumber(5)).toBe(5)
    expect(toNumber(null)).toBeNull()
    expect(toNumber('')).toBeNull()
    expect(toNumber('abc')).toBeNull()
  })
})

describe('formatQty', () => {
  it('inteiro sem casas, fracionado com até 3', () => {
    expect(formatQty('288.0')).toBe('288')
    expect(formatQty('1234')).toBe('1.234')
    expect(formatQty('0.5')).toBe('0,5')
    expect(formatQty('-3.0')).toBe('-3')
    expect(formatQty(null)).toBe('—')
  })
})
