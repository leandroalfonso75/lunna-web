<script setup lang="ts">
import { CalendarDaysIcon, ShoppingCartIcon } from '@heroicons/vue/24/outline'
import { computed, ref } from 'vue'
import CatalogTable from '../components/painel/CatalogTable.vue'
import EmptyAccountState from '../components/painel/EmptyAccountState.vue'
import ItemsTable from '../components/painel/ItemsTable.vue'
import ListingFilterSelect from '../components/painel/ListingFilterSelect.vue'
import PageHeader from '../components/painel/PageHeader.vue'
import { useSessionStore } from '../stores/session'

/**
 * `/anuncios` (SPEC §7.7): tabela completa de anúncios com filtros (`ItemsTable.vue`, dona do cabeçalho) e a aba
 * Catálogo (pedido do usuário em 08/11/2026): anúncios de catálogo, sincronização com tradicional e ganhando/perdendo.
 * Aba Tradicional (25/11/2026), ao lado de Catálogo: a mesma tabela só com os anúncios que não são de catálogo, dizendo se
 * cada um é sincronizado com catálogo e com o link do anúncio de catálogo (excluir avisa que o catálogo sai junto).
 * Acima das abas, cumulativos e valendo para todas (aplicados na API):
 * - "Anúncios criados há mais de" 30, 60, 90, 180, 365 dias ou personalizado (24/11/2026; `created_older_than`);
 * - "Quantidade de Vendas": sem vendas, faixas (1 a 4 … 5.000 a 9.999) ou personalizado de/até, pelo total vendido do
 *   anúncio no Mercado Livre (25/11/2026; `sales`).
 * Cada filtro só vale depois de clicar em Aplicar (25/11/2026).
 */
const session = useSessionStore()
const tab = ref<'todos' | 'catalogo' | 'tradicional'>('todos')
const TABS = [{ value: 'todos', label: 'Todos' }, { value: 'catalogo', label: 'Catálogo' }, { value: 'tradicional', label: 'Tradicional' }] as const

const CREATED_OPTIONS = [
  { value: '', label: 'Qualquer data' },
  { value: '30', label: '30 dias' },
  { value: '60', label: '60 dias' },
  { value: '90', label: '90 dias' },
  { value: '180', label: '180 dias' },
  { value: '365', label: '365 dias' },
  { value: 'custom', label: 'Personalizado' }
] as const
// Faixas de vendas (revisto em 25/11/2026): Sem vendas, 1 a 4, 5 a 9, 10 a 24, 25 a 49, 50 a 99, 100 a 499, 500 a 999,
// 1.000 a 4.999, 5.000 a 9.999 e Personalizado (de/até). Valor para a API: "none" ou "A-B".
const fmt = (n: number) => n.toLocaleString('pt-BR')
const SALES_RANGES: [number, number][] = [[1, 4], [5, 9], [10, 24], [25, 49], [50, 99], [100, 499], [500, 999], [1000, 4999], [5000, 9999]]
const SALES_OPTIONS = [
  { value: '', label: 'Qualquer quantidade' },
  { value: 'none', label: 'Sem vendas' },
  ...SALES_RANGES.map(([a, b]) => ({ value: `${a}-${b}`, label: `${fmt(a)} a ${fmt(b)} vendas` })),
  { value: 'custom', label: 'Personalizado' }
]

const created = ref<string | null>(null)
const sales = ref<string | null>(null)
const createdOlderThan = computed(() => (created.value ? Number(created.value) : null))

const createdSummary = (v: string) => `criados há mais de ${fmt(Number(v))} dias`
function salesSummary(v: string) {
  if (v === 'none') return 'sem nenhuma venda'
  const [a, b] = v.split('-')
  return b ? `de ${fmt(Number(a))} a ${fmt(Number(b))} vendas` : `${fmt(Number(a))} vendas ou mais`
}
</script>

<template>
  <EmptyAccountState v-if="!session.selectedAccount" />
  <div v-else class="page space-y-6">
    <PageHeader />

    <div class="space-y-2">
      <ListingFilterSelect
        v-model="created" input-id="criados-ha" label="Anúncios criados há mais de" :options="CREATED_OPTIONS"
        custom-unit="dias" custom-placeholder="ex.: 45" :max-digits="5" :max-value="36500" :summary="createdSummary" test-id="filtro-criacao"
      >
        <template #icon><CalendarDaysIcon class="h-5 w-5 text-ink-3" aria-hidden="true" /></template>
      </ListingFilterSelect>
      <ListingFilterSelect
        v-model="sales" input-id="quantidade-vendas" label="Quantidade de Vendas" :options="SALES_OPTIONS"
        custom-unit="vendas" custom-placeholder="ex.: 15" custom-range :max-digits="7" :summary="salesSummary" test-id="filtro-vendas"
      >
        <template #icon><ShoppingCartIcon class="h-5 w-5 text-ink-3" aria-hidden="true" /></template>
      </ListingFilterSelect>
    </div>

    <div class="flex gap-1 border-b border-line" role="tablist" aria-label="Abas de anúncios">
      <button
        v-for="t in TABS" :key="t.value"
        type="button" role="tab" :aria-selected="tab === t.value"
        class="-mb-px border-b-2 px-4 py-2 text-[14px] font-medium"
        :class="tab === t.value ? 'border-primary text-primary' : 'border-transparent text-ink-2 hover:text-ink'"
        :data-test="`aba-${t.value}`"
        @click="tab = t.value"
      >{{ t.label }}</button>
    </div>
    <ItemsTable v-show="tab === 'todos'" :created-older-than="createdOlderThan" :sales="sales" />
    <CatalogTable v-if="tab === 'catalogo'" :created-older-than="createdOlderThan" :sales="sales" />
    <ItemsTable v-if="tab === 'tradicional'" kind="traditional" :created-older-than="createdOlderThan" :sales="sales" />
  </div>
</template>
