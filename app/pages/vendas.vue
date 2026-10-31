<script setup lang="ts">
import { ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import EmptyAccountState from '../components/painel/EmptyAccountState.vue'
import PageHeader from '../components/painel/PageHeader.vue'
import SaleDetailPanel from '../components/vendas/SaleDetailPanel.vue'
import SalesSummary from '../components/vendas/SalesSummary.vue'
import { usePageHeader } from '../composables/usePageHeader'
import { useSales } from '../composables/useSales'
import { brl, dateTimeShort, int, num, pct } from '../lib/format'
import { useSessionStore } from '../stores/session'
import type { SaleRow, SalesFilters } from '../types/sales'

/**
 * `/vendas`: todas as vendas do Mercado Livre dos últimos 3 meses, com totais, gráfico diário,
 * filtros por período/situação/envio/logística, busca e detalhe de cada pedido (pagamento, itens,
 * envio e lucro). A regra (lucro, totais, filtros) é toda da API (`GET /api/sales`).
 */
const session = useSessionStore()
const sales = useSales()
const { filters, response, loading, stale, loadError, details, syncing, syncMessage } = sales

const header = usePageHeader()
watchEffect(() => {
  header.state.title = 'Vendas'
  header.state.subtitle = session.selectedAccount ? `Mercado Livre · ${session.selectedAccount.nickname}` : 'Mercado Livre'
  header.state.sync = null
  header.state.generatedAt = null
  header.state.refreshing = sales.refreshing.value
  header.state.onRefresh = sales.refreshNow
})

onMounted(sales.start)
onBeforeUnmount(sales.stop)

const PERIODS = [
  { value: 'today', label: 'Hoje' }, { value: 'yesterday', label: 'Ontem' },
  { value: '7d', label: '7 dias' }, { value: 'mtd', label: 'Mês até hoje' }, { value: '30d', label: '30 dias' },
  { value: '60d', label: '60 dias' }, { value: '90d', label: '3 meses' }
]

const STATUS_TABS: { value: SalesFilters['status']; label: string }[] = [
  { value: '', label: 'Todas' }, { value: 'paid', label: 'Pagas' }, { value: 'cancelled', label: 'Canceladas' }
]

const SHIPPING_TABS: { value: SalesFilters['shipping']; label: string; key?: string }[] = [
  { value: '', label: 'Todos os envios' },
  { value: 'preparing', label: 'Preparando', key: 'preparing' },
  { value: 'transit', label: 'A caminho', key: 'transit' },
  { value: 'delivered', label: 'Entregues', key: 'delivered' },
  { value: 'problem', label: 'Com problema', key: 'problem' }
]

const LOGISTIC_TABS: { value: SalesFilters['logistic']; label: string }[] = [
  { value: '', label: 'Toda logística' }, { value: 'full', label: 'Full' }, { value: 'flex', label: 'Flex' },
  { value: 'coleta', label: 'Coleta' }, { value: 'agencia', label: 'Agência' }, { value: 'other', label: 'Outras' }
]

const COLUMNS = [
  { key: 'date', label: 'Data', sort: 'date', width: 'w-[7%]', align: 'left' },
  { key: 'sale', label: 'Venda', width: 'w-[16%] max-xl:w-[28%]', align: 'left' },
  { key: 'total', label: 'Valor', sort: 'total', width: 'w-[7%]', align: 'right' },
  { key: 'fee', label: 'Tarifa', width: 'w-[6%]', align: 'right', hide: true },
  { key: 'shipping_cost', label: 'Frete', width: 'w-[6%]', align: 'right', hide: true },
  { key: 'tax', label: 'Imposto', width: 'w-[6%]', align: 'right', hide: true },
  { key: 'fixed_expenses', label: 'Desp. fixas', width: 'w-[6%]', align: 'right', hide: true },
  { key: 'cost', label: 'Custo', width: 'w-[6%]', align: 'right', hide: true },
  { key: 'profit', label: 'Lucro líquido', sort: 'profit_pct', width: 'w-[8%]', align: 'right' },
  { key: 'ads_cost', label: 'Custo Ads', sort: 'ads_cost', width: 'w-[7%]', align: 'right' },
  { key: 'profit_after_ads', label: 'Lucro pós Ads', sort: 'profit_after_ads_pct', width: 'w-[9%]', align: 'right' },
  { key: 'shipping', label: 'Envio', width: 'w-[11%] max-xl:w-[14%]', align: 'left' }
]

const ADS_HINT: Record<string, string> = {
  apurado: 'Gasto de Ads do anúncio no período, dividido entre as unidades vendidas dele no período',
  pendente: 'O dia da venda ainda não fechou na leitura de Ads: o valor é refeito a cada atualização até fechar',
  sem_ads: 'Anúncio fora de campanhas de Ads'
}

const taxPct = (row: SaleRow) => (row.economics && row.economics.revenue ? (row.economics.tax / row.economics.revenue) * 100 : 0)
const fixedPct = (row: SaleRow) => (row.economics && row.economics.revenue ? (row.economics.fixed_expenses / row.economics.revenue) * 100 : 0)
const money = (v: number | null | undefined) => (v === null || v === undefined ? '—' : brl(v))
/** Percentual de um custo sobre a receita da venda. */
const share = (v: number | null | undefined, revenue: number | null | undefined) => (v === null || v === undefined || !revenue ? '' : pct((v / revenue) * 100))
const expanded = ref<number | null>(null)

function toggle(row: SaleRow) {
  expanded.value = expanded.value === row.order_id ? null : row.order_id
  if (expanded.value !== null) sales.loadDetail(row.order_id)
}

function countFor(group: 'shipping' | 'status', key?: string): string {
  if (!response.value || !key) return ''
  const value = response.value.counts[group][key]
  return value !== undefined ? ` (${int(value)})` : ''
}

function logisticCount(value: string): string {
  const v = response.value?.counts.logistic[value]
  return v !== undefined ? ` (${int(v)})` : ''
}

const pages = computed(() => (response.value ? Math.max(1, Math.ceil(response.value.total / response.value.per_page)) : 1))
const hasFilters = computed(() => !!(filters.status || filters.shipping || filters.logistic || filters.q))
const pendingShipments = computed(() => response.value?.sync.pending_shipments ?? 0)

function tone(t: string): string {
  return { ok: 'pill-success', warn: 'pill-warning', bad: 'pill-danger', neutral: 'pill-neutral' }[t] ?? 'pill-neutral'
}

function onDate(which: 'from' | 'to', event: Event) {
  const value = (event.target as HTMLInputElement).value
  sales.setCustomRange(which === 'from' ? value : filters.from, which === 'to' ? value : filters.to)
  if (which === 'from') filters.from = value
  else filters.to = value
}
</script>

<template>
  <EmptyAccountState v-if="!session.selectedAccount" />
  <div v-else class="page space-y-5">
    <PageHeader />

    <!-- período -->
    <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Período">
      <button
        v-for="p in PERIODS"
        :key="p.value"
        type="button"
        class="rounded-full border px-3 py-1 text-[13px]"
        :class="filters.period === p.value ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink-2 hover:bg-surface-2'"
        :aria-pressed="filters.period === p.value"
        @click="sales.setPeriod(p.value)"
      >{{ p.label }}</button>
      <span class="mx-1 text-[12px] text-ink-3">ou</span>
      <input type="date" class="input h-8 w-auto text-[13px]" :value="filters.from" aria-label="Data inicial" @change="onDate('from', $event)" />
      <span class="text-[12px] text-ink-3">até</span>
      <input type="date" class="input h-8 w-auto text-[13px]" :value="filters.to" aria-label="Data final" @change="onDate('to', $event)" />
      <button v-if="session.isAdmin" type="button" class="btn-link ml-auto text-[13px]" :disabled="syncing" @click="sales.syncThreeMonths">
        {{ syncing ? 'Pedindo…' : 'Baixar os 3 meses de novo' }}
      </button>
    </div>
    <p v-if="syncMessage" class="text-[13px] text-ink-2" role="status">{{ syncMessage }}</p>
    <p v-if="pendingShipments > 0" class="rounded-card border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink-2" role="status">
      Buscando os dados de envio de {{ int(pendingShipments) }} vendas (frete pago, entrega, rastreio). Enquanto isso, o lucro delas ainda não considera o frete. Isso se completa sozinho.
    </p>

    <p v-if="stale" role="status" class="rounded-card border border-warning bg-warning-soft px-3 py-2 text-[13px] text-warning">
      Não foi possível atualizar agora — mostrando os últimos dados.
    </p>

    <div v-if="loadError" class="card p-6 text-center" role="alert">
      <p class="text-[15px] text-danger">{{ loadError }}</p>
      <button type="button" class="btn-link mt-3" @click="sales.refreshNow">Tentar de novo</button>
    </div>

    <template v-else>
      <SalesSummary v-if="response" :summary="response.summary" :daily="response.daily" />
      <div v-else class="h-24 animate-pulse rounded-card bg-surface-2" />

      <!-- filtros -->
      <div class="space-y-3">
        <div class="relative max-w-xl">
          <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <input
            :value="filters.q"
            type="search"
            class="input h-10 w-full pl-9"
            placeholder="Buscar por nº da venda, produto, SKU, anúncio, comprador ou rastreio"
            aria-label="Buscar vendas"
            @input="sales.setQuery(($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
          <div class="flex flex-wrap gap-1" role="group" aria-label="Situação da venda">
            <button
              v-for="t in STATUS_TABS"
              :key="t.label"
              type="button"
              class="rounded-md px-2.5 py-1"
              :class="filters.status === t.value ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2 hover:bg-surface-2'"
              @click="sales.change({ status: t.value })"
            >{{ t.label }}</button>
          </div>
          <div class="flex flex-wrap gap-1" role="group" aria-label="Situação do envio">
            <button
              v-for="t in SHIPPING_TABS"
              :key="t.label"
              type="button"
              class="rounded-md px-2.5 py-1"
              :class="filters.shipping === t.value ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2 hover:bg-surface-2'"
              @click="sales.change({ shipping: t.value })"
            >{{ t.label }}{{ countFor('shipping', t.key) }}</button>
          </div>
          <div class="flex flex-wrap gap-1" role="group" aria-label="Logística">
            <button
              v-for="t in LOGISTIC_TABS"
              :key="t.label"
              type="button"
              class="rounded-md px-2.5 py-1"
              :class="filters.logistic === t.value ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2 hover:bg-surface-2'"
              @click="sales.change({ logistic: t.value })"
            >{{ t.label }}{{ t.value ? logisticCount(t.value) : '' }}</button>
          </div>
          <button v-if="hasFilters" type="button" class="btn-link" @click="sales.clearFilters">Limpar filtros</button>
        </div>
      </div>

      <!-- tabela -->
      <div class="card overflow-hidden">
        <table class="w-full table-fixed border-collapse text-[12px]">
          <thead>
            <tr class="border-b border-line">
              <th
                v-for="c in COLUMNS"
                :key="c.key"
                scope="col"
                class="px-2 py-2 font-semibold text-ink-2"
                :class="[c.width, c.align === 'right' ? 'text-right' : 'text-left', c.hide ? 'max-xl:hidden' : '']"
                :aria-sort="c.sort && response?.sort === c.sort ? (response?.dir === 'asc' ? 'ascending' : 'descending') : undefined"
              >
                <button v-if="c.sort" type="button" class="inline-flex items-center gap-1 hover:text-ink" :class="response?.sort === c.sort ? 'text-ink' : ''" @click="sales.sortBy(c.sort)">
                  {{ c.label }}
                  <ChevronUpIcon v-if="response?.sort === c.sort && response?.dir === 'asc'" class="h-3.5 w-3.5" aria-hidden="true" />
                  <ChevronDownIcon v-else-if="response?.sort === c.sort && response?.dir === 'desc'" class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <span v-else>
                  {{ c.label }}
                  <span v-if="c.key === 'profit' || c.key === 'profit_after_ads'" class="block text-[10px] font-normal text-ink-3">R$ e %</span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-if="loading && !response">
              <tr v-for="i in 8" :key="i" class="border-b border-line">
                <td :colspan="COLUMNS.length" class="px-3 py-3"><div class="h-4 animate-pulse rounded bg-surface-2" /></td>
              </tr>
            </template>
            <tr v-else-if="!response?.sales.length">
              <td :colspan="COLUMNS.length" class="px-3 py-10 text-center text-ink-3">Nenhuma venda encontrada com esses filtros.</td>
            </tr>

            <template v-for="row in response?.sales ?? []" :key="row.order_id">
              <tr class="cursor-pointer border-b border-line hover:bg-surface-2" :class="row.status.tone === 'bad' ? 'opacity-70' : ''" data-test="sale-row" @click="toggle(row)">
                <td class="px-2 py-2 align-top text-ink-2">{{ dateTimeShort(row.date_created) }}</td>
                <td class="px-2 py-2 align-top">
                  <div class="flex items-start gap-2">
                    <img v-if="row.items[0]?.thumbnail" :src="row.items[0].thumbnail" alt="" class="h-12 w-12 shrink-0 rounded object-cover" loading="lazy" />
                    <div class="min-w-0">
                      <p class="truncate text-[13px] font-medium text-ink" :title="row.items.map((i) => i.title).join(' + ')">{{ row.items[0]?.title ?? 'Sem itens' }}</p>
                      <p class="truncate text-[12px] text-ink-3">
                        #{{ row.order_id }} · {{ row.items[0]?.sku ?? 'sem SKU' }} · {{ int(row.units) }} un
                        <template v-if="row.items.length > 1"> · +{{ row.items.length - 1 }} {{ row.items.length === 2 ? 'item' : 'itens' }}</template>
                        <span v-if="row.status.tone !== 'ok'" class="ml-1" :class="tone(row.status.tone)">{{ row.status.label }}</span>
                      </p>
                      <p v-if="row.issue" class="truncate text-[12px]" :class="tone(row.issue.tone)" :title="row.issue.label" data-test="sale-issue">{{ row.issue.label }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-2 py-2 text-right align-top" data-numeric>{{ brl(row.economics?.revenue ?? row.total_amount) }}</td>
                <td class="px-2 py-2 text-right align-top max-xl:hidden" data-numeric>
                  <template v-if="row.economics"><span class="block text-danger">{{ money(row.economics.fee) }}</span><span class="block text-[11px] text-ink">{{ share(row.economics.fee, row.economics.revenue) }}</span></template>
                  <template v-else>—</template>
                </td>
                <td class="px-2 py-2 text-right align-top max-xl:hidden" data-numeric>
                  <template v-if="row.economics">
                    <template v-if="row.economics.shipping_known"><span class="block text-danger">{{ money(row.economics.shipping_cost) }}</span><span class="block text-[11px] text-ink">{{ share(row.economics.shipping_cost, row.economics.revenue) }}</span></template>
                    <template v-else>…</template>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="px-2 py-2 text-right align-top max-xl:hidden" data-numeric data-test="col-imposto">
                  <span v-if="row.economics" :title="`${num(taxPct(row), 1)}% da receita dos itens`"><span class="block text-danger">{{ money(row.economics.tax) }}</span><span class="block text-[11px] text-ink">{{ share(row.economics.tax, row.economics.revenue) }}</span></span>
                  <span v-else>—</span>
                </td>
                <td class="px-2 py-2 text-right align-top max-xl:hidden" data-numeric data-test="col-despesas">
                  <span v-if="row.economics" :title="`${num(fixedPct(row), 1)}% do valor da venda`"><span class="block text-danger">{{ money(row.economics.fixed_expenses) }}</span><span class="block text-[11px] text-ink">{{ share(row.economics.fixed_expenses, row.economics.revenue) }}</span></span>
                  <span v-else>—</span>
                </td>
                <td class="px-2 py-2 text-right align-top max-xl:hidden" data-numeric>
                  <template v-if="row.economics">
                    <span v-if="row.economics.cost !== null">{{ money(row.economics.cost) }}</span>
                    <span v-else class="text-[11px] text-warning">sem custo</span>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="px-2 py-2 text-right align-top" data-numeric>
                  <template v-if="row.economics && row.economics.net_profit !== null">
                    <span class="block font-semibold" :class="row.economics.net_profit < 0 ? 'text-danger' : 'text-success'">{{ money(row.economics.net_profit) }}</span>
                    <span class="block text-[11px] text-ink">{{ pct(row.economics.net_profit_pct) }}</span>
                  </template>
                  <span v-else class="text-ink-3" :title="row.economics ? 'Sem custo de algum item: o lucro não pode ser calculado' : 'Venda cancelada'">—</span>
                </td>
                <td class="px-2 py-2 text-right align-top" data-numeric data-test="col-ads">
                  <template v-if="row.economics && row.economics.ads_state !== 'sem_ads'">
                    <span :title="ADS_HINT[row.economics.ads_state]"><span class="block" :class="row.economics.ads_cost > 0 ? 'text-danger' : ''">{{ money(row.economics.ads_cost) }}</span><span class="block text-[11px] text-ink">{{ share(row.economics.ads_cost, row.economics.revenue) }}</span></span>
                    <span v-if="row.economics.ads_state === 'pendente'" class="block text-[10px] text-warning" :title="ADS_HINT.pendente">pendente</span>
                  </template>
                  <span v-else class="text-ink-3" :title="row.economics ? ADS_HINT.sem_ads : ''">—</span>
                </td>
                <td class="px-2 py-2 text-right align-top" data-numeric data-test="col-lucro-pos-ads">
                  <template v-if="row.economics && row.economics.net_profit_after_ads !== null">
                    <span class="block font-semibold" :class="row.economics.net_profit_after_ads < 0 ? 'text-danger' : 'text-success'">{{ money(row.economics.net_profit_after_ads) }}</span>
                    <span class="block text-[11px] text-ink">{{ pct(row.economics.net_profit_after_ads_pct) }}</span>
                  </template>
                  <span v-else class="text-ink-3">—</span>
                </td>
                <td class="px-2 py-2 align-top">
                  <span :class="tone(row.shipping.tone)">{{ row.shipping.label }}</span>
                  <span v-if="row.shipping.logistic_label" class="mt-0.5 block text-[11px] text-ink-3">{{ row.shipping.logistic_label }}</span>
                </td>
              </tr>
              <tr v-if="expanded === row.order_id" class="border-b border-line bg-surface-2">
                <td :colspan="COLUMNS.length" class="border-l-4 border-l-primary px-4 py-4">
                  <SaleDetailPanel :sale="details[row.order_id]" />
                </td>
              </tr>
            </template>
          </tbody>
        </table>

        <div v-if="response && response.total > 0" class="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-[12px] text-ink-2">
          <span>{{ int(response.total) }} vendas · página {{ response.page }} de {{ pages }}</span>
          <div class="flex gap-2">
            <button type="button" class="btn-link" :disabled="response.page <= 1" @click="sales.setPage(response.page - 1)">Anterior</button>
            <button type="button" class="btn-link" :disabled="response.page >= pages" @click="sales.setPage(response.page + 1)">Próxima</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
