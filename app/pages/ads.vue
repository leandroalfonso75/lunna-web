<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watchEffect } from 'vue'
import NvNotice from '../components/nv/NvNotice.vue'
import NvPeriod from '../components/nv/NvPeriod.vue'
import NvTabs from '../components/nv/NvTabs.vue'
import { useLayoutPref } from '../composables/useLayoutPref'
import AdsAnalysisPanel from '../components/ads/AdsAnalysisPanel.vue'
import AdsItemsTable from '../components/ads/AdsItemsTable.vue'
import AdsSummary from '../components/ads/AdsSummary.vue'
import CampaignsTable from '../components/ads/CampaignsTable.vue'
import EmptyAccountState from '../components/painel/EmptyAccountState.vue'
import PageHeader from '../components/painel/PageHeader.vue'
import { useAds } from '../composables/useAds'
import { usePageHeader } from '../composables/usePageHeader'
import { dateTimeShort, int } from '../lib/format'
import { useSessionStore } from '../stores/session'

/**
 * `/ads`: campanhas e anúncios de publicidade (Product Ads) do Mercado Livre dos últimos 3 meses —
 * investimento, vendas por Ads, ACOS, ROAS, cliques e conversão, por período, campanha e anúncio.
 * A conta (ACOS, ROAS, totais, sinais) é toda da API (`GET /api/ads`).
 */
const session = useSessionStore()
const ads = useAds()
const { range, tab, overview, itemsResponse, itemsLoading, loading, loadError, stale, syncing, syncMessage, filters, analysis, analysisLoading, analysisError, diagnosis, diagnosisLoading, diagnosisError } = ads

const header = usePageHeader()
watchEffect(() => {
  header.state.title = 'Ads'
  header.state.subtitle = session.selectedAccount ? `Mercado Livre · ${session.selectedAccount.nickname}` : 'Mercado Livre'
  header.state.sync = null
  header.state.generatedAt = null
  header.state.refreshing = ads.refreshing.value
  header.state.onRefresh = ads.refreshNow
})

onMounted(ads.start)
onBeforeUnmount(ads.stop)

const PERIODS = [
  { value: 'today', label: 'Hoje' }, { value: 'yesterday', label: 'Ontem' },
  { value: '7d', label: '7 dias' }, { value: 'mtd', label: 'Mês até hoje' }, { value: '30d', label: '30 dias' },
  { value: '60d', label: '60 dias' }, { value: '90d', label: '3 meses' }
]

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

function onDate(which: 'from' | 'to', event: Event) {
  const value = (event.target as HTMLInputElement).value
  ads.setCustomRange(which === 'from' ? value : range.from, which === 'to' ? value : range.to)
}

/** Layout novo (27/11/2026): período numa linha, guias com contador e explicação (a Análise, que pede ação, primeiro). */
const layoutPref = useLayoutPref()
const isNew = computed(() => layoutPref.pref.value === 'novo')
const newTabs = computed(() => [
  { key: 'analise', label: 'Análise e ações', count: analysis.value?.queue.length ?? null, alert: true,
    hint: 'O que fazer nos Ads agora: saúde da conta, fila de ações por valor em jogo e as ações feitas que chegaram na hora de revisar. Só recomenda; nada muda sozinho.' },
  { key: 'campanhas', label: 'Campanhas', count: overview.value?.campaigns.length ?? null, hint: 'Cada campanha com investimento, vendas, ACOS e ROAS do período. "Ver anúncios" abre os anúncios dela.' },
  { key: 'anuncios', label: 'Anúncios', count: overview.value?.sync.ads ?? null, hint: 'Cada anúncio em Ads, com busca e filtros por campanha e situação.' }
])
const dueReviews = computed(() => analysis.value?.history?.filter((h) => h.due).length ?? 0)
function onPeriod(value: string) {
  ads.setPeriod(value)
}
function onRange(which: 'from' | 'to', value: string) {
  ads.setCustomRange(which === 'from' ? value : range.from, which === 'to' ? value : range.to)
}

const TABS = [
  { value: 'campanhas' as const, label: 'Campanhas' },
  { value: 'anuncios' as const, label: 'Anúncios' },
  { value: 'analise' as const, label: 'Análise' }
]
</script>

