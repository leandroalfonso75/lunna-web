import { describe, expect, it } from 'vitest'
import { resolveSettingsTab, settingsTabPath, visibleSettingsTabs } from './settingsTabs'

describe('visibleSettingsTabs', () => {
  it('admin vê as três abas', () => {
    expect(visibleSettingsTabs('admin').map((t) => t.value)).toEqual(['empresa', 'usuarios', 'contas'])
  })

  it('member vê só "contas"', () => {
    expect(visibleSettingsTabs('member').map((t) => t.value)).toEqual(['contas'])
  })

  it('sem papel, nenhuma aba', () => {
    expect(visibleSettingsTabs(null)).toEqual([])
    expect(visibleSettingsTabs(undefined)).toEqual([])
  })
})

describe('resolveSettingsTab', () => {
  it('usa a aba pedida quando o papel pode vê-la', () => {
    expect(resolveSettingsTab('usuarios', 'admin')).toBe('usuarios')
  })

  it('cai na primeira aba visível quando nenhuma foi pedida', () => {
    expect(resolveSettingsTab(undefined, 'admin')).toBe('empresa')
    expect(resolveSettingsTab(undefined, 'member')).toBe('contas')
  })

  it('member pedindo uma aba de admin (empresa/usuarios) cai em "contas" — somente leitura', () => {
    expect(resolveSettingsTab('empresa', 'member')).toBe('contas')
    expect(resolveSettingsTab('usuarios', 'member')).toBe('contas')
  })

  it('sem papel, null', () => {
    expect(resolveSettingsTab('contas', null)).toBeNull()
  })
})

describe('settingsTabPath', () => {
  it('monta a URL da aba', () => {
    expect(settingsTabPath('contas')).toBe('/configuracoes?aba=contas')
  })
})
