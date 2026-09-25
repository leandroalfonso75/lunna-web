import type { UserRole } from '../types/api'

/**
 * Abas de `/configuracoes`. Admin vê as três; member vê só "contas",
 * somente leitura (a aba em si decide o que renderiza para cada papel — o
 * gate aqui é só sobre quais abas aparecem/podem ser pedidas por `?aba=`).
 */
export type SettingsTab = 'empresa' | 'usuarios' | 'contas'

export interface SettingsTabDef {
  value: SettingsTab
  label: string
  /** Rótulo para telas estreitas (abaixo de `sm`) — só quando o completo não cabe na aba. */
  shortLabel?: string
  roles: UserRole[]
}

export const SETTINGS_TABS: SettingsTabDef[] = [
  { value: 'empresa', label: 'Empresa', roles: ['admin'] },
  { value: 'usuarios', label: 'Usuários', roles: ['admin'] },
  { value: 'contas', label: 'Contas do Mercado Livre', shortLabel: 'Contas ML', roles: ['admin', 'member'] }
]

export function visibleSettingsTabs(role: UserRole | null | undefined): SettingsTabDef[] {
  if (!role) return []
  return SETTINGS_TABS.filter((tab) => tab.roles.includes(role))
}

/**
 * Aba a mostrar para `?aba=...`: a pedida, se existir e o papel puder vê-la
 * (ex.: member pedindo `empresa` cai em `contas`); senão a primeira aba
 * visível para esse papel (`null` só se o papel não vê nenhuma).
 */
export function resolveSettingsTab(rawTab: unknown, role: UserRole | null | undefined): SettingsTab | null {
  const visible = visibleSettingsTabs(role)
  if (!visible.length) return null
  const asked = typeof rawTab === 'string' ? rawTab : undefined
  const match = visible.find((tab) => tab.value === asked)
  return match ? match.value : visible[0]!.value
}

export function settingsTabPath(tab: SettingsTab): string {
  return `/configuracoes?aba=${tab}`
}
