<script setup lang="ts">
import PromocoesClassico from '../components/promocoes/PromocoesClassico.vue'
import PromocoesNovo from '../components/promocoes/novo/PromocoesNovo.vue'
import { useLayoutPref } from '../composables/useLayoutPref'

/**
 * `/promocoes`: no layout novo (27/11/2026) a seção foi reorganizada por tarefa (`PromocoesNovo`); no layout atual
 * continua exatamente como era (`PromocoesClassico`). As duas usam o mesmo `usePromotions` e as mesmas regras da API.
 */
const layoutPref = useLayoutPref()
</script>

<template>
  <PromocoesNovo v-if="layoutPref.pref.value === 'novo'" />
  <PromocoesClassico v-else />
</template>
