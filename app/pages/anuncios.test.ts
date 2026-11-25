import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '../stores/session'
import { buildItemsQuery, type ItemsControlsState } from '../lib/itemsQuery'

/** Anúncios › "Anúncios criados há mais de" (pedido do usuário em 24/11/2026): 30/60/90/180/365 ou personalizado (só números). */
const AnunciosPage = (await import('./anuncios.vue')).default
const stubs = {
  PageHeader: true,
  ItemsTable: { props: ['createdOlderThan'], template: '<div data-test="items-stub">{{ createdOlderThan ?? "nenhum" }}</div>' },
  CatalogTable: { props: ['createdOlderThan'], template: '<div data-test="catalog-stub">{{ createdOlderThan ?? "nenhum" }}</div>' }
}

beforeEach(() => {
  setActivePinia(createPinia())
  const session = useSessionStore()
  session.mlAccounts = [{ id: 'acc', nickname: 'LOJA' } as never]
  session.selectedAccountId = 'acc'
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('anuncios.vue: filtro de criação', () => {
  it('fica acima das abas e passa os dias escolhidos para Todos e Catálogo', async () => {
    const w = mount(AnunciosPage, { global: { stubs } })
    const html = w.html()
    expect(html.indexOf('filtro-criacao')).toBeLessThan(html.indexOf('aba-todos'))
    expect(w.get('label[for="criados-ha"]').text()).toBe('Anúncios criados há mais de')
    expect(w.findAll('[data-test="filtro-criacao-periodo"] option').map((o) => o.text()))
      .toEqual(['Qualquer data', '30 dias', '60 dias', '90 dias', '180 dias', '365 dias', 'Personalizado'])
    expect(w.get('[data-test="items-stub"]').text()).toBe('nenhum')

    await w.get('[data-test="filtro-criacao-periodo"]').setValue('180')
    expect(w.get('[data-test="items-stub"]').text()).toBe('180')
    await w.get('[data-test="aba-catalogo"]').trigger('click')
    expect(w.get('[data-test="catalog-stub"]').text()).toBe('180')

    await w.get('[data-test="filtro-criacao-limpar"]').trigger('click')
    expect(w.get('[data-test="items-stub"]').text()).toBe('nenhum')
  })

  it('personalizado aceita só números', async () => {
    const w = mount(AnunciosPage, { global: { stubs } })
    await w.get('[data-test="filtro-criacao-periodo"]').setValue('custom')
    const input = w.get('[data-test="filtro-criacao-dias"]')
    expect(input.attributes('inputmode')).toBe('numeric')

    await input.setValue('4a5-')
    expect((input.element as HTMLInputElement).value).toBe('45')
    vi.advanceTimersByTime(450)
    await w.vm.$nextTick()
    expect(w.get('[data-test="items-stub"]').text()).toBe('45')
    expect(w.get('[data-test="filtro-criacao-resumo"]').text()).toContain('45 dias')

    await input.setValue('abc')
    vi.advanceTimersByTime(450)
    await w.vm.$nextTick()
    expect(w.get('[data-test="items-stub"]').text()).toBe('nenhum')
  })
})

describe('buildItemsQuery', () => {
  const base: ItemsControlsState = { status: 'active', alert: null, q: '', type: '', shipping: '', id: null, titleFilter: '', skuFilter: '',
    numericFilters: {}, sort: 'units_7d', dir: null, page: 1, perPage: 50 }
  it('manda created_older_than só quando há filtro', () => {
    expect(buildItemsQuery('acc', base).created_older_than).toBeUndefined()
    expect(buildItemsQuery('acc', { ...base, createdOlderThan: 90 }).created_older_than).toBe('90')
  })
})
