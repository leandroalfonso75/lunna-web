<script setup lang="ts">
import EmptyAccountState from '../components/painel/EmptyAccountState.vue'
import ItemsTable from '../components/painel/ItemsTable.vue'
import PageHeader from '../components/painel/PageHeader.vue'
import { useSessionStore } from '../stores/session'

/**
 * `/anuncios` (SPEC §7.7): tabela completa de anúncios com filtros. Toda a
 * lógica (composable, polling, cabeçalho) vive em `ItemsTable.vue`; esta
 * página só decide entre o estado vazio (sem conta) e o conteúdo.
 */
const session = useSessionStore()
</script>

<template>
  <EmptyAccountState v-if="!session.selectedAccount" />
  <div v-else class="page space-y-6">
    <PageHeader />
    <ItemsTable />
  </div>
</template>
