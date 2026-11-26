import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '../../stores/session'

/**
 * Fotos com IA (Curva ABC e Anúncios › Editar), pedido do usuário em 25/11/2026: custos em R$, botão Reprovar com aviso
 * de que a geração já foi paga, e arrastar as fotos para mudar a ordem antes de publicar.
 */
const api = vi.fn()
vi.stubGlobal('useNuxtApp', () => ({ $api: api }))
vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }))
vi.mock('../../composables/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))

const AbcPhotoGenerator = (await import('./AbcPhotoGenerator.vue')).default

const photo = (id: number, approved: boolean) => ({ id, kind: 'gerada', position: id, approved, rejected: false, ml_picture_id: null,
  cost_usd: 0.142, cost_brl: 0.83, model: 'img' })
const job = () => ({ id: 7, status: 'pronto', count: 2, instructions: null, error: null, publish_error: null, published_at: null, published_item_id: null,
  created_at: '2026-11-25', cost_usd: 0.284, cost_brl: 1.65, usd_brl: 5.82, photos: [photo(1, true), photo(2, false)] })

function setup() {
  const session = useSessionStore()
  session.user = { id: 'u1', name: 'Ana', email: 'a@x.com', role: 'admin' }
  session.selectedAccountId = 'acc'
  api.mockImplementation(async (url: string, opts?: { method?: string; responseType?: string }) => {
    if (url === '/api/items/MLB1/photos' && !opts?.method) {
      return { pictures: [{ id: 'A', url: 'https://x/a.jpg' }, { id: 'B', url: 'https://x/b.jpg' }], jobs: [job()], ai_configured: true,
        catalog_listing: false, alternatives: [] }
    }
    if (opts?.responseType === 'blob') return new Blob(['x'])
    if (url === '/api/photo_jobs/7/check_cover') return { ok: true, reasons: [] }
    return { ok: true }
  })
  return mount(AbcPhotoGenerator, { props: { itemId: 'MLB1', title: 'Secador', suggestedCount: 2 } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.mockReset()
})

describe('AbcPhotoGenerator', () => {
  it('mostra os custos em R$ (com o valor em US$ e a cotação no título)', async () => {
    const w = setup()
    await flushPromises()

    expect(w.get('[data-test="fotos-custo"]').text().replace(/\s/g, ' ')).toContain('R$ 1,65')
    expect(w.get('[data-test="fotos-custo"]').attributes('title')).toContain('US$ 0.284')
    expect(w.findAll('[data-test="foto-custo"]').map((e) => e.text().replace(/\s/g, ' '))).toEqual(['R$ 0,83', 'R$ 0,83'])
  })

  it('Reprovar avisa que a geração já foi paga; "Excluir mesmo assim" tira a imagem da tela e da ordem', async () => {
    const w = setup()
    await flushPromises()
    expect(w.findAll('[data-test="foto-gerada"]')).toHaveLength(2)
    expect(w.findAll('[data-test="fotos-ordem-item"]')).toHaveLength(3) // 2 atuais + 1 aprovada

    await w.findAll('[data-test="foto-reprovar"]')[0]!.trigger('click')
    expect(w.get('[data-test="reprovar-aviso"]').text()).toContain('não exime do pagamento de sua geração')
    await w.get('[data-test="reprovar-excluir"]').trigger('click')
    await flushPromises()

    expect(api).toHaveBeenCalledWith('/api/photo_images/1', { method: 'DELETE', query: { account_id: 'acc' } })
    expect(w.find('[data-test="reprovar-aviso"]').exists()).toBe(false)
    expect(w.findAll('[data-test="foto-gerada"]')).toHaveLength(1)
    expect(w.find('[data-test="fotos-ordem"]').exists()).toBe(false) // nenhuma aprovada sobrando
  })

  it('"Manter imagem e Aprovar" aprova e não exclui', async () => {
    const w = setup()
    await flushPromises()

    await w.findAll('[data-test="foto-reprovar"]')[1]!.trigger('click')
    await w.get('[data-test="reprovar-manter"]').trigger('click')
    await flushPromises()

    expect(api).toHaveBeenCalledWith('/api/photo_images/2', { method: 'PATCH', query: { account_id: 'acc' }, body: { approved: true } })
    expect(api.mock.calls.some(([, o]) => o?.method === 'DELETE')).toBe(false)
    expect(w.findAll('[data-test="foto-gerada"]')).toHaveLength(2)
  })

  it('arrastar uma foto para a 1ª posição muda a ordem (vira capa) e é a ordem publicada', async () => {
    const w = setup()
    await flushPromises()
    const items = () => w.findAll('[data-test="fotos-ordem-item"]')
    expect(items()[2]!.text()).toContain('NOVA')

    await items()[2]!.trigger('dragstart', { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })
    await items()[0]!.trigger('dragover')
    await items()[0]!.trigger('drop')
    await flushPromises()

    expect(items()[0]!.text()).toContain('CAPA')
    expect(items()[0]!.text()).toContain('NOVA')
    await w.get('[data-test="fotos-publicar"]').trigger('click')
    await w.get('[data-test="fotos-publicar"]').trigger('click')
    await flushPromises()
    const call = api.mock.calls.find(([url]) => url === '/api/photo_jobs/7/publish')
    expect(call?.[1].body.order).toEqual(['new:1', 'ml:A', 'ml:B'])
  })
})
