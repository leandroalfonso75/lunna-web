<script setup lang="ts">
import {
  BanknotesIcon, ChartPieIcon, CurrencyDollarIcon, MegaphoneIcon, ReceiptPercentIcon, ShoppingCartIcon, SparklesIcon, SunIcon
} from '@heroicons/vue/24/outline'
import { computed, onMounted, ref } from 'vue'
import AttentionStrip from './AttentionStrip.vue'
import BarChart from './BarChart.vue'
import KpiTile from './KpiTile.vue'
import MoneyFlow from './MoneyFlow.vue'
import TrendChart from './TrendChart.vue'
import { useDashboard } from '../../composables/useDashboard'
import { attentionItems, delta, deltaPp, greeting, moneyFlow, type DashPeriod } from '../../lib/dashboard'
import { brl, int, pct } from '../../lib/format'
import { useSessionStore } from '../../stores/session'
import type { PainelResponse } from '../../types/painel'

/**
 * Visão geral do novo layout (27/11/2026). Ordem pensada para a rotina do dia:
 * 1) o que precisa de atenção agora (atalhos para resolver);
 * 2) como está o negócio no período, contra o período anterior (cartões com variação e tendência);
 * 3) por quê: faturamento e lucro por dia, e para onde vai cada R$ 100 vendido;
 * 4) Ads, mais vendidos e últimas vendas.
 * Todos os números vêm da API (as mesmas contas das seções Vendas, Ads e Promoções).
 */
const props = defineProps<{ painel: PainelResponse | null; refreshing?: boolean }>()

const session = useSessionStore()
const dash = useDashboard()
onMounted(() => void dash.load())

const PERIODS: { key: DashPeriod; label: string }[] = [{ key: '7d', label: '7 dias' }, { key: '30d', label: '30 dias' }]
const compare = ref(true)

const cur = computed(() => dash.current.value?.summary ?? null)
const prev = computed(() => dash.previous.value?.summary ?? null)
const ads = computed(() => dash.adsData.value?.summary ?? null)
const adsPrev = computed(() => dash.adsData.value?.previous ?? null)
const loadingSales = computed(() => !cur.value && dash.loading.value)
const today = computed(() => props.painel?.kpis.find((k) => k.key === 'today') ?? null)
const tacos = computed(() => (ads.value && cur.value?.revenue ? (ads.value.cost / cur.value.revenue) * 100 : null))
const daily = computed(() => dash.current.value?.daily ?? [])
const prevDaily = computed(() => dash.previous.value?.daily ?? [])

const items = computed(() => attentionItems({ attention: dash.attention.value, promotions: dash.promotions.value, alerts: props.painel?.alerts ?? [] }))
const flow = computed(() => moneyFlow(cur.value as never))
const periodLabel = computed(() => (dash.period.value === '7d' ? 'últimos 7 dias completos' : 'últimos 30 dias completos'))
// horários relativos ("há 3 min") só depois de montar: o servidor e o navegador têm relógios diferentes
const mounted = ref(false)
onMounted(() => { mounted.value = true })

const trendSeries = computed(() => {
  const list = [
    { key: 'revenue', label: 'Faturamento', color: 'var(--chart-1)', values: daily.value.map((d) => d.revenue), area: true },
    { key: 'profit', label: 'Lucro antes de Ads', color: 'var(--chart-2)', values: daily.value.map((d) => d.net_profit ?? null) }
  ]
  if (compare.value && prevDaily.value.length) {
    const prevValues = prevDaily.value.map((d) => d.revenue)
    list.push({ key: 'prev', label: 'Faturamento no período anterior', color: 'var(--ink-3)', values: daily.value.map((_, i) => prevValues[i] ?? null), dashed: true } as never)
  }
  return list
})

