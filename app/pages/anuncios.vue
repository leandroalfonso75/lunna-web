<script setup lang="ts">
import { ref } from 'vue'
import CatalogTable from '../components/painel/CatalogTable.vue'
import EmptyAccountState from '../components/painel/EmptyAccountState.vue'
import ItemsTable from '../components/painel/ItemsTable.vue'
import PageHeader from '../components/painel/PageHeader.vue'
import { useSessionStore } from '../stores/session'

/**
 * `/anuncios` (SPEC §7.7): tabela completa de anúncios com filtros (`ItemsTable.vue`, dona do cabeçalho) e a aba
 * Catálogo (pedido do usuário em 08/11/2026): anúncios de catálogo, sincronização com tradicional e ganhando/perdendo.
 */
const session = useSessionStore()
const tab = ref<'todos' | 'catalogo'>('todos')
const TABS = [{ value: 'todos', label: 'Todos' }, { value: 'catalogo', label: 'Catálogo' }] as const
</script>

<template>
  <EmptyAccountState v-if="!session.selectedAccount" />
  <div v-else class="page space-y-6">
    <PageHeader />
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
    <ItemsTable v-show="tab === 'todos'" />
    <CatalogTable v-if="tab === 'catalogo'" />
  </div>
</template>
