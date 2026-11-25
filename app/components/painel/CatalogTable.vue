<script setup lang="ts">
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import { brl, dateTimeShort, int } from '../../lib/format'
import { useSessionStore } from '../../stores/session'

/**
 * Anúncios > aba Catálogo (pedido do usuário em 08/11/2026): todos os anúncios de catálogo, se estão Sincronizados com
 * um anúncio tradicional ou Não sincronizados (como em Promoções) e se estão Ganhando ou Perdendo a vitrine do catálogo.
 */
interface Related { item_id: string; title: string | null; status: string | null; status_label: string | null; price: number | null }
interface CatalogRow {
  item_id: string; title: string; thumbnail: string | null; permalink: string | null; catalog_product_id: string | null
  status: string; status_label: string; price: number | null; stock: number | null; skus: string[]; units_30d: number
  sync: 'sincronizado' | 'nao_sincronizado'; related: Related[]
  state: 'ganhando' | 'compartilhando' | 'perdendo' | 'sem_dados'; state_label: string; ml_status: string | null; reasons: string[]
  price_to_win: number | null; winner_price: number | null; checked_at: string | null
}
interface CatalogResponse {
  counts: { total: number; sincronizado: number; nao_sincronizado: number; ganhando: number; perdendo: number; sem_dados: number; ativos: number }
  checked_at: string | null
  items: CatalogRow[]
}

// "Anúncios criados há mais de N dias" (filtro da página, acima das abas; 24/11/2026): aplicado pela API
// e "Quantidade de Vendas" (25/11/2026), cumulativos
const props = defineProps<{ createdOlderThan?: number | null; sales?: string | null }>()

const { $api } = useNuxtApp()
const session = useSessionStore()
const toast = useToast()

const filters = reactive({ sync: '', state: '', q: '' })
const data = ref<CatalogResponse | null>(null)
const loading = ref(false)

async function load() {
  if (!session.selectedAccountId) return
  loading.value = true
  try {
    const query: Record<string, string> = { account_id: session.selectedAccountId }
    if (props.createdOlderThan) query.created_older_than = String(props.createdOlderThan)
    if (props.sales) query.sales = props.sales
    data.value = await $api<CatalogResponse>('/api/items/catalog', { query })
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível carregar os anúncios de catálogo.'))
  } finally {
    loading.value = false
  }
}

const rows = computed(() => {
  const q = filters.q.trim().toLowerCase()
  return (data.value?.items ?? []).filter((r) =>
    (!filters.sync || r.sync === filters.sync) &&
    (!filters.state || (filters.state === 'ganhando' ? ['ganhando', 'compartilhando'].includes(r.state) : r.state === filters.state)) &&
    (!q || [r.item_id, r.title, ...r.skus, ...r.related.map((x) => x.item_id)].some((v) => v?.toLowerCase().includes(q))))
})

function toggle(key: 'sync' | 'state', value: string) {
  filters[key] = filters[key] === value ? '' : value
}

const STATE_TONE: Record<string, string> = {
  ganhando: 'bg-success-soft text-success', compartilhando: 'bg-success-soft text-success',
  perdendo: 'bg-danger-soft text-danger', sem_dados: 'bg-surface-2 text-ink-2'
}

watch(() => session.selectedAccountId, load)
watch(() => [props.createdOlderThan, props.sales], load)
onMounted(load)
</script>

