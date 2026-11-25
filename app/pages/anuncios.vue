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
 * Acima das abas, cumulativos e valendo para as duas (aplicados na API):
 * - "Anúncios criados há mais de" 30, 60, 90, 180, 365 dias ou personalizado (24/11/2026; `created_older_than`);
 * - "Quantidade de Vendas": sem vendas, +5, +10, +25, +50, +100, +500, +1000, +5000 ou personalizado, pelo total vendido
 *   do anúncio no Mercado Livre (25/11/2026; `sales`).
 */
const session = useSessionStore()
const tab = ref<'todos' | 'catalogo'>('todos')
const TABS = [{ value: 'todos', label: 'Todos' }, { value: 'catalogo', label: 'Catálogo' }] as const

const CREATED_OPTIONS = [
  { value: '', label: 'Qualquer data' },
  { value: '30', label: '30 dias' },
  { value: '60', label: '60 dias' },
  { value: '90', label: '90 dias' },
  { value: '180', label: '180 dias' },
  { value: '365', label: '365 dias' },
  { value: 'custom', label: 'Personalizado' }
] as const
const SALES_OPTIONS = [
  { value: '', label: 'Qualquer quantidade' },
  { value: 'none', label: 'Sem vendas' },
  ...[5, 10, 25, 50, 100, 500, 1000, 5000].map((n) => ({ value: String(n), label: `+${n.toLocaleString('pt-BR')} vendas` })),
  { value: 'custom', label: 'Personalizado' }
] as const

const created = ref<string | null>(null)
const sales = ref<string | null>(null)
const createdOlderThan = computed(() => (created.value ? Number(created.value) : null))

const createdSummary = (v: string) => `criados há mais de ${v} dias`
const salesSummary = (v: string) => (v === 'none' ? 'sem nenhuma venda' : `com ${Number(v).toLocaleString('pt-BR')} vendas ou mais`)
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
        custom-unit="vendas ou mais" custom-placeholder="ex.: 15" :max-digits="7" :summary="salesSummary" test-id="filtro-vendas"
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
  </div>
</template>
