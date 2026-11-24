import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive, ref } from 'vue'
import { useSessionStore } from '../../stores/session'

/**
 * Anúncios (pedido do usuário em 24/11/2026): bola da curva ABC (azul A, verde B, vermelha C), data de criação, caixa de
 * seleção, "Excluir anúncios selecionados" com confirmação (Sim/Não) e "Editar anúncios selecionados".
 * Nada vai ao Mercado Livre: a API é simulada.
 */
const api = vi.fn()
vi.stubGlobal('useNuxtApp', () => ({ $api: api }))
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('../../composables/useToast', () => ({ useToast: () => toast }))

function row(id: string, curve: 'A' | 'B' | 'C' | null, date: string | null) {
  return { id, title: `Anúncio ${id}`, status: 'active', status_label: 'Ativo', sku: 'SEC-1', price: 100, original_price: null, stock: 5, full: false,
    economics: null, coverage_days: null, quality_score: null, quality_actions: [], links: { public: '#', seller_panel: '#' }, curve, date_created: date }
}
const response = ref<Record<string, unknown> | null>(null)
const table = {
  filters: reactive({ id: null, status: 'active', q: '', type: '', shipping: '', alert: null, titleFilter: '', skuFilter: '', numericFilters: {} }),
  response, loading: ref(false), stale: ref(false), loadError: ref(''), account: ref({ nickname: 'LOJA' }), sync: ref(null), generatedAt: ref(null), refreshing: ref(false),
  start: vi.fn(), stop: vi.fn(), refreshNow: vi.fn(), sortBy: vi.fn(), setPage: vi.fn(), setStatus: vi.fn(), setQuery: vi.fn(), setType: vi.fn(), setShipping: vi.fn(),
  clearFilters: vi.fn(), setAlert: vi.fn(), setTitleFilter: vi.fn(), setSkuFilter: vi.fn(), setNumericFilter: vi.fn(), showAllItems: vi.fn()
}
vi.mock('../../composables/useItemsTable', () => ({ useItemsTable: () => table }))

const ItemsTable = (await import('./ItemsTable.vue')).default
const mountTable = () => mount(ItemsTable, { global: { stubs: { LogisticBadge: true, ItemsBulkEdit: { props: ['itemIds'], template: '<div data-test="bulk-edit-stub">{{ itemIds.join(",") }}</div>' } } } })

beforeEach(() => {
  setActivePinia(createPinia())
  api.mockReset()
  Object.values(toast).forEach((f) => f.mockReset())
  table.refreshNow.mockReset()
  table.sortBy.mockReset()
  response.value = {
    items: [row('MLB1', 'A', '2024-03-10T12:00:00Z'), row('MLB2', 'B', '2026-01-05T12:00:00Z'), row('MLB3', 'C', null)],
    total: 3, page: 1, per_page: 50, status_counts: { active: 3, paused: 0, closed: 0, all: 3 }, active_filter: { alert: null },
    active_filters_count: 0, invalid_filters: [], sort: 'units_7d', dir: 'desc'
  }
  const session = useSessionStore()
  session.user = { id: 'u1', name: 'Ana', email: 'a@x.com', role: 'admin' } as never
  session.selectedAccountId = 'acc'
})

