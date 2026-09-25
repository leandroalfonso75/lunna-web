<script setup lang="ts">
import AbcTable from '../components/abc/AbcTable.vue'
import EmptyAccountState from '../components/painel/EmptyAccountState.vue'
import PageHeader from '../components/painel/PageHeader.vue'
import { useSessionStore } from '../stores/session'

/**
 * `/curva-abc` (SPEC §8): resumo, abas por curva, tabela e detalhe com
 * plano de IA. Toda a lógica vive em `AbcTable.vue`/`AbcDetail.vue`; esta
 * página só decide entre o estado vazio (sem conta) e o conteúdo.
 */
const session = useSessionStore()
</script>

<template>
  <EmptyAccountState v-if="!session.selectedAccount" />
  <div v-else class="page space-y-6">
    <PageHeader />
    <AbcTable />
  </div>
</template>
