import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '../../stores/session'
import type { CatalogProduct } from '../../lib/catalogProducts'

/** "Criar Produto com IA" (26/11/2026): referências, variação que é kit, rascunho pela IA e campos fiscais só como sugestão. */
const api = vi.fn()
vi.stubGlobal('useNuxtApp', () => ({ $api: api }))
vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }))
vi.mock('../../composables/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))

const CatalogProductEditor = (await import('./CatalogProductEditor.vue')).default

function product(over: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: 5, kind: 'simple', status: 'rascunho', name: null, sku: null, gtin: null, unit: 'UN', price: null, cost_price: null, weight_net: null, weight_gross: null,
    package_width: null, package_height: null, package_length: null, package_source: null, stock_control: true, initial_stock: null, min_stock: null, max_stock: null,
    location: null, preparation_days: null, ncm: null, cest: null, icms_origin: null, sped_item_type: null, brand: null, line: null, model: null, category: null,
    condition: 'novo', sale_format: 'unidade', titles: [], description: null, technical_sheet: [], keywords: null, seo_title: null, seo_description: null, video_url: null,
    warranty: null, supplier: null, regulatory: {}, notes: null, references: { links: [], text: '' }, no_reference_skus: false, use_component_references: false, kit_with_variations: false, kit_simple_sku: null, kit_simple_quantity: 1, kit_parent_sku: null, kit_parent_quantity: 1, kit_components: [], variation_axes: [],
    variations: [], common_components: [], ai_suggestions: {}, ai_review: [], ai_generated_at: null, ai_error: null, erp_exports: {}, created_at: '', updated_at: '',
    assets: [], components_info: {}, ...over
  }
}

function asAdmin() {
  const session = useSessionStore()
  session.user = { id: 'u1', name: 'Ana', email: 'a@x.com', role: 'admin' }
  session.selectedAccountId = 'acc'
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.mockReset()
})

