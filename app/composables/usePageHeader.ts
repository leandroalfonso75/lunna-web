import { reactive } from 'vue'
import type { SyncStatus } from '../types/painel'

export interface PageHeaderState {
  title: string
  subtitle: string
  sync: SyncStatus | null
  generatedAt: string | null
  refreshing: boolean
  onRefresh: (() => void) | null
}

/**
 * Cabeçalho de página padronizado (título, subtítulo, selo de sync,
 * "Atualizar agora") — module-scope (mesmo padrão de `useToast`/`useTheme`):
 * a página ativa escreve nele (via `watchEffect`) e DOIS lugares o leem ao
 * mesmo tempo: `components/painel/PageHeader.vue` (cabeçalho de conteúdo) e
 * a barra compacta de `layouts/default.vue` (< 1024px, título + selo).
 */
const state = reactive<PageHeaderState>({
  title: '',
  subtitle: '',
  sync: null,
  generatedAt: null,
  refreshing: false,
  onRefresh: null
})

export function usePageHeader() {
  return { state }
}
