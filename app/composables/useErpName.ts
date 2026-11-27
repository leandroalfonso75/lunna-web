import { computed } from 'vue'
import { useSessionStore } from '../stores/session'

/**
 * Nome do ERP conectado à empresa (27/11/2026), para os textos da tela: o Lunna atende várias lojas e ERPs (Olist hoje;
 * Bling, Upseller e outros depois), então nenhum texto cita um ERP fixo. Sem ERP conectado: "ERP".
 * `erpText` troca o marcador `{erp}` de um texto pelo nome.
 */
export function useErpName() {
  const session = useSessionStore()
  const name = computed(() => session.company?.erp?.name || 'ERP')
  const erpText = (text: string) => text.replaceAll('{erp}', name.value)
  return { name, erpText }
}
