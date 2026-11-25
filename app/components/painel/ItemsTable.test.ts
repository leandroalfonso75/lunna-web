import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive, ref } from 'vue'
import { useSessionStore } from '../../stores/session'

/**
 * Anúncios (pedido do usuário em 24/11/2026): bola da curva ABC (azul A, verde B, vermelha C), data de criação, caixa de
 * seleção, "Excluir anúncios selecionados" com confirmação (Sim/Não) e "Editar anúncios selecionados".
 * Aba Tradicional (25/11/2026): sincronização com catálogo, link do catálogo e exclusão que leva o catálogo junto.
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

/** delete_preview devolve `linked`; bulk_delete devolve `deleteRes`. */
function mockApi(deleteRes: unknown, linked: unknown[] = []) {
  api.mockImplementation((url: string) => Promise.resolve(url === '/api/items/delete_preview' ? { linked } : deleteRes))
}
const deleteCalls = () => api.mock.calls.filter((c) => c[0] === '/api/items/bulk_delete')

const ItemsTable = (await import('./ItemsTable.vue')).default
const mountTable = (props: Record<string, unknown> = {}) => mount(ItemsTable, { props, global: { stubs: { LogisticBadge: true, ItemsBulkEdit: { props: ['itemIds'], template: '<div data-test="bulk-edit-stub">{{ itemIds.join(",") }}</div>' } } } })

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
    mockApi({ ok: true, message: '2 anúncio(s) excluído(s) do Mercado Livre.', results: [{ item_id: 'MLB1', ok: true, message: 'ok' }, { item_id: 'MLB2', ok: true, message: 'ok' }] })
    const w = mountTable()
    const boxes = w.findAll('[data-test="selecionar-anuncio"]')
    await boxes[0]?.setValue(true)
    await boxes[1]?.setValue(true)

    await w.get('[data-test="excluir-selecionados"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="confirmar-exclusao"]').text()).toContain('Confirma a exclusão do(s) anúncio(s) selecionado(s)?')
    expect(w.find('[data-test="aviso-catalogo"]').exists()).toBe(false)
    await w.get('[data-test="exclusao-nao"]').trigger('click')
    expect(w.find('[data-test="confirmar-exclusao"]').exists()).toBe(false)
    expect(deleteCalls()).toEqual([])

    await w.get('[data-test="excluir-selecionados"]').trigger('click')
    await flushPromises()
    await w.get('[data-test="exclusao-sim"]').trigger('click')
    await flushPromises()
    expect(api).toHaveBeenCalledWith('/api/items/bulk_delete', expect.objectContaining({ method: 'POST', body: { item_ids: ['MLB1', 'MLB2'], confirm: true, with_catalog: false } }))
    expect(w.find('[data-test="resultado-exclusao"]').exists()).toBe(false)
    expect(toast.success).toHaveBeenCalledWith('2 anúncio(s) excluído(s) do Mercado Livre.')
    expect(table.refreshNow).toHaveBeenCalled()
    expect(w.find('[data-test="acoes-selecionados"]').exists()).toBe(false)
  })

  it('mostra o que o Mercado Livre recusou', async () => {
    mockApi({ ok: false, message: '0 de 1', results: [{ item_id: 'MLB3', ok: false, message: 'O Mercado Livre recusou: Item with stock in fulfillment cannot be closed' }] })
    const w = mountTable()
    await w.findAll('[data-test="selecionar-anuncio"]')[2]?.setValue(true)
    await w.get('[data-test="excluir-selecionados"]').trigger('click')
    await flushPromises()
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

describe('ItemsTable: aba Tradicional', () => {
  beforeEach(() => {
    const items = [
      { ...row('MLBT1', 'A', null), catalog_sync: [{ item_id: 'MLBC1', permalink: 'https://produto.mercadolivre.com.br/MLBC1', status: 'active' }] },
      { ...row('MLBT2', 'B', null), catalog_sync: [] }
    ]
    response.value = { ...response.value, items, total: 2 }
  })

  it('diz se é sincronizado com catálogo e o código do catálogo é link para o anúncio', () => {
    const w = mountTable({ kind: 'traditional' })
    const sync = w.findAll('[data-test="sync-catalogo"]')
    expect(sync.map((x) => x.text().replace(/\s+/g, ' '))).toEqual(['Sincronizado com catálogoMLBC1', 'Não sincronizado com catálogo'])
    const link = w.get('[data-test="link-catalogo"]')
    expect(link.text()).toBe('MLBC1')
    expect(link.attributes()).toMatchObject({ href: 'https://produto.mercadolivre.com.br/MLBC1', target: '_blank' })
  })

  it('na aba Todos não mostra a linha de sincronização', () => {
    expect(mountTable().find('[data-test="sync-catalogo"]').exists()).toBe(false)
  })

  it('excluir um sincronizado avisa que o catálogo sai junto e, com Sim, exclui os dois e mostra cada resultado', async () => {
    mockApi({ ok: true, message: '2 anúncio(s) excluído(s) do Mercado Livre.', results: [
      { item_id: 'MLBC1', ok: true, message: 'Excluído do Mercado Livre.', catalog_of: 'MLBT1' },
      { item_id: 'MLBT1', ok: true, message: 'Excluído do Mercado Livre.', catalog_of: null }
    ] }, [{ item_id: 'MLBT1', catalogs: ['MLBC1'] }])
    const w = mountTable({ kind: 'traditional' })
    await w.findAll('[data-test="selecionar-anuncio"]')[0]?.setValue(true)
    await w.get('[data-test="excluir-selecionados"]').trigger('click')
    await flushPromises()
    expect(api).toHaveBeenCalledWith('/api/items/delete_preview', { query: { account_id: 'acc', 'item_ids[]': ['MLBT1'] } })
    const aviso = w.get('[data-test="aviso-catalogo"]').text().replace(/\s+/g, ' ')
    expect(aviso).toContain('O anúncio de catálogo também será excluído')
    expect(aviso).toContain('MLBT1 → catálogo MLBC1')
    expect(w.get('[data-test="confirmar-exclusao"]').text()).toContain('2 anúncio(s) serão finalizados')

    await w.get('[data-test="exclusao-sim"]').trigger('click')
    await flushPromises()
    expect(deleteCalls()[0]?.[1]).toMatchObject({ body: { item_ids: ['MLBT1'], confirm: true, with_catalog: true } })
    const result = w.get('[data-test="resultado-exclusao"]').text()
    expect(result).toContain('MLBC1 (catálogo sincronizado a MLBT1)')
    expect(result).toContain('MLBT1')
    expect(result).toContain('2 de 2')
  })

  it('Não no aviso do catálogo não exclui nada', async () => {
    mockApi({}, [{ item_id: 'MLBT1', catalogs: ['MLBC1'] }])
    const w = mountTable({ kind: 'traditional' })
    await w.findAll('[data-test="selecionar-anuncio"]')[0]?.setValue(true)
    await w.get('[data-test="excluir-selecionados"]').trigger('click')
    await flushPromises()
    await w.get('[data-test="exclusao-nao"]').trigger('click')
    expect(deleteCalls()).toEqual([])
  })
})
