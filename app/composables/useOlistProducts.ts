import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { apiErrorMessage } from '../lib/apiErrors'
import {
  createOlistClient,
  type OlistProduct,
  type OlistProductStatus,
  type OlistStatus
} from '../lib/olistClient'
import { useToast } from './useToast'

const PAGE_SIZE = 50
const SEARCH_DEBOUNCE_MS = 300
const SYNC_POLL_MS = 2500
const LIST_REFRESH_MS = 30_000

/**
 * Produtos do Olist ERP no Lunna: lista paginada (busca no servidor), estado da
 * conexão e "Atualizar agora". A cópia no banco é atualizada a cada 3 min pelo
 * servidor; aqui a lista é relida a cada 30 s e logo após uma atualização pedida.
 */
export function useOlistProducts() {
  const { $api } = useNuxtApp()
  const client = createOlistClient($api)
  const toast = useToast()

  const olist = ref<OlistStatus | null>(null)
  const products = ref<OlistProduct[]>([])
  const total = ref(0)
  const lastSyncedAt = ref<string | null>(null)
  const loading = ref(true)
  const error = ref('')
  const syncing = ref(false)

  const q = ref('')
  const status = ref<OlistProductStatus | ''>('')
  const page = ref(0)

  const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
  const connected = computed(() => olist.value?.connected === true)
  const lastRun = computed(() => olist.value?.last_sync ?? null)

  let searchTimer: ReturnType<typeof setTimeout> | undefined
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  let refreshTimer: ReturnType<typeof setInterval> | undefined
  let alive = true

  async function loadStatus() {
    try {
      olist.value = (await client.status()).olist
    } catch (err) {
      error.value = apiErrorMessage(err, 'Não foi possível consultar a conexão com o Olist.')
    }
  }

  async function loadProducts(opts: { silent?: boolean } = {}) {
    if (!opts.silent) loading.value = true
    try {
      const res = await client.products({ q: q.value.trim(), status: status.value, limit: PAGE_SIZE, offset: page.value * PAGE_SIZE })
      products.value = res.products
      total.value = res.total
      lastSyncedAt.value = res.last_synced_at
      error.value = ''
    } catch (err) {
      error.value = apiErrorMessage(err, 'Não foi possível carregar os produtos.')
    } finally {
      loading.value = false
    }
  }

  /** Pede a atualização e acompanha a rodada até terminar. */
  async function refreshNow() {
    if (syncing.value) return
    syncing.value = true
    try {
      await client.sync()
      await pollUntilDone()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não foi possível pedir a atualização.'))
      syncing.value = false
    }
  }

  async function pollUntilDone() {
    await loadStatus()
    const run = lastRun.value
    if (run?.status === 'running' && alive) {
      pollTimer = setTimeout(pollUntilDone, SYNC_POLL_MS)
      return
    }
    syncing.value = false
    if (run?.status === 'failed') toast.error(run.error || 'A atualização falhou.')
    else toast.success('Produtos atualizados.')
    await loadProducts({ silent: true })
  }

  /** Reconectar: abre a autorização do Olist (o retorno cai nas configurações do Lunna). */
  async function reconnect() {
    try {
      const { url } = await client.authorize()
      window.location.href = url
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não foi possível iniciar a conexão com o Olist.'))
    }
  }

  function goTo(next: number) {
    page.value = Math.min(Math.max(0, next), pages.value - 1)
    void loadProducts()
  }

  watch([q], () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      page.value = 0
      void loadProducts()
    }, SEARCH_DEBOUNCE_MS)
  })
  watch(status, () => {
    page.value = 0
    void loadProducts()
  })

  onMounted(async () => {
    await loadStatus()
    if (connected.value) await loadProducts()
    else loading.value = false
    if (lastRun.value?.status === 'running') {
      syncing.value = true
      void pollUntilDone()
    }
    refreshTimer = setInterval(() => {
      if (connected.value && !syncing.value) void loadProducts({ silent: true })
    }, LIST_REFRESH_MS)
  })

  onBeforeUnmount(() => {
    alive = false
    clearTimeout(searchTimer)
    clearTimeout(pollTimer)
    clearInterval(refreshTimer)
  })

  /** Ação "Excluir" da seção: remove no servidor, avisa o resultado e relê a lista. => true se removeu algum. */
  async function removeProducts(ids: number[], keepInErp: boolean): Promise<boolean> {
    try {
      const res = await client.removeProducts(ids, keepInErp)
      const n = res.removed.length
      if (n) toast.success(`${n} ${n === 1 ? 'produto excluído' : 'produtos excluídos'}${res.kept_in_erp ? ' do Lunna (mantidos no ERP)' : ' do Lunna e do ERP'}.`)
      for (const f of res.failed) toast.error(`${f.sku ?? f.id}: ${f.error}`)
      await loadProducts({ silent: true })
      return n > 0
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não foi possível excluir agora. Nada foi alterado.'))
      return false
    }
  }

  return {
    olist, products, total, lastSyncedAt, loading, error, syncing, q, status, page, pages, connected, lastRun,
    pageSize: PAGE_SIZE, refreshNow, reconnect, goTo, removeProducts
  }
}
