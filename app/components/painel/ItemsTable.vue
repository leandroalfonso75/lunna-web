<script setup lang="ts">
import { ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { useItemsTable } from '../../composables/useItemsTable'
import { usePageHeader } from '../../composables/usePageHeader'
import { brl, int, num, pct } from '../../lib/format'
import type { ItemsNumericFilterKey } from '../../lib/itemsQuery'
import type { ItemEconomics, ItemRow } from '../../types/painel'

const COST_SOURCE_LABEL: Record<string, string> = {
  peps: 'Custo PEPS do Olist',
  cadastro: 'Custo cadastrado no produto do Olist',
  custo_medio: 'Custo médio do produto no Olist',
  ultima_entrada: 'Custo da última entrada de estoque no Olist (produto sem saldo)',
  kit: 'Kit: soma do custo dos componentes no Olist',
  manual: 'Custo informado manualmente'
}

const money = (v: number | null | undefined) => (v === null || v === undefined ? '—' : brl(v))
/** Percentual de um custo sobre o preço de venda. */
const share = (v: number | null | undefined, price: number) => (v === null || v === undefined || !price ? '' : pct((v / price) * 100))

function feesHint(e: ItemEconomics): string {
  if (!e.fees_known) return 'A tarifa do Mercado Livre ainda não foi lida para este anúncio.'
  return `Frete ${brl(e.shipping)} + taxa fixa ${brl(e.fixed_fee)} + financiamento ${brl(e.financing)}`
}

/**
 * Tabela de anúncios (`/anuncios`, SPEC §7.7). Chama `useItemsTable()`
 * (único ponto de instância — a página não repete a chamada) e cuida só do
 * que é do componente: abrir/fechar o detalhe da linha, montar as colunas.
 * Toda regra (filtro/busca/ordenação/paginação) é da API; aqui só se manda
 * o que o usuário digitou/clicou.
 */
const COLUMNS: { key: string; label: string; sort?: string; filter?: 'text' | 'numeric'; placeholder?: string; width: string; hide?: boolean }[] = [
  { key: 'title', label: 'Anúncio', sort: 'title', filter: 'text', placeholder: 'título ou ID', width: 'w-[20%] max-xl:w-[24%]' },
  { key: 'sku', label: 'SKU', sort: 'sku', filter: 'text', placeholder: 'sem sku', width: 'w-[8%]' },
  { key: 'price', label: 'Preço', sort: 'price', filter: 'numeric', placeholder: '>50', width: 'w-[8%]' },
  { key: 'stock', label: 'Estoque', sort: 'stock', filter: 'numeric', placeholder: '>10', width: 'w-[6%]' },
  { key: 'cost', label: 'Custo', width: 'w-[8%]' },
  { key: 'commission', label: 'Comissão', width: 'w-[8%]' },
  { key: 'shipping_fees', label: 'Frete/taxas', width: 'w-[8%]' },
  { key: 'fixed_expenses', label: 'Desp. fixas', width: 'w-[7%]' },
  { key: 'tax', label: 'Imposto', width: 'w-[7%]' },
  { key: 'net_profit', label: 'Lucro líquido', sort: 'net_profit_pct', width: 'w-[9%]' },
  { key: 'ads', label: 'Custo Ads', width: 'w-[7%]' },
  { key: 'net_profit_after_ads', label: 'Lucro pós Ads', sort: 'net_profit_after_ads_pct', width: 'w-[9%]' },
  { key: 'coverage_days', label: 'Cobertura', sort: 'coverage_days', filter: 'numeric', placeholder: '<14', width: 'w-[7%]', hide: true },
  { key: 'quality_score', label: 'Qualidade', sort: 'quality_score', filter: 'numeric', placeholder: '>=70', width: 'w-[8%]', hide: true }
]

const MONEY_COLUMNS = ['cost', 'commission', 'shipping_fees', 'fixed_expenses', 'tax', 'net_profit', 'ads', 'net_profit_after_ads']

const STATUS_TABS: { value: 'active' | 'paused' | 'closed' | 'all'; label: string }[] = [
  { value: 'active', label: 'Ativos' },
  { value: 'paused', label: 'Pausados' },
  { value: 'closed', label: 'Finalizados' },
  { value: 'all', label: 'Todos' }
]

const table = useItemsTable()
const { filters, response, loading, stale, loadError, account, sync, generatedAt, refreshing } = table

const header = usePageHeader()
watchEffect(() => {
  header.state.title = 'Anúncios'
  header.state.subtitle = account.value ? `Mercado Livre · ${account.value.nickname}` : 'Mercado Livre'
  header.state.sync = sync.value
  header.state.generatedAt = generatedAt.value
  header.state.refreshing = refreshing.value
  header.state.onRefresh = table.refreshNow
})

onMounted(table.start)
onBeforeUnmount(table.stop)

const expandedId = ref<string | null>(null)

function toggleRow(item: ItemRow) {
  expandedId.value = expandedId.value === item.id ? null : item.id
}

// Modo "focado" (?id=): expande a única linha assim que ela chegar.
watchEffect(() => {
  if (filters.id && response.value?.items[0]) expandedId.value = response.value.items[0].id
})

function onNumericInput(key: ItemsNumericFilterKey, event: Event) {
  table.setNumericFilter(key, (event.target as HTMLInputElement).value)
}

function totalPages(): number {
  if (!response.value || !response.value.per_page) return 1
  return Math.max(1, Math.ceil(response.value.total / response.value.per_page))
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="filters.id" class="card flex flex-wrap items-center justify-between gap-3 p-3">
      <p class="text-[14px] text-ink-2">Mostrando 1 anúncio.</p>
      <button type="button" class="btn-secondary" @click="table.showAllItems">Ver todos</button>
    </div>

    <template v-else>
      <nav class="tab-bar" aria-label="Abas de status">
        <button
          v-for="tab in STATUS_TABS"
          :key="tab.value"
          type="button"
          :class="filters.status === tab.value ? 'tab-active' : 'tab'"
          @click="table.setStatus(tab.value)"
        >
          {{ tab.label }} ({{ response?.status_counts[tab.value] ?? 0 }})
        </button>
      </nav>

      <div class="flex flex-wrap items-center gap-3">
        <div class="relative min-w-[220px] flex-1">
          <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <input
            :value="filters.q"
            type="search"
            class="input pl-9"
            placeholder="Buscar por título, ID ou SKU"
            aria-label="Buscar anúncios"
            @input="table.setQuery(($event.target as HTMLInputElement).value)"
          />
        </div>

        <select :value="filters.type" class="input w-auto" aria-label="Tipo de anúncio" @change="table.setType(($event.target as HTMLSelectElement).value as '' | 'P' | 'C')">
          <option value="">Todos os tipos</option>
          <option value="P">Premium</option>
          <option value="C">Clássico</option>
        </select>

        <select
          :value="filters.shipping"
          class="input w-auto"
          aria-label="Envio"
          @change="table.setShipping(($event.target as HTMLSelectElement).value as '' | 'full' | 'non_full')"
        >
          <option value="">Todo envio</option>
          <option value="full">Full</option>
          <option value="non_full">Fora do Full</option>
        </select>

        <button
          v-if="(response?.active_filters_count ?? 0) > 0"
          type="button"
          class="btn-link"
          @click="table.clearFilters"
        >
          Limpar filtros ({{ response?.active_filters_count }})
        </button>
      </div>

      <div v-if="filters.alert && response?.active_filter.alert" class="flex items-center gap-2">
        <span class="pill-primary">
          {{ response.active_filter.alert.title }}
          <button type="button" class="ml-1 font-semibold" aria-label="Remover filtro de alerta" @click="table.setAlert(null)">×</button>
        </span>
      </div>
    </template>

    <p v-if="stale" role="status" class="rounded-card border border-warning bg-warning-soft px-3 py-2 text-[13px] text-warning">
      Não foi possível atualizar agora — mostrando os últimos dados.
    </p>

    <div v-if="loadError" class="card p-6 text-center" role="alert">
      <p class="text-[15px] text-danger">{{ loadError }}</p>
      <button type="button" class="btn-link mt-3" @click="table.refreshNow">Tentar de novo</button>
    </div>

    <div v-else class="card overflow-hidden">
      <div>
        <table class="w-full table-fixed border-collapse text-[12px]">
          <thead>
            <tr class="border-b border-line">
              <th
                v-for="column in COLUMNS"
                :key="column.key"
                scope="col"
                class="px-2 py-2 font-semibold text-ink-2"
                :class="[column.width, ['title', 'sku'].includes(column.key) ? 'text-left' : 'text-right', column.hide ? 'max-xl:hidden' : '']"
                :aria-sort="column.sort && !filters.id && response?.sort === column.sort ? (response?.dir === 'asc' ? 'ascending' : 'descending') : undefined"
              >
                <button
                  v-if="column.sort && !filters.id"
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-ink"
                  :class="response?.sort === column.sort ? 'text-ink' : ''"
                  @click="table.sortBy(column.sort)"
                >
                  {{ column.label }}
                  <ChevronUpIcon v-if="response?.sort === column.sort && response?.dir === 'asc'" class="h-3.5 w-3.5" aria-hidden="true" />
                  <ChevronDownIcon v-else-if="response?.sort === column.sort && response?.dir === 'desc'" class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <span v-else>
                  {{ column.label }}
                  <span v-if="MONEY_COLUMNS.includes(column.key)" class="block text-[10px] font-normal text-ink-3">{{ column.key === 'net_profit' ? '% e R$' : 'R$' }}</span>
                </span>
              </th>
            </tr>
            <tr v-if="!filters.id" class="border-b border-line">
              <th v-for="column in COLUMNS" :key="`f-${column.key}`" class="px-2 py-1.5" :class="column.hide ? 'max-xl:hidden' : ''">
                <input
                  v-if="column.filter === 'text' && column.key === 'title'"
                  :value="filters.titleFilter"
                  type="text"
                  class="input h-8 text-[13px]"
                  :placeholder="column.placeholder"
                  :aria-label="`Filtrar por ${column.label}`"
                  @input="table.setTitleFilter(($event.target as HTMLInputElement).value)"
                />
                <input
                  v-else-if="column.filter === 'text' && column.key === 'sku'"
                  :value="filters.skuFilter"
                  type="text"
                  class="input h-8 text-[13px]"
                  :placeholder="column.placeholder"
                  :aria-label="`Filtrar por ${column.label}`"
                  @input="table.setSkuFilter(($event.target as HTMLInputElement).value)"
                />
                <input
                  v-else-if="column.filter === 'numeric'"
                  :value="filters.numericFilters[column.key as ItemsNumericFilterKey] ?? ''"
                  type="text"
                  inputmode="text"
                  class="input h-8 text-[13px]"
                  :class="response?.invalid_filters.includes(column.key) ? 'border-danger text-danger' : ''"
                  :placeholder="column.placeholder"
                  :aria-label="`Filtrar por ${column.label}`"
                  :aria-invalid="response?.invalid_filters.includes(column.key) ? 'true' : 'false'"
                  @input="onNumericInput(column.key as ItemsNumericFilterKey, $event)"
                />
              </th>
            </tr>
          </thead>

          <tbody>
            <template v-if="loading && !response">
              <tr v-for="i in 8" :key="i" class="border-b border-line">
                <td :colspan="COLUMNS.length" class="px-3 py-3"><div class="h-4 animate-pulse rounded bg-surface-2" /></td>
              </tr>
            </template>

            <tr v-else-if="!response?.items.length">
              <td :colspan="COLUMNS.length" class="px-3 py-10 text-center text-ink-3">Nenhum anúncio encontrado com esses filtros.</td>
            </tr>

            <template v-for="item in response?.items ?? []" :key="item.id">
              <tr class="group cursor-pointer border-b border-line hover:bg-surface-2" @click="toggleRow(item)">
                <td class="px-2 py-2">
                  <p class="truncate text-[13px] font-medium text-ink" :title="item.title">{{ item.title }}</p>
                  <p class="truncate text-[12px] text-ink-3">
                    {{ item.id }} · {{ item.status_label }}
                    <span v-if="item.full" class="pill-primary ml-1 px-1.5 py-0 text-[10px]">Full</span>
                  </p>
                </td>
                <td class="truncate px-2 py-2 text-ink-2" :title="item.sku ?? 'sem SKU'">{{ item.sku ?? 'sem SKU' }}</td>
                <td class="px-2 py-2 text-right" data-numeric>
                  <span v-if="item.original_price" class="block text-[11px] text-ink-3 line-through">{{ brl(item.original_price) }}</span>
                  {{ brl(item.price) }}
                </td>
                <td class="px-2 py-2 text-right" data-numeric :class="{ 'font-semibold text-danger': item.stock_state === 'bad', 'text-warning': item.stock_state === 'warn' }">
                  {{ int(item.stock) }}
                </td>
                <td class="px-2 py-2 text-right" data-numeric data-test="col-custo">
                  <template v-if="item.economics">
                    <span v-if="item.economics.cost !== null" :title="COST_SOURCE_LABEL[item.economics.cost_source ?? ''] ?? ''">
                      <span class="block text-danger">{{ money(item.economics.cost) }}</span>
                      <span class="block text-[11px] text-ink">{{ share(item.economics.cost, item.economics.price) }}</span>
                    </span>
                    <span v-else class="text-[11px] text-warning" title="Sem custo no Olist para este SKU">sem custo</span>
                  </template>
                  <span v-else class="text-ink-3">—</span>
                </td>
                <td class="px-2 py-2 text-right" data-numeric data-test="col-comissao">
                  <span
                    v-if="item.economics && item.economics.fees_known"
                    :title="item.economics.fees_split ? 'Comissão do Mercado Livre' : 'Tarifa total do Mercado Livre (o detalhe ainda não foi lido)'"
                  ><span class="block text-danger">{{ money(item.economics.commission) }}</span><span class="block text-[11px] text-ink">{{ share(item.economics.commission, item.economics.price) }}</span></span>
                  <span v-else class="text-ink-3">—</span>
                </td>
                <td class="px-2 py-2 text-right" data-numeric data-test="col-frete">
                  <span v-if="item.economics" :title="feesHint(item.economics)"><span class="block text-danger">{{ money(item.economics.shipping_fees) }}</span><span class="block text-[11px] text-ink">{{ share(item.economics.shipping_fees, item.economics.price) }}</span></span>
                  <span v-else class="text-ink-3">—</span>
                </td>
                <td class="px-2 py-2 text-right" data-numeric data-test="col-despesas">
                  <span v-if="item.economics" :title="`${num(item.economics.fixed_expenses_pct, 1)}% do preço de venda`"><span class="block text-danger">{{ money(item.economics.fixed_expenses) }}</span><span class="block text-[11px] text-ink">{{ share(item.economics.fixed_expenses, item.economics.price) }}</span></span>
                  <span v-else class="text-ink-3">—</span>
                </td>
                <td class="px-2 py-2 text-right" data-numeric data-test="col-imposto">
                  <span v-if="item.economics" :title="`${num(item.economics.tax_pct, 1)}% do preço de venda (Configurações > Impostos e margem)`"><span class="block text-danger">{{ money(item.economics.tax) }}</span><span class="block text-[11px] text-ink">{{ share(item.economics.tax, item.economics.price) }}</span></span>
                  <span v-else class="text-ink-3">—</span>
                </td>
                <td class="px-2 py-2 text-right" data-numeric data-test="col-lucro">
                  <template v-if="item.economics && item.economics.net_profit !== null">
                    <span class="block font-semibold" :class="item.economics.net_profit < 0 ? 'text-danger' : 'text-success'" data-test="lucro-valor">{{ money(item.economics.net_profit) }}</span>
                    <span class="block text-[11px] text-ink" data-test="lucro-pct">{{ pct(item.economics.net_profit_pct) }}</span>
                  </template>
                  <span v-else class="text-ink-3" :title="item.economics ? 'Sem custo no Olist: o lucro não pode ser calculado' : ''">—</span>
                </td>
                <td class="px-2 py-2 text-right" data-numeric data-test="col-ads">
                  <span v-if="item.economics" :title="item.economics.ads_spend > 0 ? `${brl(item.economics.ads_spend)} em ${item.economics.ads_days} dias ÷ ${item.economics.ads_units} unidades vendidas` : `Sem gasto de Ads nos últimos ${item.economics.ads_days} dias`">
                    <span class="block" :class="item.economics.ads_unit > 0 ? 'text-danger' : 'text-ink-3'">{{ money(item.economics.ads_unit) }}</span>
                    <span class="block text-[11px] text-ink">{{ share(item.economics.ads_unit, item.economics.price) }}</span>
                  </span>
                  <span v-else class="text-ink-3">—</span>
                </td>
                <td class="px-2 py-2 text-right" data-numeric data-test="col-lucro-pos-ads">
                  <template v-if="item.economics && item.economics.net_profit_after_ads !== null">
                    <span class="block font-semibold" :class="item.economics.net_profit_after_ads < 0 ? 'text-danger' : 'text-success'">{{ money(item.economics.net_profit_after_ads) }}</span>
                    <span class="block text-[11px] text-ink">{{ pct(item.economics.net_profit_after_ads_pct) }}</span>
                  </template>
                  <span v-else class="text-ink-3">—</span>
                </td>
                <td class="px-2 py-2 text-right max-xl:hidden" data-numeric :class="{ 'font-semibold text-danger': item.coverage_state === 'bad', 'text-warning': item.coverage_state === 'warn' }">
                  {{ item.coverage_days !== null ? `${num(item.coverage_days, 1)} d` : '—' }}
                </td>
                <td class="px-2 py-2 max-xl:hidden">
                  <div v-if="item.quality_score !== null" class="flex items-center justify-end gap-1.5">
                    <div class="h-1.5 w-8 overflow-hidden rounded-full bg-surface-2">
                      <div
                        class="h-full rounded-full"
                        :class="{ 'bg-success': item.quality_state === 'ok', 'bg-warning': item.quality_state === 'warn', 'bg-danger': item.quality_state === 'bad' }"
                        :style="{ width: `${item.quality_score}%` }"
                      />
                    </div>
                    <span data-numeric>{{ item.quality_score }}</span>
                  </div>
                  <span v-else class="block text-right text-ink-3">—</span>
                </td>
              </tr>

              <tr v-if="expandedId === item.id" class="border-b border-line bg-surface-2">
                <td :colspan="COLUMNS.length" class="border-l-4 border-l-primary px-4 py-4">
                  <div class="grid grid-cols-1 gap-4 text-[13px] sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                    <div class="card p-4">
                      <p class="mb-2 font-semibold text-ink">Preço e oferta</p>
                      <dl>
                        <div class="def-row">
                          <dt>Preço</dt>
                          <dd data-numeric>
                            <span v-if="item.original_price" class="mr-1 font-normal text-ink-3 line-through">{{ brl(item.original_price) }}</span>
                            {{ brl(item.price) }}
                          </dd>
                        </div>
                        <div v-if="item.discount_pct" class="def-row"><dt>Desconto</dt><dd data-numeric>{{ pct(item.discount_pct) }}</dd></div>
                        <div class="def-row"><dt>Frete</dt><dd>{{ item.free_shipping ? 'Grátis' : 'Pago pelo comprador' }}</dd></div>
                        <div class="def-row"><dt>Logística</dt><dd>{{ item.full ? 'Full' : 'Fora do Full' }}</dd></div>
                        <div class="def-row"><dt>Catálogo</dt><dd>{{ item.catalog ? 'Sim' : 'Não' }}</dd></div>
                      </dl>
                    </div>

                    <div class="card p-4">
                      <p class="mb-2 font-semibold text-ink">Desempenho 7 dias</p>
                      <div class="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1">
                        <span />
                        <span class="text-right text-[11px] font-medium uppercase tracking-wide text-ink-3">Atual</span>
                        <span class="text-right text-[11px] font-medium uppercase tracking-wide text-ink-3">Anterior</span>

                        <span class="text-ink-2">Visitas</span>
                        <span class="text-right text-ink" data-numeric>{{ int(item.visits_7d) }}</span>
                        <span class="text-right text-ink-3" data-numeric>{{ int(item.prev_visits_7d) }}</span>

                        <span class="text-ink-2">Vendas</span>
                        <span class="text-right text-ink" data-numeric>{{ int(item.units_7d) }}</span>
                        <span class="text-right text-ink-3" data-numeric>{{ int(item.prev_units_7d) }}</span>

                        <span class="text-ink-2">Conversão</span>
                        <span class="text-right text-ink" data-numeric>{{ pct(item.conversion_7d) }}</span>
                        <span class="text-right text-ink-3" data-numeric>{{ pct(item.prev_conversion_7d) }}</span>
                      </div>
                      <dl class="mt-2 border-t border-line pt-1">
                        <div class="def-row">
                          <dt>Variação nas vendas</dt>
                          <dd
                            data-numeric
                            :class="{ 'text-success': item.units_delta_direction === 'up', 'text-danger': item.units_delta_direction === 'down' }"
                          >
                            {{ item.units_delta !== null ? `${item.units_delta > 0 ? '+' : ''}${int(item.units_delta)}` : '—' }}
                          </dd>
                        </div>
                        <div class="def-row"><dt>Faturado</dt><dd data-numeric>{{ brl(item.revenue_7d) }}</dd></div>
                        <div class="def-row"><dt>Após tarifa</dt><dd data-numeric>{{ brl(item.net_after_fee_7d) }}</dd></div>
                      </dl>
                    </div>

                    <div class="card p-4" data-test="resultado-unidade">
                      <p class="mb-2 font-semibold text-ink">Resultado por unidade</p>
                      <dl v-if="item.economics">
                        <div class="def-row"><dt>Preço de venda</dt><dd data-numeric>{{ brl(item.economics.price) }}</dd></div>
                        <div class="def-row">
                          <dt>Custo (Olist)</dt>
                          <dd data-numeric>
                            <template v-if="item.economics.cost !== null">− {{ brl(item.economics.cost) }}</template>
                            <span v-else class="text-warning">sem custo</span>
                          </dd>
                        </div>
                        <div v-if="item.economics.fees_known" class="def-row"><dt>Comissão</dt><dd data-numeric>− {{ brl(item.economics.commission) }}</dd></div>
                        <div class="def-row"><dt>Frete/taxas</dt><dd data-numeric>− {{ brl(item.economics.shipping_fees) }}</dd></div>
                        <div class="def-row"><dt>Despesas fixas ({{ num(item.economics.fixed_expenses_pct, 1) }}%)</dt><dd data-numeric>− {{ brl(item.economics.fixed_expenses) }}</dd></div>
                        <div class="def-row"><dt>Imposto ({{ num(item.economics.tax_pct, 1) }}%)</dt><dd data-numeric>− {{ brl(item.economics.tax) }}</dd></div>
                        <div class="def-row"><dt>Custo Ads por unidade ({{ item.economics.ads_days }} dias)</dt><dd data-numeric>− {{ brl(item.economics.ads_unit) }}</dd></div>
                        <div class="def-row border-t border-line pt-1">
                          <dt class="font-semibold text-ink">Lucro líquido</dt>
                          <dd v-if="item.economics.net_profit !== null" data-numeric class="font-semibold" :class="item.economics.net_profit < 0 ? 'text-danger' : 'text-success'">
                            {{ brl(item.economics.net_profit) }} ({{ pct(item.economics.net_profit_pct) }})
                          </dd>
                          <dd v-else class="text-ink-3">—</dd>
                        </div>
                      </dl>
                      <p v-else class="text-ink-2">Sem preço de venda para calcular.</p>
                      <p v-if="item.economics && item.economics.cost === null" class="mt-2 text-[12px] text-warning">
                        Este SKU não tem custo no Olist, por isso o lucro não foi calculado.
                      </p>
                      <p v-if="item.economics && item.economics.cost !== null" class="mt-2 text-[12px] text-ink-3">{{ COST_SOURCE_LABEL[item.economics.cost_source ?? ''] }}.</p>
                      <p v-if="item.economics && !item.economics.fees_split && item.economics.fees_known" class="mt-1 text-[12px] text-ink-3">
                        A tarifa total entrou como comissão; o detalhe (taxa fixa) será lido na próxima atualização.
                      </p>
                    </div>

                    <div class="card p-4">
                      <p class="mb-2 font-semibold text-ink">Estoque e cadastro</p>
                      <dl>
                        <div class="def-row"><dt>Disponível</dt><dd data-numeric>{{ int(item.stock) }}</dd></div>
                        <div class="def-row"><dt>Cobertura</dt><dd data-numeric>{{ item.coverage_days !== null ? `${num(item.coverage_days, 1)} dias` : '—' }}</dd></div>
                        <div class="def-row"><dt>SKU</dt><dd>{{ item.sku ?? 'sem SKU' }}</dd></div>
                        <div class="def-row"><dt>Variações</dt><dd data-numeric>{{ item.variations }}</dd></div>
                      </dl>
                    </div>

                    <div class="card p-4">
                      <p class="mb-2 font-semibold text-ink">Qualidade</p>
                      <template v-if="item.quality_score !== null">
                        <div class="flex items-center gap-2">
                          <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                            <div
                              class="h-full rounded-full"
                              :class="{ 'bg-success': item.quality_state === 'ok', 'bg-warning': item.quality_state === 'warn', 'bg-danger': item.quality_state === 'bad' }"
                              :style="{ width: `${item.quality_score}%` }"
                            />
                          </div>
                          <span class="shrink-0 text-ink" data-numeric>{{ item.quality_score }}/100</span>
                        </div>
                        <p class="mt-1 text-[12px] text-ink-3">{{ item.quality_level }}</p>
                      </template>
                      <p v-else class="text-ink-2">O Mercado Livre não calculou.</p>
                      <ul v-if="item.quality_actions.length" class="mt-2 space-y-1 text-ink-2">
                        <li v-for="(action, i) in item.quality_actions.slice(0, 6)" :key="i" class="flex gap-1.5">
                          <span class="text-ink-3" aria-hidden="true">•</span>
                          <span><span class="text-ink">{{ action.title }}</span><template v-if="action.label"> — {{ action.label }}</template></span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div class="mt-3 flex flex-wrap gap-4 text-[13px]">
                    <a :href="item.links.public" target="_blank" rel="noopener" class="btn-link">Ver anúncio publicado</a>
                    <a :href="item.links.seller_panel" target="_blank" rel="noopener" class="btn-link">Ver no painel do vendedor</a>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="response && response.total > response.per_page" class="flex items-center justify-between gap-3 border-t border-line px-3 py-2 text-[13px] text-ink-2">
        <span>{{ response.total }} anúncios · página {{ response.page }} de {{ totalPages() }}</span>
        <div class="flex gap-2">
          <button type="button" class="btn-secondary" :disabled="response.page <= 1" @click="table.setPage(response.page - 1)">Anterior</button>
          <button type="button" class="btn-secondary" :disabled="response.page >= totalPages()" @click="table.setPage(response.page + 1)">Próxima</button>
        </div>
      </div>
    </div>
  </div>
</template>
