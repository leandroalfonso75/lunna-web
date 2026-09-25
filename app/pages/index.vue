<script setup lang="ts">
import { useSessionStore } from '../stores/session'

/**
 * Placeholder deste bloco (W1): sem conta ML, estado vazio convidando a
 * conectar uma (admin) ou avisando que só um admin pode (member). Com conta,
 * um cartão simples — o painel de verdade (curva ABC, métricas, IA) é outro
 * bloco; esta página fica enxuta de propósito.
 */
const session = useSessionStore()
</script>

<template>
  <div class="page">
    <div v-if="!session.selectedAccount" class="empty-state">
      <h1 class="section-title">Conecte uma conta do Mercado Livre</h1>
      <p class="text-[15px] text-ink-2">
        O painel mostra os anúncios e métricas de uma conta do Mercado Livre por vez.
      </p>
      <NuxtLink v-if="session.isAdmin" to="/configuracoes?aba=contas" class="btn-primary mt-2">
        Conectar conta do Mercado Livre
      </NuxtLink>
      <p v-else class="text-[15px] text-ink-2">Peça a um administrador para conectar uma conta.</p>
    </div>

    <div v-else class="card p-6">
      <h1 class="page-title">Painel de {{ session.selectedAccount.nickname }}</h1>
    </div>
  </div>
</template>
