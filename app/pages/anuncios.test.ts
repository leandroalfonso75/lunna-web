import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '../stores/session'
import { buildItemsQuery, type ItemsControlsState } from '../lib/itemsQuery'

/**
 * Anúncios, filtros acima das abas: "Anúncios criados há mais de" (24/11/2026) e "Quantidade de Vendas" (25/11/2026),
 * cumulativos. Revisto em 25/11/2026: vendas em faixas (1 a 4 … 5.000 a 9.999) com personalizado de/até, e cada filtro só
 * vale depois de clicar em Aplicar.
 */
const AnunciosPage = (await import('./anuncios.vue')).default
const stubs = {
  PageHeader: true,
  ItemsTable: { props: ['createdOlderThan', 'sales', 'kind'], template: '<div v-if="kind" data-test="items-stub-traditional">{{ createdOlderThan ?? "nenhum" }}|{{ sales ?? "nenhum" }}</div><template v-else><div data-test="items-stub">{{ createdOlderThan ?? "nenhum" }}</div><div data-test="items-sales">{{ sales ?? "nenhum" }}</div></template>' },
  CatalogTable: { props: ['createdOlderThan', 'sales'], template: '<div data-test="catalog-stub">{{ createdOlderThan ?? "nenhum" }}</div><div data-test="catalog-sales">{{ sales ?? "nenhum" }}</div>' }
}
const mountPage = () => mount(AnunciosPage, { global: { stubs } })

beforeEach(() => {
  setActivePinia(createPinia())
  const session = useSessionStore()
  session.mlAccounts = [{ id: 'acc', nickname: 'LOJA' } as never]
  session.selectedAccountId = 'acc'
})

describe('anuncios.vue: filtro de criação', () => {
  it('fica acima das abas e só filtra depois de Aplicar, nas duas abas', async () => {
    const w = mountPage()
    const html = w.html()
    expect(html.indexOf('filtro-criacao')).toBeLessThan(html.indexOf('aba-todos'))
    expect(w.get('label[for="criados-ha"]').text()).toBe('Anúncios criados há mais de')
    expect(w.findAll('[data-test="filtro-criacao-periodo"] option').map((o) => o.text()))
      .toEqual(['Qualquer data', '30 dias', '60 dias', '90 dias', '180 dias', '365 dias', 'Personalizado'])
    const aplicar = w.get('[data-test="filtro-criacao-aplicar"]')
    expect(aplicar.text()).toBe('Aplicar')
    expect(aplicar.classes()).toEqual(expect.arrayContaining(['btn-primary', 'rounded-full']))
    expect(aplicar.attributes('disabled')).toBeDefined()

    await w.get('[data-test="filtro-criacao-periodo"]').setValue('180')
    expect(w.get('[data-test="items-stub"]').text()).toBe('nenhum') // ainda não aplicou
    expect(w.get('[data-test="filtro-criacao-pendente"]').text()).toContain('Aplicar')
    await w.get('[data-test="filtro-criacao-aplicar"]').trigger('click')
    expect(w.get('[data-test="items-stub"]').text()).toBe('180')
    expect(w.get('[data-test="filtro-criacao-resumo"]').text()).toBe('aplicado: criados há mais de 180 dias')
    await w.get('[data-test="aba-catalogo"]').trigger('click')
    expect(w.get('[data-test="catalog-stub"]').text()).toBe('180')

    await w.get('[data-test="filtro-criacao-limpar"]').trigger('click')
    expect(w.get('[data-test="catalog-stub"]').text()).toBe('nenhum')
  })

  it('personalizado aceita só números e vale com Aplicar (ou Enter)', async () => {
    const w = mountPage()
    await w.get('[data-test="filtro-criacao-periodo"]').setValue('custom')
    const input = w.get('[data-test="filtro-criacao-dias"]')
    expect(input.attributes('inputmode')).toBe('numeric')
    await input.setValue('4a5-')
    expect((input.element as HTMLInputElement).value).toBe('45')
    expect(w.get('[data-test="items-stub"]').text()).toBe('nenhum')
    await input.trigger('keydown.enter')
    expect(w.get('[data-test="items-stub"]').text()).toBe('45')

    await input.setValue('abc')
    expect(w.get('[data-test="filtro-criacao-aplicar"]').attributes('disabled')).toBeDefined()
  })
})

