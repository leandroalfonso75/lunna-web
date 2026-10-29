import { reactive, ref, watch } from 'vue'
import { apiErrorMessage } from '../lib/apiErrors'
import { buildPromotionsQuery, createPromotionsClient } from '../lib/promotionsClient'
import { withTransientRetry } from '../lib/transientRetry'
import { useSessionStore } from '../stores/session'
import type { PromotionActionLog, PromotionAutomation, PromotionItemDetail, PromotionSettingsInput, PromotionSpread, PromotionsFilters, PromotionsResponse, PromotionTarget } from '../types/promotions'
import { usePolling } from './usePolling'

const DEBOUNCE_MS = 300

/**
 * Dados e controles da seção Promoções (`/promocoes`): anúncios com a promoção atual e a melhor oferta,
 * promoções da Central do ML, painel de um anúncio e margens por anúncio. A conta da margem e a escolha
 * da melhor oferta são da API (`GET /api/promotions`); aqui só se decide quando pedir.
 */
export function usePromotions() {
  const { $api } = useNuxtApp()
  const client = createPromotionsClient($api)
  const session = useSessionStore()

  const filters = reactive<PromotionsFilters>({ status: '', promotionId: '', q: '', sort: 'gain', dir: 'desc', page: 1, perPage: 50 })
  const tab = ref<'anuncios' | 'promocoes' | 'historico' | 'rotina'>('anuncios')
  const response = ref<PromotionsResponse | null>(null)
  const loading = ref(true)
  const stale = ref(false)
  const loadError = ref('')
  const syncing = ref(false)
  const syncMessage = ref('')
  const exporting = ref(false)

  const selected = ref<string | null>(null)
  const detail = ref<PromotionItemDetail | null>(null)
  const detailLoading = ref(false)
  const detailError = ref('')
  const saving = ref(false)
  const saveError = ref('')
  const acting = ref(false)
  const actionResult = ref<{ ok: boolean; message: string } | null>(null)
  const checked = ref<string[]>([])
  const bulkMessage = ref('')
  const history = ref<PromotionActionLog[]>([])
  const historyLoading = ref(false)

  let controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  async function runFetch() {
    const accountId = session.selectedAccountId
    if (!accountId) return
    controller?.abort()
    const mine = new AbortController()
    controller = mine
    loading.value = true
    try {
      const data = await withTransientRetry(() => client.list(buildPromotionsQuery(accountId, filters), { signal: mine.signal }))
      if (mine.signal.aborted) return
      response.value = data
      stale.value = false
      loadError.value = ''
    } catch (err) {
      if (mine.signal.aborted) return
      if (response.value) stale.value = true
      else loadError.value = apiErrorMessage(err, 'Não foi possível carregar as promoções agora.')
    } finally {
      if (!mine.signal.aborted) loading.value = false
    }
  }

  function schedule(debounced: boolean) {
    if (timer) clearTimeout(timer)
    timer = null
    if (debounced) timer = setTimeout(runFetch, DEBOUNCE_MS)
    else runFetch()
  }

  function change(patch: Partial<PromotionsFilters>, debounced = false) {
    Object.assign(filters, patch, { page: 1 })
    schedule(debounced)
  }

  function sortBy(column: string) {
    const same = filters.sort === column
    filters.sort = column
    filters.dir = same ? (filters.dir === 'desc' ? 'asc' : 'desc') : 'desc'
    filters.page = 1
    schedule(false)
  }

  function setPage(page: number) {
    filters.page = page
    schedule(false)
  }

  /** Abre a aba Anúncios filtrada por uma promoção da Central. */
  function showPromotion(promotionId: string) {
    tab.value = 'anuncios'
    change({ promotionId, status: '' })
  }

  async function open(itemId: string) {
    const accountId = session.selectedAccountId
    if (!accountId) return
    selected.value = itemId
    detail.value = null
    actionResult.value = null
    detailError.value = ''
    saveError.value = ''
    detailLoading.value = true
    try {
      const data = await client.detail(accountId, itemId)
      if (selected.value === itemId) detail.value = data
    } catch (err) {
      if (selected.value === itemId) detailError.value = apiErrorMessage(err, 'Não foi possível carregar as ofertas deste anúncio.')
    } finally {
      if (selected.value === itemId) detailLoading.value = false
    }
  }

  /** Aplica no ML a melhor oferta (ou a escolhida) do anúncio aberto; o painel volta já relido. */
  /** => true quando o Mercado Livre aceitou (usado para ir ao próximo anúncio só se deu certo). */
  async function apply(target?: PromotionTarget, spread?: PromotionSpread): Promise<boolean> {
    const accountId = session.selectedAccountId
    if (!accountId || !selected.value || acting.value) return false
    acting.value = true
    actionResult.value = null
    try {
      const res = await client.apply(accountId, selected.value, target, spread)
      detail.value = res.item
      actionResult.value = { ok: res.ok, message: res.message }
      schedule(false)
      return res.ok
    } catch (err) {
      actionResult.value = { ok: false, message: apiErrorMessage(err, 'Não foi possível falar com o Mercado Livre agora.') }
      return false
    } finally {
      acting.value = false
    }
  }

  async function leave(): Promise<boolean> {
    const accountId = session.selectedAccountId
    if (!accountId || !selected.value || acting.value) return false
    acting.value = true
    actionResult.value = null
    try {
      const res = await client.leave(accountId, selected.value)
      detail.value = res.item
      actionResult.value = { ok: res.ok, message: res.message }
      schedule(false)
      return res.ok
    } catch (err) {
      actionResult.value = { ok: false, message: apiErrorMessage(err, 'Não foi possível falar com o Mercado Livre agora.') }
      return false
    } finally {
      acting.value = false
    }
  }

  async function applyBestChecked() {
    const accountId = session.selectedAccountId
    if (!accountId || !checked.value.length || acting.value) return
    acting.value = true
    bulkMessage.value = ''
    try {
      const { queued } = await client.applyBest(accountId, checked.value)
      bulkMessage.value = `${queued} ${queued === 1 ? 'anúncio enviado' : 'anúncios enviados'} para receber a melhor oferta, um de cada vez. Acompanhe na aba Histórico.`
      checked.value = []
      setTimeout(() => polling.refreshNow(), 30_000)
    } catch (err) {
      bulkMessage.value = apiErrorMessage(err, 'Não foi possível enviar os anúncios agora.')
    } finally {
      acting.value = false
    }
  }

  async function loadHistory() {
    const accountId = session.selectedAccountId
    if (!accountId) return
    historyLoading.value = true
    try {
      history.value = (await client.actions(accountId)).actions
    } catch {
      history.value = []
    } finally {
      historyLoading.value = false
    }
  }

  watch(tab, (t) => { if (t === 'historico') loadHistory() })

  function close() {
    selected.value = null
    detail.value = null
  }

  /** Marca/desmarca "não automatizar promoções neste anúncio" (e no SKU/variações, se pedido). */
  async function setAutomation(enabled: boolean, spread: { sku: boolean; variations: boolean }) {
    const accountId = session.selectedAccountId
    if (!accountId || !selected.value || saving.value) return
    saving.value = true
    saveError.value = ''
    try {
      const res = await client.setAutomation(accountId, selected.value, enabled, spread)
      detail.value = res
      actionResult.value = {
        ok: true,
        message: enabled
          ? `Promoções voltam a ser automáticas em ${res.updated} ${res.updated === 1 ? 'anúncio' : 'anúncios'}.`
          : `${res.updated} ${res.updated === 1 ? 'anúncio marcado' : 'anúncios marcados'} para não automatizar: a rotina e o lote não mexem mais neles.`
      }
      schedule(false)
    } catch (err) {
      saveError.value = apiErrorMessage(err, 'Não foi possível mudar a automação agora.')
    } finally {
      saving.value = false
    }
  }

  /** Regras da automação (abaixo dos cards); a lista é recalculada com elas. */
  async function saveAutomation(patch: Partial<PromotionAutomation>) {
    if (saving.value) return
    saving.value = true
    syncMessage.value = ''
    try {
      await client.saveAutomation(patch)
      schedule(false)
    } catch (err) {
      syncMessage.value = apiErrorMessage(err, 'Não foi possível salvar as regras da automação.')
    } finally {
      saving.value = false
    }
  }

  async function dismissCatalogAlert(id: number) {
    const accountId = session.selectedAccountId
    if (!accountId) return
    try {
      await client.dismissCatalogAlert(accountId, id)
      schedule(false)
    } catch (err) {
      syncMessage.value = apiErrorMessage(err, 'Não foi possível marcar o aviso como visto.')
    }
  }

  async function saveSettings(input: PromotionSettingsInput) {
    const accountId = session.selectedAccountId
    if (!accountId || !selected.value || saving.value) return
    saving.value = true
    saveError.value = ''
    try {
      detail.value = await client.saveSettings(accountId, selected.value, input)
      schedule(false)
    } catch (err) {
      saveError.value = apiErrorMessage(err, 'Não foi possível salvar as margens.')
    } finally {
      saving.value = false
    }
  }

  async function exportCsv() {
    const accountId = session.selectedAccountId
    if (!accountId || exporting.value) return
    exporting.value = true
    try {
      const blob = await client.export(accountId)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `promocoes-${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      syncMessage.value = apiErrorMessage(err, 'Não foi possível exportar agora.')
    } finally {
      exporting.value = false
    }
  }

  const polling = usePolling(runFetch)

  async function syncNow() {
    const accountId = session.selectedAccountId
    if (!accountId || syncing.value) return
    syncing.value = true
    syncMessage.value = ''
    try {
      await client.sync(accountId)
      syncMessage.value = 'Pedido enviado. A Central de Promoções está sendo lida de novo (cerca de 2 minutos); a tela se atualiza sozinha.'
      setTimeout(() => polling.refreshNow(), 120_000)
    } catch (err) {
      syncMessage.value = apiErrorMessage(err, 'Não foi possível pedir a atualização agora.')
    } finally {
      syncing.value = false
    }
  }

  watch(() => session.selectedAccountId, () => {
    close()
    change({ status: '', promotionId: '', q: '' })
  })

  return {
    client, filters, tab, response, loading, stale, loadError, syncing, syncMessage, exporting,
    selected, detail, detailLoading, detailError, saving, saveError,
    acting, actionResult, checked, bulkMessage, history, historyLoading,
    change, sortBy, setPage, showPromotion, open, close, saveSettings, exportCsv, syncNow,
    apply, leave, applyBestChecked, loadHistory, setAutomation, saveAutomation, dismissCatalogAlert,
    start: polling.start, stop: polling.stop, refreshNow: polling.refreshNow, refreshing: polling.refreshing
  }
}
