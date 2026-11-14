import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '../../stores/session'

/** Curva ABC > Modelo com palavras-chave (14/11/2026): sugere, aplica e publica MODEL + DETAILED_MODEL com confirmação. */
const api = vi.fn()
vi.stubGlobal('useNuxtApp', () => ({ $api: api }))
vi.mock('../../composables/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))

const AbcModelEditor = (await import('./AbcModelEditor.vue')).default

const INFO = { title: 'Secador Mondial', model: 'SC13', detailed_model: null, detailed_available: true, detailed_per_variation: false,
  max_length: 110, trends: ['secador profissional'], editable: true }

beforeEach(() => {
  setActivePinia(createPinia())
  api.mockReset()
})

describe('AbcModelEditor', () => {
  it('aplica a sugestão da IA e publica Modelo e Modelo detalhado depois de confirmar (admin)', async () => {
    const session = useSessionStore()
    session.user = { id: 'u1', name: 'Ana', email: 'a@x.com', role: 'admin' }
    session.selectedAccountId = 'acc'
    api.mockImplementation(async (url: string, opts?: { method?: string }) => {
      if (url.endsWith('/model') && !opts?.method) return INFO
      if (url.endsWith('/model/suggest')) return { options: [{ model: 'secador profissional difusor salao', why: 'buscas', length: 34 }], detailed_model: 'SC13' }
      return { message: 'ok' }
    })

    const w = mount(AbcModelEditor, { props: { itemId: 'MLB1' } })
    await flushPromises()
    expect(w.get('[data-test="modelo-atual"]').text()).toContain('SC13')
    expect(w.get('[data-test="modelo-buscas"]').text()).toContain('secador profissional')
    expect((w.get('[data-test="modelo-detalhado"]').element as HTMLInputElement).value).toBe('SC13')

    await w.get('[data-test="modelo-sugerir"]').trigger('click')
    await flushPromises()
    await w.get('[data-test="modelo-aplicar"]').trigger('click')
    await w.get('[data-test="modelo-publicar"]').trigger('click')
    await w.get('[data-test="modelo-confirmar"]').trigger('click')
    await flushPromises()

    const call = api.mock.calls.find(([url, o]) => url === '/api/items/MLB1/model' && o?.method === 'POST')
    expect(call?.[1].body).toMatchObject({ model: 'secador profissional difusor salao', detailed_model: 'SC13', confirm: true })
  })
})
