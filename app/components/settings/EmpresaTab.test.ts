import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import EmpresaTab from './EmpresaTab.vue'
import type { SettingsClient } from '../../lib/settingsClient'
import { useSessionStore } from '../../stores/session'
import type { Company } from '../../types/api'

const COMPANY: Company = {
  id: 'c1',
  name: 'Empresa Ana',
  tax_pct: 10,
  min_margin_pct: 5,
  abc_cut_a: 80,
  abc_cut_b: 95,
  group_up_pct: 20,
  group_down_pct: -20,
  ai_model: null,
  ai_configured: false,
  ai_key_hint: null
}

const COMPANY_COM_IA: Company = {
  ...COMPANY,
  ai_model: 'anthropic/claude-sonnet-4.5',
  ai_configured: true,
  ai_key_hint: '…a1b2'
}

function mountEmpresaTab(company: Company = COMPANY) {
  const settingsApi = {
    getCompany: vi.fn().mockResolvedValue({ company }),
    updateCompany: vi.fn().mockResolvedValue({ company })
  }

  const wrapper = mount(EmpresaTab, {
    props: { settingsApi: settingsApi as unknown as SettingsClient }
  })

  return { wrapper, settingsApi }
}

describe('EmpresaTab', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('o botão Salvar começa desabilitado (sem alterações) e habilita ao editar um campo', async () => {
    const { wrapper } = mountEmpresaTab()
    await flushPromises()

    const salvar = wrapper.get('[data-test="salvar-empresa"]')
    expect(salvar.attributes('disabled')).toBeDefined()

    await wrapper.get('#tax-pct').setValue('12')

    expect(wrapper.get('[data-test="salvar-empresa"]').attributes('disabled')).toBeUndefined()
  })

  it('depois de salvar com sucesso, o botão volta a ficar desabilitado (form bate com o que foi salvo)', async () => {
    const { wrapper, settingsApi } = mountEmpresaTab()
    await flushPromises()

    await wrapper.get('#tax-pct').setValue('12')
    expect(wrapper.get('[data-test="salvar-empresa"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(settingsApi.updateCompany).toHaveBeenCalled()
    expect(wrapper.get('[data-test="salvar-empresa"]').attributes('disabled')).toBeDefined()
  })

  it('mostra "Não configurada" sem chave e "Configurada" com a dica da chave quando há uma', async () => {
    const { wrapper } = mountEmpresaTab(COMPANY_COM_IA)
    await flushPromises()

    const status = wrapper.get('[data-test="ai-status"]')
    expect(status.text()).toContain('Configurada')
    expect(status.text()).toContain('…a1b2')
  })

  it('chave da API vazia não é enviada no Salvar', async () => {
    const { wrapper, settingsApi } = mountEmpresaTab()
    await flushPromises()

    await wrapper.get('#tax-pct').setValue('12')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    const payload = settingsApi.updateCompany.mock.calls[0]?.[0]
    expect(payload).not.toHaveProperty('openrouter_api_key')
  })

  it('preencher a chave habilita Salvar mesmo sem mexer em outro campo, e ela entra no payload', async () => {
    const { wrapper, settingsApi } = mountEmpresaTab()
    await flushPromises()

    expect(wrapper.get('[data-test="salvar-empresa"]').attributes('disabled')).toBeDefined()

    await wrapper.get('#ai-api-key').setValue('sk-or-nova-chave')
    expect(wrapper.get('[data-test="salvar-empresa"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    const payload = settingsApi.updateCompany.mock.calls[0]?.[0]
    expect(payload?.openrouter_api_key).toBe('sk-or-nova-chave')
  })

  it('o campo da chave volta a ficar vazio depois de salvar', async () => {
    const { wrapper } = mountEmpresaTab()
    await flushPromises()

    await wrapper.get('#ai-api-key').setValue('sk-or-nova-chave')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect((wrapper.get('#ai-api-key').element as HTMLInputElement).value).toBe('')
  })

  it('"Remover chave" só aparece quando há chave configurada, pede confirmação inline e envia remove_openrouter_api_key', async () => {
    const { wrapper, settingsApi } = mountEmpresaTab(COMPANY_COM_IA)
    await flushPromises()

    expect(wrapper.find('[data-test="remover-chave-ai"]').exists()).toBe(true)

    await wrapper.get('[data-test="remover-chave-ai"]').trigger('click')
    expect(wrapper.text()).toContain('Remover a chave? O plano com IA deixa de funcionar.')

    await wrapper.get('[data-test="confirmar-remover-chave-ai"]').trigger('click')
    await flushPromises()

    expect(settingsApi.updateCompany).toHaveBeenCalledWith({ remove_openrouter_api_key: true })
  })

  it('sem chave configurada, não mostra o botão "Remover chave"', async () => {
    const { wrapper } = mountEmpresaTab()
    await flushPromises()

    expect(wrapper.find('[data-test="remover-chave-ai"]').exists()).toBe(false)
  })

  it('ao salvar com sucesso, atualiza a store de sessão com a company retornada', async () => {
    const { wrapper, settingsApi } = mountEmpresaTab()
    await flushPromises()
    settingsApi.updateCompany.mockResolvedValueOnce({ company: COMPANY_COM_IA })

    await wrapper.get('#tax-pct').setValue('12')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(useSessionStore().company?.ai_configured).toBe(true)
  })
})
