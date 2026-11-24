import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '../../stores/session'

/** Anúncios › Editar selecionados (24/11/2026): só um anúncio ou vários com o(s) mesmo(s) SKU(s). API simulada. */
const api = vi.fn()
vi.stubGlobal('useNuxtApp', () => ({ $api: api }))
vi.mock('../../composables/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }))

const ItemsBulkEdit = (await import('./ItemsBulkEdit.vue')).default
const stubs = {
  AbcSpecsEditor: { props: { itemId: String, full: Boolean, sameSku: Array, preselectSameSku: Boolean }, template: '<div data-test="specs-stub">{{ itemId }}|{{ full }}|{{ sameSku.map((s) => s.item_id).join(",") }}|{{ preselectSameSku }}</div>' },
  AbcDescriptionEditor: { props: ['itemId', 'sameSku', 'preselectSameSku'], template: '<div data-test="desc-stub">{{ itemId }}|{{ sameSku.map((s) => s.item_id).join(",") }}</div>' },
  AbcPhotoGenerator: { props: ['itemId', 'alsoItemIds'], template: '<div data-test="photo-stub">{{ itemId }}|{{ alsoItemIds.join(",") }}</div>' }
}
const item = (id: string, type: string) => ({ item_id: id, title: `Secador ${id}`, sku: 'SEC-1', status: 'active', listing_type_id: type, catalog_listing: false, skus: ['SEC-1'] })

beforeEach(() => {
  setActivePinia(createPinia())
  api.mockReset()
  const session = useSessionStore()
  session.user = { id: 'u1', name: 'Ana', email: 'a@x.com', role: 'admin' } as never
  session.selectedAccountId = 'acc'
})

describe('ItemsBulkEdit', () => {
  it('SKUs diferentes: explica e não deixa editar', async () => {
    api.mockRejectedValue({ data: { ok: false, message: 'Só dá para editar juntos anúncios com o(s) mesmo(s) SKU(s). MLB1 tem SEC-1; MLB5 tem OUTRO.' } })
    const w = mount(ItemsBulkEdit, { props: { itemIds: ['MLB1', 'MLB5'] }, global: { stubs } })
    await flushPromises()
    expect(w.get('[data-test="editar-bloqueado"]').text()).toContain('mesmo(s) SKU(s)')
    expect(w.find('[data-test="editar-ficha"]').exists()).toBe(false)
  })

  it('mesmo SKU: abre ficha completa, descrição e imagens no principal, valendo também para os outros', async () => {
    api.mockImplementation(async (url: string) => {
      if (url === '/api/items/bulk_edit') return { ok: true, message: null, primary: item('MLB1', 'gold_pro'), others: [item('MLB2', 'gold_special')], skus: ['SEC-1'] }
      return { count: 0 }
    })
    const w = mount(ItemsBulkEdit, { props: { itemIds: ['MLB1', 'MLB2'] }, global: { stubs } })
    await flushPromises()
    expect(api).toHaveBeenCalledWith('/api/items/bulk_edit', { query: { account_id: 'acc', 'item_ids[]': ['MLB1', 'MLB2'] } })
    expect(w.get('[data-test="editar-lista"]').text()).toContain('Premium')

    await w.get('[data-test="editar-ficha"]').trigger('click')
    expect(w.get('[data-test="specs-stub"]').text()).toBe('MLB1|true|MLB2|true')
    w.findComponent(stubs.AbcSpecsEditor).vm.$emit('close')
    await flushPromises()

    await w.get('[data-test="editar-descricao"]').trigger('click')
    expect(w.get('[data-test="desc-stub"]').text()).toBe('MLB1|MLB2')
    w.findComponent(stubs.AbcDescriptionEditor).vm.$emit('close')
    await flushPromises()

    await w.get('[data-test="editar-fotos"]').trigger('click')
    expect(w.get('[data-test="photo-stub"]').text()).toBe('MLB1|MLB2')
  })
})
