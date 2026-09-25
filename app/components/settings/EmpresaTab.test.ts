import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import EmpresaTab from './EmpresaTab.vue'
import type { SettingsClient } from '../../lib/settingsClient'
import type { Company } from '../../types/api'

const COMPANY: Company = {
  id: 'c1',
  name: 'Empresa Ana',
  tax_pct: 10,
  min_margin_pct: 5,
  abc_cut_a: 80,
  abc_cut_b: 95,
  group_up_pct: 20,
  group_down_pct: -20
}

function mountEmpresaTab() {
  const settingsApi = {
    getCompany: vi.fn().mockResolvedValue({ company: COMPANY }),
    updateCompany: vi.fn().mockResolvedValue({ company: COMPANY })
  }

  const wrapper = mount(EmpresaTab, {
    props: { settingsApi: settingsApi as unknown as SettingsClient }
  })

  return { wrapper, settingsApi }
}

describe('EmpresaTab', () => {
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
})
