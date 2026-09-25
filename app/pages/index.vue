<script setup lang="ts">
import { onBeforeUnmount, onMounted, watchEffect } from 'vue'
import AlertsList from '../components/painel/AlertsList.vue'
import DailyChart from '../components/painel/DailyChart.vue'
import EmptyAccountState from '../components/painel/EmptyAccountState.vue'
import KpiCards from '../components/painel/KpiCards.vue'
import PageHeader from '../components/painel/PageHeader.vue'
import RecentSalesList from '../components/painel/RecentSalesList.vue'
import TopSellersList from '../components/painel/TopSellersList.vue'
import { usePageHeader } from '../composables/usePageHeader'
import { usePainel } from '../composables/usePainel'
import { useSessionStore } from '../stores/session'

/**
 * Visão geral (SPEC §7.1–7.6): cabeçalho, KPIs, gráfico de 15 dias e as
 * três listas. Toda a métrica/estado já vem pronta de `usePainel()`
 * (`GET /api/painel`) — esta página só monta o layout.
 */
const session = useSessionStore()
const { painel, stale, loadError, start, stop, refreshNow, refreshing } = usePainel()
const header = usePageHeader()

/** "AAAA-MM-DD" -> "DD/MM", sem passar por fuso (mesmo cuidado do gráfico). */
function shortDate(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

watchEffect(() => {
  header.state.title = 'Visão geral'
  header.state.subtitle = painel.value ? `Mercado Livre · ${painel.value.account.nickname}` : 'Mercado Livre'
  header.state.sync = painel.value?.sync ?? null
  header.state.generatedAt = painel.value?.generated_at ?? null
  header.state.refreshing = refreshing.value
  header.state.onRefresh = refreshNow
})

// `load()` já ignora a chamada sem conta selecionada — sempre iniciar aqui
// evita depender de remontar a página para pegar a 1ª conta conectada.
onMounted(start)
onBeforeUnmount(stop)
</script>

<template>
  <EmptyAccountState v-if="!session.selectedAccount" />

  <div v-else class="page space-y-6">
    <PageHeader />

    <p v-if="stale" role="status" class="rounded-card border border-warning bg-warning-soft px-3 py-2 text-[13px] text-warning">
      Não foi possível atualizar agora — mostrando os últimos dados.
    </p>

    <div v-if="loadError" class="card p-6 text-center" role="alert">
      <p class="text-[15px] text-danger">{{ loadError }}</p>
      <button type="button" class="btn-link mt-3" @click="refreshNow">Tentar de novo</button>
    </div>

    <template v-else-if="!painel">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <div v-for="i in 6" :key="i" class="card h-24 animate-pulse bg-surface-2" />
      </div>
      <div class="card h-40 animate-pulse bg-surface-2" />
    </template>

    <template v-else>
      <div class="flex flex-wrap gap-3 text-[13px] text-ink-2">
        <span class="pill-neutral">{{ painel.summary.total }} anúncios</span>
        <span class="pill-neutral">{{ painel.summary.active }} ativos</span>
        <span class="pill-neutral">{{ painel.summary.paused }} pausados</span>
        <span class="pill-neutral">{{ painel.summary.closed }} finalizados</span>
        <span class="pill-neutral">{{ painel.summary.under_review }} em revisão</span>
        <span class="text-ink-3">
          Semana {{ shortDate(painel.period.week.from) }}–{{ shortDate(painel.period.week.to) }} vs.
          {{ shortDate(painel.period.prev_week.from) }}–{{ shortDate(painel.period.prev_week.to) }}
        </span>
      </div>

      <KpiCards :kpis="painel.kpis" />

      <DailyChart :daily="painel.daily" :scale="painel.daily_scale" />

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TopSellersList :items="painel.top_sellers" />
        <AlertsList :alerts="painel.alerts" />
        <RecentSalesList :sales="painel.recent_sales" />
      </div>
    </template>
  </div>
</template>