<template>
  <div class="space-y-4 text-[13px]" data-test="catalogo">
    <div v-if="data" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <button type="button" class="card p-3 text-left" :class="filters.sync === 'sincronizado' ? 'ring-2 ring-primary' : ''" data-test="catalogo-sincronizado" @click="toggle('sync', 'sincronizado')">
        <p class="text-ink-3">Sincronizados</p><p class="text-[20px] font-semibold text-ink" data-numeric>{{ int(data.counts.sincronizado) }}</p>
        <p class="text-[11px] text-ink-3">com anúncio tradicional</p>
      </button>
      <button type="button" class="card p-3 text-left" :class="filters.sync === 'nao_sincronizado' ? 'ring-2 ring-primary' : ''" data-test="catalogo-nao-sincronizado" @click="toggle('sync', 'nao_sincronizado')">
        <p class="text-ink-3">Não sincronizados</p><p class="text-[20px] font-semibold text-ink" data-numeric>{{ int(data.counts.nao_sincronizado) }}</p>
        <p class="text-[11px] text-ink-3">sem anúncio tradicional</p>
      </button>
      <button type="button" class="card p-3 text-left" :class="filters.state === 'ganhando' ? 'ring-2 ring-primary' : ''" data-test="catalogo-ganhando" @click="toggle('state', 'ganhando')">
        <p class="text-ink-3">Ganhando</p><p class="text-[20px] font-semibold text-success" data-numeric>{{ int(data.counts.ganhando) }}</p>
        <p class="text-[11px] text-ink-3">a vitrine do catálogo</p>
      </button>
      <button type="button" class="card p-3 text-left" :class="filters.state === 'perdendo' ? 'ring-2 ring-primary' : ''" data-test="catalogo-perdendo" @click="toggle('state', 'perdendo')">
        <p class="text-ink-3">Perdendo</p><p class="text-[20px] font-semibold text-danger" data-numeric>{{ int(data.counts.perdendo) }}</p>
        <p class="text-[11px] text-ink-3">{{ int(data.counts.sem_dados) }} sem leitura (pausados/encerrados)</p>
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <label class="relative w-full max-w-sm">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input v-model="filters.q" type="search" class="input h-9 w-full pl-8 text-[13px]" placeholder="Buscar por MLB, título ou SKU" data-test="catalogo-busca">
      </label>
      <span class="text-ink-3">{{ int(rows.length) }} de {{ int(data?.counts.total ?? 0) }} anúncios de catálogo</span>
      <span v-if="data?.checked_at" class="ml-auto text-[12px] text-ink-3">Ganhando/Perdendo lido às {{ dateTimeShort(data.checked_at) }} (a cada 30 min, só ativos)</span>
    </div>

    <div v-if="loading && !data" class="h-40 animate-pulse rounded-card bg-surface-2" />

    <div v-else class="card overflow-x-auto">
      <table class="w-full min-w-[900px]">
        <thead class="text-left text-[12px] text-ink-3">
          <tr class="border-b border-line">
            <th class="px-3 py-2 font-medium">Anúncio de catálogo</th>
            <th class="px-3 py-2 font-medium">SKU</th>
            <th class="px-3 py-2 font-medium">Sincronização</th>
            <th class="px-3 py-2 font-medium">Catálogo</th>
            <th class="px-3 py-2 text-right font-medium">Preço</th>
            <th class="px-3 py-2 text-right font-medium">Vendas 30d</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length"><td colspan="6" class="px-3 py-8 text-center text-ink-3">Nenhum anúncio de catálogo com esses filtros.</td></tr>
          <tr v-for="r in rows" :key="r.item_id" class="border-b border-line align-top last:border-0" data-test="catalogo-linha">
            <td class="px-3 py-2">
              <div class="flex items-start gap-2">
                <img v-if="r.thumbnail" :src="r.thumbnail" alt="" class="h-10 w-10 shrink-0 rounded object-contain">
                <div class="min-w-0">
                  <p class="font-medium text-ink">{{ r.title }}</p>
                  <p class="text-[12px] text-ink-3">
                    {{ r.item_id }} · {{ r.status_label }}
                    <a v-if="r.permalink" :href="r.permalink" target="_blank" rel="noopener" class="btn-link ml-1">ver</a>
                  </p>
                </div>
              </div>
            </td>
            <td class="break-all px-3 py-2 text-ink-2">{{ r.skus.length ? r.skus.join(', ') : '—' }}</td>
            <td class="px-3 py-2">
              <span class="rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="r.sync === 'sincronizado' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'">
                {{ r.sync === 'sincronizado' ? 'Sincronizado' : 'Não sincronizado' }}
              </span>
              <p v-for="t in r.related" :key="t.item_id" class="mt-1 text-[12px] text-ink-3">
                com {{ t.item_id }}<template v-if="t.status_label"> · {{ t.status_label }}</template><template v-if="t.title"> · {{ t.title }}</template>
              </p>
            </td>
            <td class="px-3 py-2">
              <span class="rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="STATE_TONE[r.state]">{{ r.state_label }}</span>
              <p v-if="r.state === 'perdendo' && r.price_to_win" class="mt-1 text-[12px] text-ink-2">preço para ganhar: <strong>{{ brl(r.price_to_win) }}</strong></p>
              <p v-if="r.winner_price && r.state === 'perdendo'" class="text-[12px] text-ink-3">vencedor: {{ brl(r.winner_price) }}</p>
              <p v-if="r.reasons.length && r.state === 'perdendo'" class="text-[12px] text-ink-3">motivo: {{ r.reasons.join(', ') }}</p>
            </td>
            <td class="px-3 py-2 text-right" data-numeric>{{ r.price !== null ? brl(r.price) : '—' }}</td>
            <td class="px-3 py-2 text-right" data-numeric>{{ int(r.units_30d) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