<template>
  <EmptyAccountState v-if="!session.selectedAccount" />
  <div v-else class="page space-y-5">
    <PageHeader>
      <template v-if="isNew && session.isAdmin" #actions>
        <button type="button" class="btn-secondary" :disabled="syncing" data-test="atualizar-ml" @click="ads.syncNow">{{ syncing ? 'Pedindo…' : 'Atualizar do Mercado Livre' }}</button>
      </template>
    </PageHeader>

    <template v-if="isNew">
      <NvPeriod :periods="PERIODS" :period="range.period" :from="range.from" :to="range.to" @period="onPeriod" @range="onRange">
        <span v-if="overview?.sync.recent_sync_at || overview?.sync.last_sync_at" class="text-[13px] text-ink-3">Lidos do ML em {{ dateTimeShort(overview.sync.recent_sync_at ?? overview.sync.last_sync_at) }}</span>
      </NvPeriod>
      <NvNotice v-if="syncMessage">{{ syncMessage }}</NvNotice>
      <NvNotice v-if="stale" tone="warning">Não foi possível atualizar agora — mostrando os últimos dados.</NvNotice>
    </template>
    <div v-else class="flex flex-wrap items-center gap-2" role="group" aria-label="Período">
      <button
        v-for="p in PERIODS"
        :key="p.value"
        type="button"
        class="rounded-full border px-3 py-1 text-[13px]"
        :class="range.period === p.value ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink-2 hover:bg-surface-2'"
        :aria-pressed="range.period === p.value"
        @click="ads.setPeriod(p.value)"
      >{{ p.label }}</button>
      <span class="mx-1 text-[12px] text-ink-3">ou</span>
      <input type="date" class="input h-8 w-auto text-[13px]" :class="range.period === 'custom' ? 'border-primary' : ''" :value="range.from" :max="today" aria-label="Data inicial" @change="onDate('from', $event)" />
      <span class="text-[12px] text-ink-3">até</span>
      <input type="date" class="input h-8 w-auto text-[13px]" :class="range.period === 'custom' ? 'border-primary' : ''" :value="range.to" :max="today" aria-label="Data final" @change="onDate('to', $event)" />
      <span v-if="overview?.sync.recent_sync_at || overview?.sync.last_sync_at" class="ml-2 text-[12px] text-ink-3">
        Dados do Mercado Livre lidos em {{ dateTimeShort(overview.sync.recent_sync_at ?? overview.sync.last_sync_at) }}
      </span>
      <button v-if="session.isAdmin" type="button" class="btn-link ml-auto text-[13px]" :disabled="syncing" @click="ads.syncNow">
        {{ syncing ? 'Pedindo…' : 'Atualizar do Mercado Livre agora' }}
      </button>
    </div>
    <p v-if="syncMessage && !isNew" class="text-[13px] text-ink-2" role="status">{{ syncMessage }}</p>
    <p v-if="stale && !isNew" role="status" class="rounded-card border border-warning bg-warning-soft px-3 py-2 text-[13px] text-warning">
      Não foi possível atualizar agora — mostrando os últimos dados.
    </p>

    <div v-if="loadError" class="card p-6 text-center" role="alert">
      <p class="text-[15px] text-danger">{{ loadError }}</p>
      <button type="button" class="btn-link mt-3" @click="ads.refreshNow">Tentar de novo</button>
    </div>

    <template v-else>
      <AdsSummary v-if="overview" :summary="overview.summary" :previous="overview.previous" :daily="overview.daily" />
      <div v-else-if="loading" class="h-24 animate-pulse rounded-card bg-surface-2" />

      <p v-if="overview && overview.sync.campaigns === 0" class="card p-6 text-center text-ink-2">
        Ainda não há campanhas lidas para esta conta. {{ session.isAdmin ? 'Use "Atualizar do Mercado Livre agora".' : 'Peça a um administrador para atualizar.' }}
      </p>

      <template v-if="isNew">
        <NvTabs :tabs="newTabs" :model-value="tab" label="Guias de Ads" @update:model-value="(v) => (tab = v as typeof tab)" />
        <p v-if="dueReviews" class="-mt-1 px-1 text-[13px] font-semibold text-primary">{{ dueReviews }} {{ dueReviews === 1 ? 'ação feita chegou' : 'ações feitas chegaram' }} na hora de revisar (em Análise e ações).</p>
      </template>
      <div v-else class="flex gap-1 border-b border-line" role="tablist">
        <button
          v-for="t in TABS"
          :key="t.value"
          type="button"
          role="tab"
          :aria-selected="tab === t.value"
          class="-mb-px border-b-2 px-4 py-2 text-[14px]"
          :class="tab === t.value ? 'border-primary font-semibold text-primary' : 'border-transparent text-ink-2 hover:text-ink'"
          @click="tab = t.value"
        >
          {{ t.label }}
          <span v-if="t.value !== 'analise'" class="ml-1 text-[12px] text-ink-3">{{ t.value === 'campanhas' ? int(overview?.campaigns.length ?? 0) : int(overview?.sync.ads ?? 0) }}</span>
          <span v-else-if="analysis?.queue.length" class="ml-1 rounded-full bg-danger-soft px-1.5 text-[11px] font-semibold text-danger">{{ analysis.queue.length }} ações</span>
          <span v-if="t.value === 'analise' && analysis?.history?.some((h) => h.due)" class="ml-1 rounded-full bg-primary-soft px-1.5 text-[11px] font-semibold text-primary">{{ analysis.history.filter((h) => h.due).length }} para revisar</span>
        </button>
      </div>

      <p v-if="range.period === 'custom' && (!range.from || !range.to)" class="text-[13px] text-ink-3">Escolha a data inicial e a final para ver o período.</p>
      <CampaignsTable v-if="tab === 'campanhas' && overview" :campaigns="overview.campaigns" @show-items="ads.showCampaignItems" />
      <AdsAnalysisPanel v-if="tab === 'analise'" :data="analysis" :loading="analysisLoading" :error="analysisError" :is-admin="session.isAdmin"
        :diagnosis="diagnosis" :diagnosis-loading="diagnosisLoading" :diagnosis-error="diagnosisError"
        @diagnose="ads.diagnose" @decide="ads.decide" @review="ads.review" @undecide="ads.undecide" @refresh="ads.loadAnalysis" />
      <p v-if="tab === 'anuncios' && itemsResponse?.live_error" role="status" class="rounded-card border border-warning bg-warning-soft px-3 py-2 text-[13px] text-warning">
        Não foi possível consultar os números dos anúncios deste período no Mercado Livre agora. Tente de novo em instantes.
      </p>
      <AdsItemsTable
        v-else-if="tab === 'anuncios'"
        :response="itemsResponse"
        :loading="itemsLoading"
        :filters="filters"
        :campaigns="overview?.campaigns ?? []"
        @change="ads.changeFilters"
        @sort="ads.sortBy"
        @page="ads.setPage"
      />
    </template>
  </div>
</template>
