import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import UsuariosTab from './UsuariosTab.vue'
import type { SettingsClient } from '../../lib/settingsClient'
import { useSessionStore } from '../../stores/session'
import type { User } from '../../types/api'

const SELF: User = { id: 'u1', name: 'Ana Admin', email: 'ana@empresa.com', role: 'admin' }
const OUTRO: User = { id: 'u2', name: 'Bob Membro', email: 'bob@empresa.com', role: 'member' }

function mountUsuariosTab(users: User[] = [SELF, OUTRO]) {
  const settingsApi = {
    listUsers: vi.fn().mockResolvedValue({ users })
  }

  const wrapper = mount(UsuariosTab, {
    props: { settingsApi: settingsApi as unknown as SettingsClient }
  })

  return { wrapper, settingsApi }
}

describe('UsuariosTab', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useSessionStore().user = SELF
  })

  it('não mostra "Remover" para o próprio usuário, mas mostra para os outros', async () => {
    const { wrapper } = mountUsuariosTab()
    await flushPromises()

    expect(wrapper.find('[data-test="remover-usuario-u1"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="remover-usuario-u2"]').exists()).toBe(true)
  })

  it('marca "Você" só na linha do usuário logado', async () => {
    const { wrapper } = mountUsuariosTab()
    await flushPromises()

    expect(wrapper.get('[data-test="linha-usuario-u1"]').text()).toContain('Você')
    expect(wrapper.get('[data-test="linha-usuario-u2"]').text()).not.toContain('Você')
  })
})