describe('anuncios.vue: filtro Quantidade de Vendas', () => {
  it('fica logo abaixo do de criação, com as faixas pedidas', () => {
    const w = mountPage()
    const html = w.html()
    expect(html.indexOf('filtro-criacao')).toBeLessThan(html.indexOf('filtro-vendas'))
    expect(html.indexOf('filtro-vendas')).toBeLessThan(html.indexOf('aba-todos'))
    expect(w.get('label[for="quantidade-vendas"]').text()).toBe('Quantidade de Vendas')
    expect(w.findAll('[data-test="filtro-vendas-periodo"] option').map((o) => o.text())).toEqual([
      'Qualquer quantidade', 'Sem vendas', '1 a 4 vendas', '5 a 9 vendas', '10 a 24 vendas', '25 a 49 vendas', '50 a 99 vendas',
      '100 a 499 vendas', '500 a 999 vendas', '1.000 a 4.999 vendas', '5.000 a 9.999 vendas', 'Personalizado'
    ])
    expect(w.findAll('[data-test="filtro-vendas-periodo"] option').map((o) => (o.element as HTMLOptionElement).value).slice(1, 4)).toEqual(['none', '1-4', '5-9'])
  })

  it('é cumulativo com o de criação; cada um tem o seu Aplicar', async () => {
    const w = mountPage()
    await w.get('[data-test="filtro-criacao-periodo"]').setValue('90')
    await w.get('[data-test="filtro-criacao-aplicar"]').trigger('click')
    await w.get('[data-test="filtro-vendas-periodo"]').setValue('none')
    expect(w.get('[data-test="items-sales"]').text()).toBe('nenhum')
    await w.get('[data-test="filtro-vendas-aplicar"]').trigger('click')
    expect(w.get('[data-test="items-stub"]').text()).toBe('90')
    expect(w.get('[data-test="items-sales"]').text()).toBe('none')
    expect(w.get('[data-test="filtro-vendas-resumo"]').text()).toBe('aplicado: sem nenhuma venda')

    await w.get('[data-test="filtro-vendas-periodo"]').setValue('1000-4999')
    await w.get('[data-test="filtro-vendas-aplicar"]').trigger('click')
    expect(w.get('[data-test="items-sales"]').text()).toBe('1000-4999')
    expect(w.get('[data-test="filtro-vendas-resumo"]').text()).toBe('aplicado: de 1.000 a 4.999 vendas')
    await w.get('[data-test="aba-catalogo"]').trigger('click')
    expect(w.get('[data-test="catalog-sales"]').text()).toBe('1000-4999')
    expect(w.get('[data-test="catalog-stub"]').text()).toBe('90')
  })

  it('personalizado de/até: só números; "até" vazio = ou mais; "até" menor bloqueia', async () => {
    const w = mountPage()
    await w.get('[data-test="filtro-vendas-periodo"]').setValue('custom')
    const de = w.get('[data-test="filtro-vendas-dias"]')
    const ate = w.get('[data-test="filtro-vendas-ate"]')
    await de.setValue('1,5 0')
    expect((de.element as HTMLInputElement).value).toBe('150')
    await w.get('[data-test="filtro-vendas-aplicar"]').trigger('click')
    expect(w.get('[data-test="items-sales"]').text()).toBe('150-')
    expect(w.get('[data-test="filtro-vendas-resumo"]').text()).toBe('aplicado: 150 vendas ou mais')

    await ate.setValue('20')
    expect(w.find('[data-test="filtro-vendas-erro"]').exists()).toBe(true)
    expect(w.get('[data-test="filtro-vendas-aplicar"]').attributes('disabled')).toBeDefined()

    await ate.setValue('300')
    await w.get('[data-test="filtro-vendas-aplicar"]').trigger('click')
    expect(w.get('[data-test="items-sales"]').text()).toBe('150-300')
  })
})

describe('anuncios.vue: aba Tradicional (25/11/2026)', () => {
  it('fica ao lado de Catálogo e mostra a tabela só de tradicionais, com os mesmos filtros', async () => {
    const w = mountPage()
    expect(w.findAll('[role="tab"]').map((t) => t.text())).toEqual(['Todos', 'Catálogo', 'Tradicional'])
    expect(w.find('[data-test="items-stub-traditional"]').exists()).toBe(false)
    await w.get('[data-test="filtro-criacao-periodo"]').setValue('90')
    await w.get('[data-test="filtro-criacao-aplicar"]').trigger('click')
    await w.get('[data-test="filtro-vendas-periodo"]').setValue('5-9')
    await w.get('[data-test="filtro-vendas-aplicar"]').trigger('click')
    await w.get('[data-test="aba-tradicional"]').trigger('click')
    expect(w.get('[data-test="aba-tradicional"]').attributes('aria-selected')).toBe('true')
    expect(w.get('[data-test="items-stub-traditional"]').text()).toBe('90|5-9')
    expect(w.find('[data-test="catalog-stub"]').exists()).toBe(false)
  })
})

describe('buildItemsQuery', () => {
  const base: ItemsControlsState = { status: 'active', alert: null, q: '', type: '', shipping: '', id: null, titleFilter: '', skuFilter: '',
    numericFilters: {}, sort: 'units_7d', dir: null, page: 1, perPage: 50 }
  it('manda os filtros só quando há valor', () => {
    expect(buildItemsQuery('acc', base).created_older_than).toBeUndefined()
    expect(buildItemsQuery('acc', base).sales).toBeUndefined()
    expect(buildItemsQuery('acc', { ...base, createdOlderThan: 90, sales: '5-9' })).toMatchObject({ created_older_than: '90', sales: '5-9' })
    expect(buildItemsQuery('acc', base).kind).toBeUndefined()
    expect(buildItemsQuery('acc', { ...base, kind: 'traditional' }).kind).toBe('traditional')
  })
})
