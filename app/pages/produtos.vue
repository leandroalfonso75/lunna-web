<script setup lang="ts">
import { watchEffect } from 'vue'
import { usePageHeader } from '../composables/usePageHeader'

/**
 * `/produtos`: cadastro de produtos — por enquanto só a rota no menu lateral,
 * sem conteúdo. Escreve o título no usePageHeader() para a barra compacta do
 * layout (< 1024px) não ficar com o título da última página visitada.
 */
const header = usePageHeader()
watchEffect(() => {
  header.state.title = 'Produtos'
  header.state.subtitle = ''
  header.state.sync = null
  header.state.generatedAt = null
  header.state.refreshing = false
  header.state.onRefresh = null
})
</script>

<template>
  <div class="page" />
</template>