const firstName = computed(() => (session.user?.name ?? '').split(' ')[0] || '')
const todayLabel = computed(() => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))
const relTime = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins} min`
  if (mins < 60 * 24) return `há ${Math.floor(mins / 60)} h`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
const topMax = computed(() => Math.max(1, ...(props.painel?.top_sellers ?? []).map((t) => t.units_week)))
</script>

<template>
  <div class="page-new space-y-5" data-test="visao-geral-nova">
    <!-- saudação + período + ação principal -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        <p class="eyebrow capitalize"><ClientOnly>{{ todayLabel }}</ClientOnly>&nbsp;</p>
        <h1 class="mt-1 text-[24px] font-semibold tracking-tight text-ink"><ClientOnly fallback="Olá">{{ greeting() }}</ClientOnly>{{ firstName ? `, ${firstName}` : '' }} 👋</h1>
        <p class="mt-1 text-[14px] text-ink-2">
          Resumo da conta <strong class="font-semibold text-ink">{{ painel?.account.nickname ?? session.selectedAccount?.nickname }}</strong>
          <template v-if="painel"> · {{ int(painel.summary.active) }} anúncios ativos · {{ int(painel.summary.paused) }} pausados<template v-if="painel.summary.under_review"> · {{ painel.summary.under_review }} em revisão</template></template>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="seg" role="group" aria-label="Período">
          <button v-for="p in PERIODS" :key="p.key" type="button" :class="dash.period.value === p.key ? 'seg-btn-active' : 'seg-btn'" :aria-pressed="dash.period.value === p.key" :data-test="`periodo-${p.key}`" @click="dash.setPeriod(p.key)">{{ p.label }}</button>
        </div>
        <NuxtLink to="/produtos/ia/novo" class="nbtn-primary nbtn-lg" data-test="acao-principal"><SparklesIcon class="h-5 w-5" aria-hidden="true" /> Criar Produto com IA</NuxtLink>
      </div>
    </div>

    <AttentionStrip :items="items" :loading="dash.loading.value" />

    <!-- indicadores -->
    <section class="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6" aria-label="Indicadores do período">
      <KpiTile label="Hoje até agora" :value="today?.value !== null && today?.value !== undefined ? brl(today.value) : '—'" :hint="today?.sub_label" :icon="SunIcon" to="/vendas?period=today" :loading="!painel" />
      <KpiTile label="Faturamento" :value="brl(cur?.revenue)" :delta="delta(cur?.revenue, prev?.revenue)" hint="vs. período anterior" :spark="daily.map((d) => d.revenue)" :icon="BanknotesIcon" to="/vendas" :loading="loadingSales" />
      <KpiTile label="Pedidos" :value="int(cur?.orders)" :delta="delta(cur?.orders, prev?.orders)" :hint="cur ? `${int(cur.units)} unidades` : null" :spark="daily.map((d) => d.orders)" :icon="ShoppingCartIcon" to="/vendas" :loading="loadingSales" />
      <KpiTile label="Ticket médio" :value="brl(cur?.ticket)" :delta="delta(cur?.ticket, prev?.ticket)" hint="por pedido" :icon="ReceiptPercentIcon" :loading="loadingSales" />
      <KpiTile label="Lucro pós Ads" :value="brl(cur?.net_profit_after_ads)" :delta="delta(cur?.net_profit_after_ads, prev?.net_profit_after_ads)" :hint="cur ? `margem ${pct(cur.net_profit_after_ads_pct)}` : null" :spark="daily.map((d) => d.net_profit ?? 0)" :icon="CurrencyDollarIcon" to="/financeiro" :loading="loadingSales" />
      <KpiTile label="Investimento em Ads" :value="brl(ads?.cost)" :delta="delta(ads?.cost, adsPrev?.cost, false)" :hint="ads ? `ROAS ${ads.roas?.toLocaleString('pt-BR') ?? '—'} · TACOS ${pct(tacos)}` : null" :spark="(dash.adsData.value?.daily ?? []).map((d) => d.cost)" :icon="MegaphoneIcon" to="/ads" :loading="!ads && dash.loading.value" />
    </section>

    <!-- tendência + composição -->
    <section class="grid gap-5 xl:grid-cols-3">
      <div class="panel xl:col-span-2">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Faturamento e lucro por dia</h2>
            <p class="panel-sub">{{ periodLabel }} · passe o mouse para ver cada dia</p>
          </div>
          <label class="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
            <input v-model="compare" type="checkbox" class="h-4 w-4 accent-[var(--primary)]" data-test="comparar" /> Comparar com o período anterior
          </label>
        </div>
        <div class="px-5 pb-4 pt-2">
          <div v-if="loadingSales" class="h-[260px] animate-pulse rounded-card bg-surface-2" />
          <TrendChart v-else-if="daily.length" :labels="daily.map((d) => d.date)" :series="trendSeries" :format="brl" caption="Faturamento e lucro antes de Ads por dia" />
          <p v-else class="py-16 text-center text-[14px] text-ink-3">Sem vendas no período.</p>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Para onde vai cada R$ 100 vendido</h2>
            <p class="panel-sub">{{ periodLabel }} · faturamento {{ brl(cur?.revenue) }}</p>
          </div>
          <ChartPieIcon class="h-5 w-5 text-ink-3" aria-hidden="true" />
        </div>
        <div class="px-5 pb-5 pt-3">
          <div v-if="loadingSales" class="space-y-3"><div v-for="i in 7" :key="i" class="h-6 animate-pulse rounded bg-surface-2" /></div>
          <MoneyFlow v-else-if="flow.length" :rows="flow" :revenue="cur?.revenue ?? 0" />
          <p v-else class="py-10 text-center text-[14px] text-ink-3">Sem vendas no período.</p>
        </div>
      </div>
    </section>

    <!-- Ads, mais vendidos, últimas vendas -->
    <section class="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
      <div class="panel flex flex-col">
        <div class="panel-head">
          <div><h2 class="panel-title">Ads</h2><p class="panel-sub">Investimento por dia · {{ periodLabel }}</p></div>
          <NuxtLink to="/ads" class="btn-link">Ver Ads</NuxtLink>
        </div>
        <dl class="grid grid-cols-4 gap-2 px-5 pt-3 text-center">
          <div><dt class="text-[12px] text-ink-3">Investido</dt><dd class="text-[15px] font-semibold text-ink" data-numeric>{{ brl(ads?.cost) }}</dd></div>
          <div><dt class="text-[12px] text-ink-3">ROAS</dt><dd class="text-[15px] font-semibold text-ink" data-numeric>{{ ads?.roas?.toLocaleString('pt-BR') ?? '—' }}</dd></div>
          <div><dt class="text-[12px] text-ink-3">ACOS</dt><dd class="text-[15px] font-semibold text-ink" data-numeric>{{ pct(ads?.acos) }}</dd></div>
          <div><dt class="text-[12px] text-ink-3" title="Investimento em Ads ÷ faturamento total">TACOS</dt><dd class="text-[15px] font-semibold text-ink" data-numeric>{{ pct(tacos) }}</dd></div>
        </dl>
        <div class="flex-1 px-5 pb-4 pt-4">
          <div v-if="!dash.adsData.value && dash.loading.value" class="h-[230px] animate-pulse rounded-card bg-surface-2" />
          <BarChart v-else-if="dash.adsData.value?.daily.length" :labels="dash.adsData.value.daily.map((d) => d.date)" :values="dash.adsData.value.daily.map((d) => d.cost)" :format="brl" :height="230" caption="Investimento em Ads por dia" />
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <div><h2 class="panel-title">Mais vendidos</h2><p class="panel-sub">Unidades nos últimos 7 dias</p></div>
          <NuxtLink to="/anuncios" class="btn-link">Ver anúncios</NuxtLink>
        </div>
        <ol class="space-y-3 px-5 pb-5 pt-3">
          <li v-for="(t, i) in (painel?.top_sellers ?? []).slice(0, 6)" :key="t.id" class="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
            <span class="text-[13px] font-semibold text-ink-3">{{ i + 1 }}</span>
            <span class="truncate text-[14px] text-ink" :title="t.title">{{ t.title }}</span>
            <span class="text-right text-[14px] font-semibold text-ink" data-numeric>{{ int(t.units_week) }} un.
              <span v-if="t.units_prev_week" class="ml-1 text-[12px] font-medium" :class="t.units_week >= t.units_prev_week ? 'text-success' : 'text-danger'">{{ t.units_week >= t.units_prev_week ? '▲' : '▼' }} {{ int(Math.abs(t.units_week - t.units_prev_week)) }}</span>
            </span>
            <div class="col-start-2 col-end-4 h-1.5 overflow-hidden rounded-full bg-surface-2"><div class="h-full rounded-full bg-chart-1" :style="{ width: `${(t.units_week / topMax) * 100}%` }" /></div>
          </li>
          <li v-if="!painel" class="space-y-3"><div v-for="i in 5" :key="i" class="h-6 animate-pulse rounded bg-surface-2" /></li>
        </ol>
      </div>

      <div class="panel">
        <div class="panel-head">
          <div><h2 class="panel-title">Últimas vendas</h2><p class="panel-sub">Em tempo real</p></div>
          <NuxtLink to="/vendas" class="btn-link">Ver vendas</NuxtLink>
        </div>
        <ul class="divide-y divide-line px-5 pb-3 pt-1">
          <li v-for="s in (painel?.recent_sales ?? []).slice(0, 7)" :key="`${s.at}-${s.item_id}`" class="flex items-center gap-3 py-2.5">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"><ShoppingCartIcon class="h-4 w-4" aria-hidden="true" /></span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[14px] text-ink" :title="s.title">{{ s.title }}</span>
              <span class="text-[12px] text-ink-3"><template v-if="mounted">{{ relTime(s.at) }}</template><template v-if="s.quantity > 1"> · {{ s.quantity }} un.</template></span>
            </span>
            <span class="text-[14px] font-semibold text-ink" data-numeric>{{ brl(s.total) }}</span>
          </li>
          <li v-if="!painel" class="space-y-3 py-2"><div v-for="i in 5" :key="i" class="h-8 animate-pulse rounded bg-surface-2" /></li>
        </ul>
      </div>
    </section>
  </div>
</template>
