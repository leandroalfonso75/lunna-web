<script setup lang="ts">
import { ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { computed, onMounted, reactive, ref, watch, watchEffect } from 'vue'
import EmptyAccountState from '../components/painel/EmptyAccountState.vue'
import PageHeader from '../components/painel/PageHeader.vue'
import LogisticBadge from '../components/ui/LogisticBadge.vue'
import { usePageHeader } from '../composables/usePageHeader'
import { useToast } from '../composables/useToast'
import { apiErrorMessage } from '../lib/apiErrors'
import { brl, dateShort, dateTimeShort, int } from '../lib/format'
import { useSessionStore } from '../stores/session'
import type { StockDepotResponse, StockFullResponse, StockFullRow } from '../types/stock'

/**
 * `/estoque` (pedido do usuário em 14/11/2026): duas abas.
 * - Depósito (ERP): estoque geral do Olist por SKU, com o Full, valor parado, vendas de 30 dias (os kits contam para os
 *   componentes), cobertura em dias e o que o Mercado Livre pede para mandar ao Full.
 * - Full: estoque no Full e as recomendações de reposição do ML (urgência, quantidade, prazo, vendas, dias sem estoque e
 *   receita perdida), cruzadas com o disponível no Olist: quanto dá para enviar já e quanto falta comprar.
 * Tudo calculado na API (Painel::StockQuery); somente leitura.
 */
const { $api } = useNuxtApp()
const session = useSessionStore()
const header = usePageHeader()
const toast = useToast()

const tab = ref<'deposito' | 'full'>('full')
const depot = ref<StockDepotResponse | null>(null)
const full = ref<StockFullResponse | null>(null)
const loading = ref(false)
const error = ref('')
const depotFilters = reactive({ q: '', view: '', sort: 'value', page: 1 })
// Ordenação por coluna, feita na API (pedido do usuário em 24/11/2026). Ao abrir: Sugerido, decrescente.
const fullFilters = reactive({ q: '', view: 'repor', sort: 'suggested', dir: 'desc' as 'asc' | 'desc', page: 1 })
const FULL_COLUMNS = [
  { sort: 'title', label: 'Produto', width: 'w-[30%]', align: 'left' },
  { sort: 'stock', label: 'No Full', width: 'w-[8%]', align: 'right' },
  { sort: 'urgency', label: 'Urgência', width: 'w-[11%]', align: 'left' },
  { sort: 'suggested', label: 'Sugerido', width: 'w-[10%]', align: 'right' },
  { sort: 'olist', label: 'No depósito', width: 'w-[10%]', align: 'right' },
  { sort: 'can_send', label: 'Enviar já', width: 'w-[10%]', align: 'right' },
  { sort: 'to_buy', label: 'Comprar', width: 'w-[9%]', align: 'right' },
  { sort: 'sold', label: 'Vendas 30 dias', width: 'w-[12%]', align: 'right' }
] as const
/** Mesma coluna inverte; coluna nova começa do maior para o menor (Produto, de A a Z). */
function sortFullBy(key: string) {
  if (fullFilters.sort === key) fullFilters.dir = fullFilters.dir === 'desc' ? 'asc' : 'desc'
  else {
    fullFilters.sort = key
    fullFilters.dir = key === 'title' ? 'asc' : 'desc'
  }
  fullFilters.page = 1
  reload()
}
const openRow = ref<string | null>(null)

async function load() {
  if (!session.selectedAccountId) return
  loading.value = true
  try {
    if (tab.value === 'deposito') depot.value = await $api<StockDepotResponse>('/api/stock/depot', { query: { account_id: session.selectedAccountId, ...depotFilters } })
    else full.value = await $api<StockFullResponse>('/api/stock/full', { query: { account_id: session.selectedAccountId, ...fullFilters } })
    error.value = ''
  } catch (err) {
    error.value = apiErrorMessage(err, 'Não foi possível carregar o estoque agora.')
  } finally {
    loading.value = false
  }
}
let timer: ReturnType<typeof setTimeout> | null = null
function reload(debounced = false) {
  if (timer) clearTimeout(timer)
  if (debounced) timer = setTimeout(() => void load(), 350)
  else void load()
}
onMounted(load)
watch(tab, () => { openRow.value = null; void load() })
watch(() => session.selectedAccountId, () => void load())

async function syncFull() {
  try {
    await $api('/api/stock/full/sync', { method: 'POST', query: { account_id: session.selectedAccountId } })
    toast.success('Pedimos as recomendações de novo ao Mercado Livre. Em alguns minutos a lista é atualizada.')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível pedir a atualização agora.'))
  }
}

const DEPOT_VIEWS = [
  { value: '', label: 'Todos' }, { value: 'com_estoque', label: 'Com estoque no depósito' }, { value: 'baixo', label: 'Cobertura baixa' },
  { value: 'sem_estoque', label: 'Sem estoque' }, { value: 'parado', label: 'Parado (sem venda em 30 dias)' }, { value: 'pedido_full', label: 'O Full pede reposição' }
]
const DEPOT_SORTS = [{ value: 'value', label: 'Valor em estoque' }, { value: 'coverage', label: 'Menor cobertura' }, { value: 'sold', label: 'Mais vendidos' }, { value: 'sku', label: 'SKU' }]
const FULL_VIEWS = [
  { value: 'repor', label: 'Repor' }, { value: 'urgente', label: 'Urgente' }, { value: 'falta_comprar', label: 'Falta comprar' },
  { value: 'sem_necessidade', label: 'Sem necessidade' }, { value: '', label: 'Todos no Full' }, { value: 'todos', label: 'Todos os produtos' }
]
const STATE: Record<string, { label: string; tone: string }> = {
  ok: { label: 'OK', tone: 'pill-success' }, baixo: { label: 'Cobertura baixa', tone: 'pill-warning' },
  sem_estoque: { label: 'Sem estoque', tone: 'pill-danger' }, parado: { label: 'Parado', tone: 'pill-neutral' }
}
const URGENCY_TONE: Record<string, string> = { URGENT: 'pill-danger', THIS_WEEK: 'pill-warning', NEXT_WEEK: 'pill-neutral', NO_URGENCY: 'pill-success' }

const depotCards = computed(() => {
  const s = depot.value?.summary
  if (!s) return []
  return [
    { label: 'Valor no depósito', value: brl(s.value_olist), hint: `${int(s.units_olist)} unidades · ${int(s.skus)} SKUs` },
    { label: 'Valor no Full', value: brl(s.value_full), hint: `${int(s.units_full)} unidades disponíveis` },
    { label: 'Sem estoque', value: int(s.out_of_stock), hint: 'nem no depósito nem no Full', tone: s.out_of_stock ? 'text-danger' : '' },
    { label: 'Cobertura baixa', value: int(s.low), hint: `menos de ${depot.value?.low_coverage_days} dias de venda`, tone: s.low ? 'text-warning' : '' },
    { label: 'Parados', value: int(s.stalled), hint: 'com estoque e sem venda em 30 dias' }
  ]
})
const fullCards = computed(() => {
  const s = full.value?.summary
  if (!s) return []
  return [
    { label: 'Para repor', value: int(s.replenish), hint: `${int(s.urgent)} com envio urgente`, tone: s.urgent ? 'text-danger' : '' },
    { label: 'Unidades sugeridas', value: int(s.suggested_units), hint: 'pelo Mercado Livre' },
    { label: 'Dá para enviar já', value: int(s.can_send_units), hint: 'com o disponível no depósito (Olist)', tone: 'text-success' },
    { label: 'Falta comprar', value: int(s.to_buy_units), hint: 'sugerido menos o que há no depósito', tone: s.to_buy_units ? 'text-warning' : '' },
    { label: 'Receita perdida', value: brl(s.lost_revenue), hint: `dias sem estoque nas últimas 6 semanas · ${int(s.out_of_stock)} zerados agora`, tone: s.lost_revenue ? 'text-danger' : '' }
  ]
})
const cards = computed(() => (tab.value === 'deposito' ? depotCards.value : fullCards.value))

function weekLabel(h: StockFullRow['history'][number]) {
  return `${h.start_date.slice(8, 10)}/${h.start_date.slice(5, 7)}`
}
function pages(total: number, per: number) {
  return Math.max(1, Math.ceil(total / per))
}

watchEffect(() => {
  header.state.title = 'Estoque'
  header.state.subtitle = session.selectedAccount ? `Mercado Livre · ${session.selectedAccount.nickname} · Olist` : 'Olist e Full'
  header.state.sync = null
  header.state.generatedAt = null
  header.state.refreshing = loading.value
  header.state.onRefresh = () => void load()
})
</script>

<template>
  <EmptyAccountState v-if="!session.selectedAccount" />
  <div v-else class="page space-y-5" data-test="estoque">
    <PageHeader />

    <div class="flex flex-wrap items-end gap-1 border-b-2 border-line" role="tablist" aria-label="Estoque">
      <button v-for="t in [{ key: 'full', label: 'Full e reposição' }, { key: 'deposito', label: 'Depósito (ERP)' }] as const" :key="t.key" type="button" role="tab"
        class="-mb-0.5 rounded-t-card border-b-4 px-5 py-2 text-[15px] font-semibold"
        :class="tab === t.key ? 'border-primary bg-primary-soft text-primary' : 'border-transparent text-ink-2 hover:bg-surface-2'"
        :aria-selected="tab === t.key" :data-test="`aba-${t.key}`" @click="tab = t.key"
      >
        <LogisticBadge v-if="t.key === 'full'" type="fulfillment" size="md" class="mr-1" />{{ t.key === 'full' ? 'e reposição' : t.label }}
      </button>
    </div>

    <p v-if="error" class="text-[13px] text-danger" role="alert">{{ error }}</p>

    <div v-if="cards.length" class="grid grid-cols-2 gap-3 md:grid-cols-5">
      <div v-for="c in cards" :key="c.label" class="card p-4">
        <p class="text-[12px] font-medium text-ink-2">{{ c.label }}</p>
        <p class="mt-1 text-[20px] font-semibold leading-tight" :class="c.tone || 'text-ink'" data-numeric>{{ c.value }}</p>
        <p class="mt-1 text-[11px] text-ink-3">{{ c.hint }}</p>
      </div>
    </div>

    <!-- ===== Full e reposição ===== -->
    <template v-if="tab === 'full'">
      <div class="relative max-w-xl" data-test="filtro-full">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input
          v-model="fullFilters.q" type="search" class="input h-10 w-full pl-9" aria-label="Filtrar produtos do Full"
          placeholder="Filtrar por SKU, nº do anúncio (MLB) ou título"
          @input="fullFilters.page = 1; reload(true)"
        />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button v-for="v in FULL_VIEWS" :key="v.value" type="button" class="rounded-md px-2.5 py-1 text-[13px]"
          :class="fullFilters.view === v.value ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2 hover:bg-surface-2'"
          @click="fullFilters.view = v.value; fullFilters.page = 1; reload()">{{ v.label }}</button>
        <button v-if="session.isAdmin" type="button" class="btn-link ml-auto text-[12px]" @click="syncFull">Reler do Mercado Livre</button>
      </div>
      <p class="text-[12px] text-ink-3">
        Recomendações do próprio Mercado Livre (Planejamento de reposição do Full), relidas a cada 6 horas<template v-if="full?.synced_at"> · última leitura {{ dateTimeShort(full.synced_at) }}</template>.
        "Dá para enviar" usa o disponível no depósito (Olist); "receita perdida" estima as vendas dos dias sem estoque nas últimas 6 semanas.
      </p>

      <div class="card overflow-hidden">
        <table class="w-full table-fixed border-collapse text-[12px]">
          <thead>
            <tr class="border-b border-line text-ink-2">
              <th v-for="c in FULL_COLUMNS" :key="c.sort" scope="col" class="px-2 py-2 font-semibold"
                :class="[c.width, c.align === 'right' ? 'text-right' : 'text-left']"
                :aria-sort="fullFilters.sort === c.sort ? (fullFilters.dir === 'asc' ? 'ascending' : 'descending') : undefined"
              >
                <button type="button" class="inline-flex items-center gap-1 font-semibold hover:text-ink" :class="fullFilters.sort === c.sort ? 'text-ink' : ''"
                  :data-test="`ordenar-${c.sort}`" @click="sortFullBy(c.sort)">
                  {{ c.label }}
                  <ChevronUpIcon v-if="fullFilters.sort === c.sort && fullFilters.dir === 'asc'" class="h-3.5 w-3.5" aria-hidden="true" />
                  <ChevronDownIcon v-else-if="fullFilters.sort === c.sort" class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading && !full"><td colspan="8" class="px-3 py-6 text-center text-ink-3">Carregando…</td></tr>
            <tr v-else-if="full && !full.rows.length"><td colspan="8" class="px-3 py-6 text-center text-ink-3">Nada nesta lista.</td></tr>
            <template v-for="r in full?.rows ?? []" :key="r.user_product_id">
              <tr class="cursor-pointer border-b border-line align-top hover:bg-surface-2" data-test="linha-full" @click="openRow = openRow === r.user_product_id ? null : r.user_product_id">
                <td class="px-2 py-2">
                  <div class="flex gap-2">
                    <img v-if="r.thumbnail" :src="r.thumbnail" alt="" class="h-10 w-10 shrink-0 rounded object-cover" loading="lazy" />
                    <div class="min-w-0">
                      <p class="truncate font-medium text-ink" :title="r.title ?? ''">{{ r.title ?? r.sku ?? r.user_product_id }}</p>
                      <p class="text-[11px] text-ink-3">{{ r.sku ?? 'sem SKU' }}<template v-if="r.variation_label"> · {{ r.variation_label }}</template><template v-if="r.item_id"> · {{ r.item_id }}</template><template v-if="r.price"> · {{ brl(r.price) }}</template></p>
                      <p class="text-[11px]">
                        <span v-if="r.star" class="mr-1 font-semibold text-warning">produto estrela</span>
                        <span v-if="r.restricted" class="mr-1 font-semibold text-danger">com restrição no Full</span>
                        <span v-if="!r.in_full" class="text-ink-3">ainda não está no Full</span>
                      </p>
                    </div>
                  </div>
                </td>
                <td class="px-2 py-2 text-right font-semibold" :class="r.in_full && !r.stock ? 'text-danger' : 'text-ink'" data-numeric>{{ r.stock ?? '—' }}</td>
                <td class="px-2 py-2"><span v-if="r.urgency" class="pill" :class="URGENCY_TONE[r.urgency] ?? 'pill-neutral'">{{ r.urgency_label }}</span></td>
                <td class="px-2 py-2 text-right" data-numeric>
                  <template v-if="r.replenish"><span class="block font-semibold text-ink">{{ int(r.suggested) }}</span><span class="text-[11px] text-ink-3">até {{ r.deadline_label }}</span></template>
                  <span v-else-if="r.legacy" class="block text-[11px] text-ink-3" title="Anúncio do formato antigo (com variações, sem User Product): a API de reposição do Mercado Livre não traz recomendação para ele">sem recomendação do ML<template v-if="r.coverage_days !== null && r.coverage_days !== undefined"> · cobre {{ int(r.coverage_days) }} dias</template></span>
                  <span v-else class="text-ink-3">—</span>
                </td>
                <td class="px-2 py-2 text-right" :class="(r.olist_available ?? 0) <= 0 ? 'text-danger' : 'text-ink'" data-numeric>{{ r.olist_available === null ? '—' : int(r.olist_available) }}</td>
                <td class="px-2 py-2 text-right font-semibold text-success" data-numeric>{{ r.can_send === null ? '—' : int(r.can_send) }}</td>
                <td class="px-2 py-2 text-right font-semibold" :class="r.to_buy ? 'text-warning' : 'text-ink-3'" data-numeric>{{ r.to_buy ? int(r.to_buy) : '—' }}</td>
                <td class="px-2 py-2 text-right" data-numeric>
                  <span class="block text-ink">{{ int(r.units_30d ?? 0) }} un.</span>
                  <span v-if="r.lost_revenue" class="text-[11px] text-danger">−{{ brl(r.lost_revenue) }} perdidos</span>
                </td>
              </tr>
              <tr v-if="openRow === r.user_product_id" class="border-b border-line bg-surface-2">
                <td colspan="8" class="px-4 py-3 text-[12px]">
                  <p class="mb-1 font-semibold text-ink">Últimas semanas no Full</p>
                  <div class="flex flex-wrap gap-2">
                    <div v-for="h in [...r.history].reverse()" :key="h.start_date" class="rounded-card border border-line bg-surface px-2 py-1 text-center">
                      <p class="text-[11px] text-ink-3">semana de {{ weekLabel(h) }}</p>
                      <p class="font-semibold text-ink" data-numeric>{{ h.units_sold }} un.</p>
                      <p class="text-[11px]" :class="h.days_out_of_stock ? 'text-danger' : 'text-ink-3'">{{ h.days_out_of_stock ? `${h.days_out_of_stock} dia(s) sem estoque` : 'sem ruptura' }}</p>
                    </div>
                  </div>
                  <p class="mt-2 text-ink-2">
                    <template v-if="r.frequency">O Mercado Livre recomenda repor a cada {{ r.frequency }} semana(s). </template>
                    <template v-if="r.days_out">{{ r.days_out }} dia(s) sem estoque em 6 semanas ≈ {{ r.lost_units }} unidade(s) que deixaram de vender. </template>
                    <template v-if="r.benefits?.length">Benefícios: {{ r.benefits.join(', ') }}.</template>
                  </p>
                  <p v-if="r.synced_at" class="mt-1 text-[11px] text-ink-3">Lido em {{ dateShort(r.synced_at) }}.</p>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div v-if="full && full.total > full.per_page" class="flex items-center gap-2 text-[13px]">
        <button type="button" class="btn-secondary h-8" :disabled="fullFilters.page <= 1" @click="fullFilters.page--; reload()">Anterior</button>
        <span class="text-ink-2">Página {{ fullFilters.page }} de {{ pages(full.total, full.per_page) }}</span>
        <button type="button" class="btn-secondary h-8" :disabled="fullFilters.page >= pages(full.total, full.per_page)" @click="fullFilters.page++; reload()">Próxima</button>
      </div>
    </template>

    <!-- ===== Depósito (ERP) ===== -->
    <template v-else>
      <div class="relative max-w-xl" data-test="filtro-deposito">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input
          v-model="depotFilters.q" type="search" class="input h-10 w-full pl-9" aria-label="Filtrar estoque do depósito"
          placeholder="Filtrar por SKU, nº do anúncio (MLB), título do anúncio ou palavra do nome"
          @input="depotFilters.page = 1; reload(true)"
        />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button v-for="v in DEPOT_VIEWS" :key="v.value" type="button" class="rounded-md px-2.5 py-1 text-[13px]"
          :class="depotFilters.view === v.value ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2 hover:bg-surface-2'"
          @click="depotFilters.view = v.value; depotFilters.page = 1; reload()">{{ v.label }}</button>
        <select v-model="depotFilters.sort" class="input ml-auto h-9 w-60" @change="depotFilters.page = 1; reload()">
          <option v-for="s in DEPOT_SORTS" :key="s.value" :value="s.value">Ordenar: {{ s.label }}</option>
        </select>
      </div>
      <p class="text-[12px] text-ink-3">
        Estoque geral do Olist (disponível), lido a cada 3 minutos<template v-if="depot?.synced_at"> · {{ dateTimeShort(depot.synced_at) }}</template>.
        Vendas de 30 dias no Mercado Livre: os kits contam para cada componente. Cobertura = (depósito + Full) ÷ venda por dia. Kits não têm estoque próprio e não aparecem.
      </p>

      <p v-if="depotFilters.q && depot" class="text-[12px] text-ink-3">{{ int(depot.total) }} produto(s) encontrado(s). Buscar um anúncio de kit mostra os produtos que o compõem.</p>

      <div class="card overflow-hidden">
        <table class="w-full table-fixed border-collapse text-[12px]">
          <thead>
            <tr class="border-b border-line text-ink-2">
              <th class="w-[30%] px-2 py-2 text-left font-semibold">Produto</th>
              <th class="w-[9%] px-2 py-2 text-right font-semibold">Depósito</th>
              <th class="w-[8%] px-2 py-2 text-right font-semibold"><LogisticBadge type="fulfillment" /></th>
              <th class="w-[9%] px-2 py-2 text-right font-semibold">Custo un.</th>
              <th class="w-[11%] px-2 py-2 text-right font-semibold">Valor</th>
              <th class="w-[9%] px-2 py-2 text-right font-semibold">Vendas 30 dias</th>
              <th class="w-[9%] px-2 py-2 text-right font-semibold">Cobertura</th>
              <th class="w-[15%] px-2 py-2 text-left font-semibold">Situação</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading && !depot"><td colspan="8" class="px-3 py-6 text-center text-ink-3">Carregando…</td></tr>
            <tr v-else-if="depot && !depot.rows.length"><td colspan="8" class="px-3 py-6 text-center text-ink-3">Nada nesta lista.</td></tr>
            <tr v-for="r in depot?.rows ?? []" :key="r.sku" class="border-b border-line align-top" data-test="linha-deposito">
              <td class="px-2 py-2">
                <div class="flex gap-2">
                  <img v-if="r.thumbnail" :src="r.thumbnail" alt="" class="h-10 w-10 shrink-0 rounded object-cover" loading="lazy" />
                  <div class="min-w-0">
                    <p class="truncate font-medium text-ink" :title="r.description ?? ''">{{ r.description ?? r.sku }}</p>
                    <p class="text-[11px] text-ink-3">{{ r.sku }}<template v-if="r.reserved"> · {{ int(r.reserved) }} reservada(s)</template></p>
                  </div>
                </div>
              </td>
              <td class="px-2 py-2 text-right font-semibold" :class="r.olist <= 0 ? 'text-danger' : 'text-ink'" data-numeric>{{ int(r.olist) }}</td>
              <td class="px-2 py-2 text-right" data-numeric>{{ r.full === null ? '—' : int(r.full) }}</td>
              <td class="px-2 py-2 text-right" data-numeric>{{ r.unit_cost === null ? '—' : brl(r.unit_cost) }}</td>
              <td class="px-2 py-2 text-right font-semibold" data-numeric>{{ brl(r.value_olist + r.value_full) }}</td>
              <td class="px-2 py-2 text-right" data-numeric>{{ int(r.sold_30d) }}</td>
              <td class="px-2 py-2 text-right" data-numeric>{{ r.coverage_days === null ? '—' : `${int(r.coverage_days)} dias` }}</td>
              <td class="px-2 py-2">
                <span class="pill" :class="STATE[r.state]?.tone">{{ STATE[r.state]?.label ?? r.state }}</span>
                <span v-if="r.full_asks" class="mt-0.5 block text-[11px] font-semibold text-primary">Full pede {{ int(r.full_asks) }} un.</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="depot && depot.total > depot.per_page" class="flex items-center gap-2 text-[13px]">
        <button type="button" class="btn-secondary h-8" :disabled="depotFilters.page <= 1" @click="depotFilters.page--; reload()">Anterior</button>
        <span class="text-ink-2">Página {{ depotFilters.page }} de {{ pages(depot.total, depot.per_page) }}</span>
        <button type="button" class="btn-secondary h-8" :disabled="depotFilters.page >= pages(depot.total, depot.per_page)" @click="depotFilters.page++; reload()">Próxima</button>
      </div>
    </template>
  </div>
</template>
