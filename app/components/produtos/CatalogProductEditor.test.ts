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
    warranty: null, supplier: null, regulatory: {}, notes: null, references: { links: [], text: '' }, no_reference_skus: false, kit_components: [], variation_axes: [],
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
})
