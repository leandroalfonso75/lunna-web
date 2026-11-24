import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '../stores/session'

/** Estoque › Full: colunas ordenáveis, com Sugerido decrescente ao abrir (pedido do usuário em 24/11/2026). */
const api = vi.fn()
vi.stubGlobal('useNuxtApp', () => ({ $api: api }))
vi.mock('../composables/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))

const EstoquePage = (await import('./estoque.vue')).default

const EMPTY = { summary: { products: 0, replenish: 0, urgent: 0, suggested_units: 0, can_send_units: 0, to_buy_units: 0, out_of_stock: 0, lost_revenue: 0 },
  rows: [], total: 0, page: 1, per_page: 50, synced_at: null }

function lastQuery() {
  const calls = api.mock.calls.filter(([url]) => url === '/api/stock/full')
  return calls[calls.length - 1]?.[1]?.query
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.mockReset()
  api.mockResolvedValue(EMPTY)
  const session = useSessionStore()
  session.mlAccounts = [{ id: 'acc', nickname: 'LOJA' } as never]
  session.selectedAccountId = 'acc'
})

describe('estoque.vue (Full)', () => {
  it('abre ordenado por Sugerido, do maior para o menor', async () => {
    const w = mount(EstoquePage, { global: { stubs: { PageHeader: true, LogisticBadge: true } } })
    await flushPromises()
    expect(lastQuery()).toMatchObject({ view: 'repor', sort: 'suggested', dir: 'desc' })
    expect(w.get('[data-test="ordenar-suggested"]').element.closest('th')?.getAttribute('aria-sort')).toBe('descending')
  })

  it('clicar numa coluna ordena por ela; clicar de novo inverte', async () => {
    const w = mount(EstoquePage, { global: { stubs: { PageHeader: true, LogisticBadge: true } } })
    await flushPromises()

    await w.get('[data-test="ordenar-can_send"]').trigger('click')
    await flushPromises()
    expect(lastQuery()).toMatchObject({ sort: 'can_send', dir: 'desc', page: 1 })

    await w.get('[data-test="ordenar-can_send"]').trigger('click')
    await flushPromises()
    expect(lastQuery()).toMatchObject({ sort: 'can_send', dir: 'asc' })

    await w.get('[data-test="ordenar-olist"]').trigger('click')
    await flushPromises()
    expect(lastQuery()).toMatchObject({ sort: 'olist', dir: 'desc' })
  })
})
