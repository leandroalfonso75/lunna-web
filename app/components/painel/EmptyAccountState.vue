<script setup lang="ts">
import { useSessionStore } from '../../stores/session'

/**
 * Estado vazio (sem conta ML selecionada) do W1, extraído para reuso — as
 * três páginas do painel (`/`, `/anuncios`, `/curva-abc`) mostram exatamente
 * isto quando `!session.selectedAccount` (linha 30 do prompt W2).
 */
const session = useSessionStore()
</script>

<template>
  <div class="page">
    <div class="empty-state">
      <h1 class="section-title">Conecte uma conta do Mercado Livre</h1>
      <p class="text-[15px] text-ink-2">
        O painel mostra os anúncios e métricas de uma conta do Mercado Livre por vez.
      </p>
      <NuxtLink v-if="session.isAdmin" to="/configuracoes?aba=contas" class="btn-primary mt-2">
        Conectar conta do Mercado Livre
      </NuxtLink>
      <p v-else class="text-[15px] text-ink-2">Peça a um administrador para conectar uma conta.</p>
    </div>
  </div>
</template>
