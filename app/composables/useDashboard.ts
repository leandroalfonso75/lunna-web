import { ref, watch } from 'vue'
import { createAdsClient } from '../lib/adsClient'
import { currentWindow, previousWindow, type DashPeriod } from '../lib/dashboard'
import { createSalesClient } from '../lib/salesClient'
import { useSessionStore } from '../stores/session'
import type { AdsResponse } from '../types/ads'
import type { SalesResponse } from '../types/sales'

/**
 * Dados da Visão geral do novo layout (27/11/2026), todos de endpoints que já existem e carregados em paralelo: vendas
 * do período e do período anterior (comparação), Ads do período, o que espera atendimento e o resumo de Promoções.
 * Cada bloco carrega e falha sozinho (a tela mostra o que chegou). O cabeçalho, os mais vendidos e o hoje vêm de
 * `usePainel()` (`GET /api/painel`), que a página já usa.
 */
export function useDashboard() {
  const { $api } = useNuxtApp()
  const session = useSessionStore()
  const sales = createSalesClient($api as never)
  const ads = createAdsClient($api as never)

  const period = ref<DashPeriod>('7d')
  const current = ref<SalesResponse | null>(null)
  const previous = ref<SalesResponse | null>(null)
  const adsData = ref<AdsResponse | null>(null)
  const attention = ref<{ claims: number; questions: number; messages: number } | null>(null)
  const promotions = ref<{ below_min?: number; to_switch?: number; to_review?: number } | null>(null)
  const loading = ref(false)
  let seq = 0

  async function load() {
    const account = session.selectedAccountId
    if (!account) return
    const mine = ++seq
    loading.value = true
    const curWin = currentWindow(period.value)
    const prev = previousWindow(period.value)
    const base = { account_id: account, per_page: '1', page: '1', sort: 'date', dir: 'desc' }
    const tasks: Promise<unknown>[] = [
      sales.list({ ...base, from: curWin.from, to: curWin.to }).then((r) => { if (mine === seq) current.value = r }).catch(() => { if (mine === seq) current.value = null }),
      sales.list({ ...base, from: prev.from, to: prev.to }).then((r) => { if (mine === seq) previous.value = r }).catch(() => { if (mine === seq) previous.value = null }),
      ads.overview(account, { period: 'custom', from: curWin.from, to: curWin.to }).then((r) => { if (mine === seq) adsData.value = r }).catch(() => { if (mine === seq) adsData.value = null }),
      ($api as (p: string, o: Record<string, unknown>) => Promise<{ claims: number; questions: number; messages: number }>)('/api/attention', { query: { account_id: account } })
        .then((r) => { if (mine === seq) attention.value = r }).catch(() => undefined),
      ($api as (p: string, o: Record<string, unknown>) => Promise<{ summary: Record<string, number> }>)('/api/promotions', { query: { account_id: account, per_page: '1' } })
        .then((r) => { if (mine === seq) promotions.value = r.summary }).catch(() => undefined)
    ]
    await Promise.allSettled(tasks)
    if (mine === seq) loading.value = false
  }

  function setPeriod(p: DashPeriod) {
    if (period.value === p) return
    period.value = p
    current.value = null
    previous.value = null
    adsData.value = null
    void load()
  }

  watch(() => session.selectedAccountId, () => {
    current.value = previous.value = null
    adsData.value = null
    void load()
  })

  return { period, setPeriod, current, previous, adsData, attention, promotions, loading, load }
}
