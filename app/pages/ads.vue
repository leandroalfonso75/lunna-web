<script setup lang="ts">
import { onBeforeUnmount, onMounted, watchEffect } from 'vue'
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
const { range, tab, overview, itemsResponse, itemsLoading, loading, loadError, stale, syncing, syncMessage, filters } = ads

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

const TABS = [
  { value: 'campanhas' as const, label: 'Campanhas' },
  { value: 'anuncios' as const, label: 'Anúncios' }
]
</script>

<template>
  <EmptyAccountState v-if="!session.selectedAccount" />
  <div v-else class="page space-y-5">
    <PageHeader />

    <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Período">
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
    <p v-if="syncMessage" class="text-[13px] text-ink-2" role="status">{{ syncMessage }}</p>
    <p v-if="stale" role="status" class="rounded-card border border-warning bg-warning-soft px-3 py-2 text-[13px] text-warning">
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

      <div class="flex gap-1 border-b border-line" role="tablist">
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
          <span class="ml-1 text-[12px] text-ink-3">{{ t.value === 'campanhas' ? int(overview?.campaigns.length ?? 0) : int(overview?.sync.ads ?? 0) }}</span>
        </button>
      </div>

      <p v-if="range.period === 'custom' && (!range.from || !range.to)" class="text-[13px] text-ink-3">Escolha a data inicial e a final para ver o período.</p>
      <CampaignsTable v-if="tab === 'campanhas' && overview" :campaigns="overview.campaigns" @show-items="ads.showCampaignItems" />
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
