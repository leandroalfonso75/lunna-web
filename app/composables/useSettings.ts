import { createSettingsClient } from '../lib/settingsClient'

/** Composable de Configurações (empresa/usuários/contas ML) exposto ao app. */
export function useSettings() {
  const { $api } = useNuxtApp()
  return createSettingsClient($api)
}
