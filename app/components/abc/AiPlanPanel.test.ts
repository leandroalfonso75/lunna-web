import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AiPlanPanel from './AiPlanPanel.vue'
import { useSessionStore } from '../../stores/session'
import type { Company, User } from '../../types/api'

/**
 * `useAiPlan` chama `useRuntimeConfig`/`useNuxtApp` (globais do Nuxt, fora
 * do runtime aqui) — mockado por inteiro para isolar o que este teste
 * cobre: o botão desabilitado/habilitado conforme `ai_configured`.
 */
vi.mock('../../composables/useAiPlan', () => ({
  useAiPlan: () => ({
    stateFor: () => ({ status: 'idle', text: '', error: '' }),
    generate: vi.fn(),
    stop: vi.fn(),
    reset: vi.fn()
  })
}))

const ADMIN: User = { id: 'u1', name: 'Ana Admin', email: 'ana@empresa.com', role: 'admin' }
const MEMBER: User = { id: 'u2', name: 'Bob Membro', email: 'bob@empresa.com', role: 'member' }

function company(overrides: Partial<Company> = {}): Company {
  return {
    id: 'c1',
    name: 'Empresa',
    tax_pct: 10,
    min_margin_pct: 5,
    abc_cut_a: 80,
    abc_cut_b: 95,
    group_up_pct: 20,
    group_down_pct: -20,
    ai_model: null,
    ai_configured: false,
    ai_key_hint: null,
    ...overrides
  }
}

function mountPanel(user: User, comp: Company) {
  setActivePinia(createPinia())
  const session = useSessionStore()
  session.user = user
  session.company = comp

  return mount(AiPlanPanel, {
    props: { itemId: 'item1' },
    global: {
      stubs: { NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } }
    }
  })
}

describe('AiPlanPanel', () => {
  it('desabilita o botão quando a empresa não configurou a OpenRouter', () => {
    const wrapper = mountPanel(ADMIN, company())
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })

  it('admin sem IA configurada vê o texto de ajuda com link para Configurações › Empresa', () => {
    const wrapper = mountPanel(ADMIN, company())
    const help = wrapper.get('[data-test="ai-nao-configurada"]')
    expect(help.text()).toContain('Configure a OpenRouter em Configurações › Empresa para gerar planos.')
    expect(wrapper.get('a').attributes('href')).toBe('/configuracoes?aba=empresa')
  })

  it('membro sem IA configurada vê o texto pedindo para um administrador configurar', () => {
    const wrapper = mountPanel(MEMBER, company())
    const help = wrapper.get('[data-test="ai-nao-configurada"]')
    expect(help.text()).toBe('Peça a um administrador para configurar a OpenRouter.')
    expect(wrapper.find('a').exists()).toBe(false)
  })

  it('com IA configurada, o botão fica habilitado, some o texto de ajuda e mostra o modelo em uso', () => {
    const wrapper = mountPanel(ADMIN, company({ ai_configured: true, ai_model: 'anthropic/claude-sonnet-4.5' }))
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-test="ai-nao-configurada"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Modelo: anthropic/claude-sonnet-4.5')
  })
})