describe('ItemsTable', () => {
  it('mostra a bola da curva (azul A, verde B, vermelha C) e a data de criação', () => {
    const w = mountTable()
    const balls = w.findAll('[data-curve]')
    expect(balls.map((b) => [b.text(), b.classes().find((c) => c.startsWith('bg-'))])).toEqual([['A', 'bg-info'], ['B', 'bg-success'], ['C', 'bg-danger']])
    expect(w.findAll('[data-test="col-criado"]').map((c) => c.text())).toEqual(['10/03/2024', '05/01/2026', '—'])
  })

  it('ordena por curva e por data de criação pela API', async () => {
    const w = mountTable()
    const header = (label: string) => w.findAll('thead button').find((b) => b.text().startsWith(label))
    await header('Curva')?.trigger('click')
    await header('Criado em')?.trigger('click')
    expect(table.sortBy.mock.calls).toEqual([['curve'], ['date_created']])
  })

  it('sem seleção não mostra as ações; selecionar mostra Excluir e Editar', async () => {
    const w = mountTable()
    expect(w.find('[data-test="acoes-selecionados"]').exists()).toBe(false)
    const boxes = w.findAll('[data-test="selecionar-anuncio"]')
    await boxes[0]?.setValue(true)
    await boxes[2]?.setValue(true)
    expect(w.get('[data-test="contagem-selecionados"]').text()).toContain('2 anúncio(s)')
    expect(w.get('[data-test="excluir-selecionados"]').text()).toBe('Excluir anúncios selecionados')
    expect(w.get('[data-test="editar-selecionados-botao"]').text()).toBe('Editar anúncios selecionados')

    await w.get('[data-test="selecionar-todos"]').setValue(true)
    expect(w.get('[data-test="contagem-selecionados"]').text()).toContain('3 anúncio(s)')
  })

  it('excluir pede confirmação: Não não envia nada; Sim exclui com confirm=true', async () => {
    api.mockResolvedValue({ ok: true, message: '2 anúncio(s) excluído(s) do Mercado Livre.', results: [{ item_id: 'MLB1', ok: true, message: 'ok' }, { item_id: 'MLB2', ok: true, message: 'ok' }] })
    const w = mountTable()
    const boxes = w.findAll('[data-test="selecionar-anuncio"]')
    await boxes[0]?.setValue(true)
    await boxes[1]?.setValue(true)

    await w.get('[data-test="excluir-selecionados"]').trigger('click')
    expect(w.get('[data-test="confirmar-exclusao"]').text()).toContain('Confirma a exclusão do(s) anúncio(s) selecionado(s)?')
    await w.get('[data-test="exclusao-nao"]').trigger('click')
    expect(w.find('[data-test="confirmar-exclusao"]').exists()).toBe(false)
    expect(api).not.toHaveBeenCalled()

    await w.get('[data-test="excluir-selecionados"]').trigger('click')
    await w.get('[data-test="exclusao-sim"]').trigger('click')
    await flushPromises()
    expect(api).toHaveBeenCalledWith('/api/items/bulk_delete', expect.objectContaining({ method: 'POST', body: { item_ids: ['MLB1', 'MLB2'], confirm: true } }))
    expect(toast.success).toHaveBeenCalledWith('2 anúncio(s) excluído(s) do Mercado Livre.')
    expect(table.refreshNow).toHaveBeenCalled()
    expect(w.find('[data-test="acoes-selecionados"]').exists()).toBe(false)
  })

  it('mostra o que o Mercado Livre recusou', async () => {
    api.mockResolvedValue({ ok: false, message: '0 de 1', results: [{ item_id: 'MLB3', ok: false, message: 'O Mercado Livre recusou: Item with stock in fulfillment cannot be closed' }] })
    const w = mountTable()
    await w.findAll('[data-test="selecionar-anuncio"]')[2]?.setValue(true)
    await w.get('[data-test="excluir-selecionados"]').trigger('click')
    await w.get('[data-test="exclusao-sim"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="resultado-exclusao"]').text()).toContain('cannot be closed')
  })

  it('membro (não admin) não exclui', async () => {
    const session = useSessionStore()
    session.user = { id: 'u2', name: 'Bia', email: 'b@x.com', role: 'member' } as never
    const w = mountTable()
    await w.findAll('[data-test="selecionar-anuncio"]')[0]?.setValue(true)
    expect(w.get('[data-test="excluir-selecionados"]').attributes('disabled')).toBeDefined()
  })

  it('Editar abre a edição com os selecionados', async () => {
    const w = mountTable()
    const boxes = w.findAll('[data-test="selecionar-anuncio"]')
    await boxes[1]?.setValue(true)
    await boxes[0]?.setValue(true)
    await w.get('[data-test="editar-selecionados-botao"]').trigger('click')
    expect(w.get('[data-test="bulk-edit-stub"]').text()).toBe('MLB2,MLB1')
  })
})