describe('CatalogProductEditor', () => {
  it('salva as referências e pede o rascunho à IA; mostra o "Para conferir" e a sugestão fiscal sem aplicar', async () => {
    asAdmin()
    const generated = product({ name: 'Secador Cadence Rouge', status: 'em_revisao', titles: ['Secador Cadence Rouge Style 2000W com Difusor'], ai_generated_at: '2026-11-26T22:00:00Z',
      ai_review: ['Potência não confirmada nas referências.'], ai_suggestions: { fiscal: { ncm: '85163100', why: 'secador de cabelo' } }, references: { links: ['https://x.com/p'], text: 'Secador' } })
    api.mockImplementation(async (url: string, opts?: { method?: string }) => {
      if (url === '/api/catalog_products/5' && opts?.method === 'PATCH') return product({ references: { links: ['https://x.com/p'], text: 'Secador' } })
      if (url === '/api/catalog_products/5/generate') return generated
      return {}
    })
    const w = mount(CatalogProductEditor, { props: { product: product() } })

    expect((w.get('[data-test="produto-gerar"]').element as HTMLButtonElement).disabled).toBe(true) // sem referência
    await w.get('[data-test="produto-links"]').setValue('https://x.com/p')
    await w.get('[data-test="produto-texto"]').setValue('Secador')
    await w.get('[data-test="produto-gerar"]').trigger('click')
    await flushPromises()

    const patch = api.mock.calls.find(([url, o]) => url === '/api/catalog_products/5' && o?.method === 'PATCH')
    expect(patch?.[1].body.references).toEqual({ links: ['https://x.com/p'], text: 'Secador' })
    expect(api).toHaveBeenCalledWith('/api/catalog_products/5/generate', { method: 'POST', body: { replace: false } })
    expect(w.get('[data-test="para-conferir"]').text()).toContain('Potência não confirmada')
    expect((w.get('[data-test="campo-nome"]').element as HTMLInputElement).value).toBe('Secador Cadence Rouge')

    await w.get('[data-test="aba-fiscal"]').trigger('click')
    expect((w.get('[data-test="campo-ncm"]').element as HTMLInputElement).value).toBe('') // só sugestão
    await w.get('[data-test="usar-ncm"]').trigger('click')
    expect((w.get('[data-test="campo-ncm"]').element as HTMLInputElement).value).toBe('85163100')
  })

  it('variações: monta a grade, marca uma como kit e mostra os itens comuns a todas as variações-kit', async () => {
    asAdmin()
    api.mockResolvedValue({ items: [] })
    const w = mount(CatalogProductEditor, { props: { product: product({ kind: 'variations' }) } })

    await w.findAll('button').find((b) => b.text() === '+ Voltagem')!.trigger('click')
    await w.get('[data-test="eixo-Voltagem"]').setValue('127V, 220V')
    await w.get('[data-test="montar-grade"]').trigger('click')
    expect(w.findAll('[data-test="variacao-linha"]').map((r) => r.text())).toEqual([expect.stringContaining('127V'), expect.stringContaining('220V')])
    expect(w.find('[data-test="itens-comuns"]').exists()).toBe(false)

    await w.findAll('[data-test="variacao-kit"]')[0]!.setValue(true)
    expect(w.find('[data-test="itens-comuns"]').exists()).toBe(true)
    expect(w.find('[data-test="variacao-componente-picker"]').exists()).toBe(true)
  })

  it('EAN inválido e título acima de 60 caracteres bloqueiam "Marcar como pronto"', async () => {
    asAdmin()
    const w = mount(CatalogProductEditor, { props: { product: product({ name: 'Batom', gtin: '7891234567890', titles: ['x'.repeat(61)] }) } })

    expect(w.get('[data-test="produto-problemas"]').text()).toContain('EAN do produto inválido')
    expect(w.get('[data-test="produto-problemas"]').text()).toContain('61 caracteres')
    expect((w.get('[data-test="produto-pronto"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('kit: escolhe os SKUs ou "Não tenho / não quero SKUs de referência"', async () => {
    asAdmin()
    const w = mount(CatalogProductEditor, { props: { product: product({ kind: 'kit', sale_format: 'kit' }) } })

    expect(w.find('[data-test="kit-componentes"]').exists()).toBe(true)
    expect(w.find('[data-test="kit-busca"]').exists()).toBe(true)
    await w.get('[data-test="kit-sem-skus"]').setValue(true)
    expect(w.find('[data-test="kit-busca"]').exists()).toBe(false)
  })

  it('mostra as orientações do custo (PEPS) e do texto das referências', async () => {
    asAdmin()
    const w = mount(CatalogProductEditor, { props: { product: product() } })
    expect(w.get('[data-test="produto-texto-dica"]').text()).toContain('ficha técnica, descrição, perguntas e respostas e avaliações')
    expect(w.get('[data-test="custo-dica"]').text()).toContain('método PEPS (Primeiro que entra, primeira que sai)')
  })

  it('colar (Ctrl+V) um print anexa a imagem de referência', async () => {
    asAdmin()
    api.mockResolvedValue({ id: 9, kind: 'referencia', name: 'colada.png', mime: 'image/png', variation_key: null, position: 1 })
    const w = mount(CatalogProductEditor, { props: { product: product() } })
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'image.png', { type: 'image/png' })
    const paste = new Event('paste', { bubbles: true }) as ClipboardEvent
    Object.defineProperty(paste, 'clipboardData', { value: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }] } })
    w.get('[data-test="produto-colar"]').element.dispatchEvent(paste)
    await new Promise((r) => setTimeout(r, 50))
    await flushPromises()

    const call = api.mock.calls.find(([url]) => url === '/api/catalog_products/5/assets')
    expect(call?.[1].body.data).toMatch(/^data:image\/png;base64,/)
    expect(call?.[1].body.name).toMatch(/^colada-/)
  })

  it('combina dois tipos de variação (Cor e Tamanho): os botões dos outros tipos continuam e a grade traz todas as combinações', async () => {
    asAdmin()
    const w = mount(CatalogProductEditor, { props: { product: product({ kind: 'variations' }) } })

    await w.get('[data-test="tipo-sugestao-Cor"]').trigger('click')
    expect(w.find('[data-test="tipo-sugestao-Cor"]').exists()).toBe(false)
    expect(w.find('[data-test="tipo-sugestao-Tamanho"]').exists()).toBe(true) // segue dando para adicionar outro tipo
    await w.get('[data-test="tipo-sugestao-Tamanho"]').trigger('click')
    await w.get('[data-test="eixo-Cor"]').setValue('Azul, Verde')
    await w.get('[data-test="eixo-Tamanho"]').setValue('P, M, G')
    expect(w.text()).toContain('2 × 3 = 6 variações')
    await w.get('[data-test="montar-grade"]').trigger('click')

    expect(w.findAll('[data-test="variacao-linha"]').map((r) => r.find('td').text())).toEqual(['Azul / P', 'Azul / M', 'Azul / G', 'Verde / P', 'Verde / M', 'Verde / G'])
    await w.get('[data-test="eixo-novo"]').setValue('Material')
    await w.get('[data-test="eixo-adicionar"]').trigger('click')
    expect(w.find('[data-test="adicionar-tipo"]').exists()).toBe(false) // limite de 3 tipos
  })

  it('"Repetir em todas": o preço e o estoque da 1ª variação vão para todas as outras', async () => {
    asAdmin()
    const row = (cor: string, price: number | null) => ({ attrs: { Cor: cor }, sku: null, gtin: null, price, stock: null, kit: false, components: [] })
    const w = mount(CatalogProductEditor, { props: { product: product({ kind: 'variations', variation_axes: ['Cor'], variations: [row('Azul', null), row('Verde', 50), row('Preto', null)] }) } })

    expect(w.find('[data-test="repetir-preco"]').exists()).toBe(false) // só aparece com o 1º preço preenchido
    await w.findAll('[data-test="variacao-preco"]')[0]!.setValue('129.9')
    await w.findAll('[data-test="variacao-estoque"]')[0]!.setValue('5')
    expect(w.findAll('[data-test="repetir-preco"]')).toHaveLength(1)

    await w.get('[data-test="repetir-preco"]').trigger('click')
    await w.get('[data-test="repetir-estoque"]').trigger('click')
    expect(w.findAll('[data-test="variacao-preco"]').map((i) => (i.element as HTMLInputElement).value)).toEqual(['129.9', '129.9', '129.9']) // substitui o 50
    expect(w.findAll('[data-test="variacao-estoque"]').map((i) => (i.element as HTMLInputElement).value)).toEqual(['5', '5', '5'])
  })

  it('kit: a caixa "usar como referências os produtos do kit" só aparece com componentes e, marcada, desabilita Links e Texto', async () => {
    asAdmin()
    const w = mount(CatalogProductEditor, { props: { product: product({ kind: 'kit', sale_format: 'kit', references: { links: ['https://x.com/a'], text: 'manual' } }) } })
    const disabled = (sel: string) => (w.get(sel).element as HTMLTextAreaElement).disabled

    expect(w.find('[data-test="kit-usar-componentes"]').exists()).toBe(false) // sem componentes
    await w.setProps({ product: product({ kind: 'kit', sale_format: 'kit', kit_components: [{ sku: 'LS-DIF', quantity: 1 }], references: { links: ['https://x.com/a'], text: 'manual' } }) })
    expect(w.get('[data-test="kit-usar-componentes"]').text()).toContain('Usar como referências os produtos que formarão o(s) kit(s)')

    await w.get('[data-test="kit-usar-componentes-caixa"]').setValue(true)
    expect(disabled('[data-test="produto-links"]')).toBe(true)
    expect(disabled('[data-test="produto-texto"]')).toBe(true)
    expect((w.get('[data-test="produto-texto"]').element as HTMLTextAreaElement).value).toBe('manual') // o conteúdo fica

    await w.get('[data-test="kit-sem-skus"]').setValue(true) // "Não tenho / não quero SKUs": a caixa some e é desmarcada
    expect(w.find('[data-test="kit-usar-componentes"]').exists()).toBe(false)
    expect(disabled('[data-test="produto-links"]')).toBe(false)
    expect(disabled('[data-test="produto-texto"]')).toBe(false)
  })

  it('kit = produto com variações + produto simples: importa as variações do pai, monta um kit por variação e salva', async () => {
    asAdmin()
    const parts = {
      simple: { sku: 'LS-DIF', name: 'Difusor Universal', cost: 7.6, ok: true },
      parent: { sku: 'LS-SCN01', name: 'Secador Mondial SCN-01', ok: true }, axis: 'Voltagem',
      children: [{ sku: 'LS-SCN01-110', name: 'Secador - 127V', gtin: null, cost: 85.98, price: null, value: '127V' },
        { sku: 'LS-SCN01-220', name: 'Secador - 220V', gtin: null, cost: 85.98, price: null, value: '220V' },
        { sku: 'LS-SCN01-BIV', name: 'Secador - Bivolt', gtin: null, cost: 90, price: null, value: 'Bivolt' }],
      suggested: { product_sku: 'LS-SCN01-DIF', kit_skus: { 'LS-SCN01-110': 'LS-SCN01-DIF-110', 'LS-SCN01-220': 'LS-SCN01-DIF-220', 'LS-SCN01-BIV': 'LS-SCN01-DIF-BIV' } }
    }
    api.mockImplementation(async (url: string, opts?: { method?: string; body?: Record<string, unknown> }) => {
      if (url === '/api/catalog_products/kit_parts') return parts
      if (url === '/api/catalog_products/5' && opts?.method === 'PATCH') return product({ kind: 'kit', ...(opts.body as Partial<CatalogProduct>) })
      return {}
    })
    const w = mount(CatalogProductEditor, { props: { product: product({ kind: 'kit', sale_format: 'kit' }) } })

    expect(w.find('[data-test="kit-simples-sku"]').exists()).toBe(false) // começa em "Não"
    expect(w.find('[data-test="kit-componentes"]').exists()).toBe(true)
    await w.get('[data-test="kit-variacoes-sim"]').trigger('click')
    expect(w.find('[data-test="kit-componentes"]').exists()).toBe(false)
    await w.get('[data-test="kit-simples-sku"]').setValue('LS-DIF')
    await w.get('[data-test="kit-pai-sku"]').setValue('LS-SCN01')
    await new Promise((r) => setTimeout(r, 550))
    await flushPromises()

    expect(w.get('[data-test="kit-simples-ok"]').text()).toContain('Difusor Universal')
    expect(w.get('[data-test="kit-pai-ok"]').text()).toContain('3 variações')
    expect(w.findAll('[data-test="kit-previa-linha"]')).toHaveLength(3)
    await w.findAll('[data-test="kit-previa-entra"]')[2]!.setValue(false) // Bivolt não vira kit
    await w.get('[data-test="kit-montar"]').trigger('click')
    await flushPromises()

    const patch = api.mock.calls.find(([url, o]) => url === '/api/catalog_products/5' && o?.method === 'PATCH')
    const body = patch?.[1].body
    expect(body).toMatchObject({ kit_with_variations: true, kit_simple_sku: 'LS-DIF', kit_parent_sku: 'LS-SCN01', sku: 'LS-SCN01-DIF', variation_axes: ['Voltagem'],
      common_components: [{ sku: 'LS-DIF', quantity: 1 }], kit_components: [] })
    expect(body.variations.map((v: { attrs: Record<string, string>; sku: string; kit: boolean; components: { sku: string }[] }) => [v.attrs.Voltagem, v.sku, v.kit, v.components[0]?.sku]))
      .toEqual([['127V', 'LS-SCN01-DIF-110', true, 'LS-SCN01-110'], ['220V', 'LS-SCN01-DIF-220', true, 'LS-SCN01-220']])
    expect(w.get('[data-test="kits-por-variacao"]').text()).toContain('LS-SCN01')
    expect(w.findAll('[data-test="variacao-composicao"]').map((c) => c.text())).toEqual(['LS-SCN01-110 + LS-DIF', 'LS-SCN01-220 + LS-DIF'])
    expect(w.find('[data-test="kit-usar-componentes"]').exists()).toBe(true) // a caixa de referências dos componentes aparece
  })

  it('kit com variações: responder "Não" com kits montados pede confirmação e tira a grade', async () => {
    asAdmin()
    const kitRow = (v: string) => ({ attrs: { Voltagem: v }, sku: `K-${v}`, gtin: null, price: null, stock: null, kit: true, components: [{ sku: `P-${v}`, quantity: 1 }] })
    const w = mount(CatalogProductEditor, { props: { product: product({ kind: 'kit', kit_with_variations: true, kit_simple_sku: 'LS-DIF', kit_parent_sku: 'LS-SCN01',
      variation_axes: ['Voltagem'], variations: [kitRow('127V'), kitRow('220V')], common_components: [{ sku: 'LS-DIF', quantity: 1 }] }) } })

    expect(w.findAll('[data-test="variacao-linha"]')).toHaveLength(2)
    await w.get('[data-test="kit-variacoes-nao"]').trigger('click')
    expect(w.get('[data-test="kit-variacoes-confirmar"]').text()).toContain('tira os 2 kits')
    expect(w.findAll('[data-test="variacao-linha"]')).toHaveLength(2)
    await w.get('[data-test="kit-variacoes-nao"]').trigger('click')
    expect(w.find('[data-test="produto-variacoes"]').exists()).toBe(false)
    expect(w.find('[data-test="kit-componentes"]').exists()).toBe(true)
  })
})
