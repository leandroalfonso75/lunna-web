<script setup lang="ts">
import { ArrowDownTrayIcon, ArrowTrendingDownIcon, ArrowTrendingUpIcon, ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, watchEffect } from 'vue'
import FinanceDailyChart from '../components/financeiro/FinanceDailyChart.vue'
import EmptyAccountState from '../components/painel/EmptyAccountState.vue'
import PageHeader from '../components/painel/PageHeader.vue'
import { usePageHeader } from '../composables/usePageHeader'
import { apiErrorMessage } from '../lib/apiErrors'
import { brl, dateShort, dateTimeShort, int, pct } from '../lib/format'
import { useSessionStore } from '../stores/session'
import type { Compare, FinanceResponse, StatementLine } from '../types/finance'

/**
 * `/financeiro` (pedido do usuário em 05/11/2026): a saúde financeira da operação num demonstrativo de resultado do
 * período, sempre comparado com o período imediatamente anterior de mesmo tamanho. Mesmos filtros de Vendas. Tudo é
 * calculado na API (Painel::FinanceQuery); aqui só exibimos.
 */
const { $api } = useNuxtApp()
const session = useSessionStore()
const header = usePageHeader()

const filters = reactive({ period: '30d', month: '', from: '', to: '', logistic: '', q: '', basis: 'lunna' as 'lunna' | 'extrato' })
const data = ref<FinanceResponse | null>(null)
const loading = ref(false)
const error = ref('')
const metric = ref<'revenue' | 'profit'>('revenue')
const openLine = ref<string | null>(null)
const openGroup = ref<string | null>(null)

const PERIODS = [
  { value: 'today', label: 'Hoje' }, { value: 'yesterday', label: 'Ontem' }, { value: '7d', label: '7 dias' },
  { value: 'mtd', label: 'Mês até hoje' }, { value: '30d', label: '30 dias' }, { value: '60d', label: '60 dias' }, { value: '90d', label: '3 meses' }
]
const LOGISTICS = [
  { value: '', label: 'Todas' }, { value: 'full', label: 'Full' }, { value: 'flex', label: 'Flex' },
  { value: 'coleta', label: 'Coleta' }, { value: 'agencia', label: 'Agência' }, { value: 'other', label: 'Outras' }
]
const KPIS: { key: keyof FinanceResponse['kpis']; label: string; fmt: 'brl' | 'pct' | 'int'; hint: string }[] = [
  { key: 'revenue', label: 'Receita bruta', fmt: 'brl', hint: 'Vendas pagas do período' },
  { key: 'net', label: 'Lucro líquido pós Ads', fmt: 'brl', hint: 'O que sobra depois de tudo, inclusive Ads' },
  { key: 'net_margin', label: 'Margem líquida', fmt: 'pct', hint: 'Lucro pós Ads ÷ receita' },
  { key: 'gross_margin', label: 'Margem bruta', fmt: 'pct', hint: '(Receita líquida − custo dos produtos) ÷ receita líquida' },
  { key: 'orders', label: 'Vendas', fmt: 'int', hint: 'Carrinho conta como uma venda' },
  { key: 'ticket', label: 'Ticket médio', fmt: 'brl', hint: 'Receita ÷ vendas' },
  { key: 'tacos', label: 'TACOS', fmt: 'pct', hint: 'Gasto com Ads ÷ receita total' },
  { key: 'ml_cost_pct', label: 'Custo do ML ÷ receita', fmt: 'pct', hint: 'Tarifas, fretes, Full e outras cobranças' }
]

function query() {
  const q: Record<string, unknown> = { account_id: session.selectedAccountId, basis: filters.basis }
  if (filters.month) q.month = filters.month
  else if (filters.period === 'custom' && filters.from && filters.to) Object.assign(q, { from: filters.from, to: filters.to })
  else q.period = filters.period
  if (filters.logistic) q.logistic = filters.logistic
  if (filters.q.trim()) q.q = filters.q.trim()
  return q
}

async function load() {
  if (!session.selectedAccountId) return
  loading.value = true
  try {
    data.value = await $api('/api/finance', { query: query() })
    error.value = ''
  } catch (err) {
    error.value = apiErrorMessage(err, 'Não foi possível calcular o financeiro agora.')
  } finally {
    loading.value = false
  }
}

function setPeriod(v: string) { Object.assign(filters, { period: v, month: '', from: '', to: '' }) }
function onMonth(e: Event) { Object.assign(filters, { month: (e.target as HTMLSelectElement).value, period: 'month', from: '', to: '' }) }
function onDate(which: 'from' | 'to', e: Event) {
  filters[which] = (e.target as HTMLInputElement).value
  filters.month = ''
  filters.period = 'custom'
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(() => filters.q, () => { clearTimeout(timer); timer = setTimeout(() => void load(), 400) })
watch(() => [filters.period, filters.month, filters.from, filters.to, filters.logistic, filters.basis, session.selectedAccountId], () => {
  if (filters.period === 'custom' && !(filters.from && filters.to)) return
  void load()
})
onMounted(() => void load())
onBeforeUnmount(() => clearTimeout(timer))

watchEffect(() => {
  header.state.title = 'Financeiro'
  header.state.subtitle = session.selectedAccount ? `Mercado Livre · ${session.selectedAccount.nickname}` : 'Mercado Livre'
  header.state.sync = null
  header.state.generatedAt = null
  header.state.refreshing = loading.value
  header.state.onRefresh = () => void load()
})

function fmt(v: number | null, kind: 'brl' | 'pct' | 'int') {
  if (v === null || v === undefined) return '—'
  return kind === 'brl' ? brl(v) : kind === 'pct' ? pct(v) : int(v)
}
function deltaText(c: Compare, kind: 'brl' | 'pct' | 'int') {
  if (c.delta_pct === null && c.delta === 0) return 'igual'
  const abs = kind === 'pct' ? `${c.delta > 0 ? '+' : ''}${c.delta.toFixed(1)} p.p.` : `${c.delta > 0 ? '+' : ''}${fmt(c.delta, kind)}`
  return c.delta_pct === null ? abs : `${abs} (${c.delta_pct > 0 ? '+' : ''}${c.delta_pct}%)`
}
function deltaClass(c: Compare) {
  return c.good === null ? 'text-ink-3' : c.good ? 'text-success' : 'text-danger'
}
const lineClass: Record<StatementLine['kind'], string> = {
  revenue: 'font-semibold text-ink', expense: 'text-ink', credit: 'text-success', subtotal: 'font-semibold text-ink bg-surface-2', total: 'text-[15px] font-bold text-ink bg-primary-soft'
}
const toneClass: Record<string, string> = { ok: 'border-success bg-success-soft text-success', warn: 'border-warning bg-warning-soft text-warning', bad: 'border-danger bg-danger-soft text-danger', neutral: 'border-line bg-surface-2 text-ink-2' }
const expenseMax = computed(() => Math.max(1, ...(data.value?.charts.expenses.map((e) => e.amount) ?? [1])))

function exportCsv() {
  if (!data.value) return
  const head = ['Linha', 'Período atual', 'Período anterior', 'Variação', 'Variação %', '% da receita', 'Observação']
  const money = (v: number | null) => (v === null ? '' : v.toFixed(2).replace('.', ','))
  const lines = data.value.statement.map((l) => [l.label, money(l.value), money(l.previous), money(l.delta), l.delta_pct ?? '', l.pct_revenue ?? '', l.note ?? '']
    .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
  const p = data.value.period
  const blob = new Blob(['﻿' + [`"DRE ${dateShort(p.from)} a ${dateShort(p.to)} x ${p.previous_label}"`, head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'financeiro-dre.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <EmptyAccountState v-if="!session.selectedAccount" />
  <div v-else class="page space-y-5">
    <PageHeader />

    <!-- filtros (os mesmos de Vendas) -->
    <div class="space-y-2" data-test="financeiro-filtros">
      <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Período">
        <button
          v-for="p in PERIODS"
          :key="p.value"
          type="button"
          class="rounded-full border px-3 py-1 text-[13px]"
          :class="filters.period === p.value ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink-2 hover:bg-surface-2'"
          :aria-pressed="filters.period === p.value"
          @click="setPeriod(p.value)"
        >{{ p.label }}</button>
        <select class="input h-8 w-auto rounded-full text-[13px]" :class="filters.month ? 'border-primary bg-primary text-white' : ''" aria-label="Mês" :value="filters.month" @change="onMonth($event)">
          <option value="" disabled>Mês</option>
          <option v-for="m in data?.months ?? []" :key="m.value" :value="m.value">{{ m.label }}{{ m.current ? ' (até hoje)' : m.partial ? ' (parcial)' : '' }}</option>
        </select>
        <span class="mx-1 text-[12px] text-ink-3">ou</span>
        <input type="date" class="input h-8 w-auto text-[13px]" :value="filters.from" aria-label="Data inicial" @change="onDate('from', $event)" />
        <span class="text-[12px] text-ink-3">até</span>
        <input type="date" class="input h-8 w-auto text-[13px]" :value="filters.to" aria-label="Data final" @change="onDate('to', $event)" />
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex gap-1 text-[12px]" role="group" aria-label="Logística">
          <button v-for="l in LOGISTICS" :key="l.value" type="button" class="rounded-md px-2.5 py-1" :class="filters.logistic === l.value ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2 hover:bg-surface-2'" @click="filters.logistic = l.value">{{ l.label }}</button>
        </div>
        <div class="relative min-w-[220px]">
          <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <input v-model="filters.q" type="search" class="input h-8 pl-9 text-[13px]" placeholder="Produto, SKU, anúncio ou comprador" aria-label="Buscar" />
        </div>
        <div class="ml-auto flex items-center gap-1 text-[12px]" role="group" aria-label="Base das tarifas, fretes e Ads">
          <span class="text-ink-3">Tarifas, fretes e Ads:</span>
          <button type="button" class="rounded-md px-2.5 py-1" :class="filters.basis === 'lunna' ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2 hover:bg-surface-2'" title="Calculado venda a venda, pela data da venda" data-test="base-lunna" @click="filters.basis = 'lunna'">Por venda</button>
          <button type="button" class="rounded-md px-2.5 py-1" :class="filters.basis === 'extrato' ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2 hover:bg-surface-2'" title="O que o Mercado Livre cobrou de fato no período, pela data da cobrança" data-test="base-extrato" @click="filters.basis = 'extrato'">Extrato do ML</button>
        </div>
      </div>
    </div>

    <p v-if="error" class="rounded-card border border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger" role="alert">{{ error }}</p>
    <p v-else-if="loading && !data" class="card p-6 text-center text-ink-3">Calculando…</p>

    <template v-if="data">
      <p class="text-[13px] text-ink-2" data-test="financeiro-periodo">
        Período <strong>{{ dateShort(data.period.from) }} a {{ dateShort(data.period.to) }}</strong>, comparado com <strong>{{ data.period.previous_label }}</strong><template v-if="!data.period.previous_label.includes(' a ')"> ({{ dateShort(data.period.previous_from) }})</template>.
        <template v-if="data.period.previous_partial"> <span class="text-warning">O período anterior começa antes das vendas guardadas no Lunna ({{ dateShort(data.coverage.orders_from) }}); a comparação fica parcial.</span></template>
        <template v-if="data.filtered"> <span class="text-warning">Com filtro de logística ou busca, as despesas da conta (Full, outras do ML, créditos) continuam sendo as do período inteiro.</span></template>
      </p>

      <!-- indicadores -->
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4" data-test="financeiro-kpis">
        <div v-for="k in KPIS" :key="k.key" class="card p-3" :title="k.hint">
          <p class="text-[12px] text-ink-3">{{ k.label }}</p>
          <p class="text-[20px] font-bold text-ink" data-numeric>{{ fmt(data.kpis[k.key].value, k.fmt) }}</p>
          <p class="flex items-center gap-1 text-[12px]" :class="deltaClass(data.kpis[k.key])" data-numeric>
            <ArrowTrendingUpIcon v-if="data.kpis[k.key].delta > 0" class="h-3.5 w-3.5" aria-hidden="true" />
            <ArrowTrendingDownIcon v-else-if="data.kpis[k.key].delta < 0" class="h-3.5 w-3.5" aria-hidden="true" />
            {{ deltaText(data.kpis[k.key], k.fmt) }} <span class="text-ink-3">vs {{ fmt(data.kpis[k.key].previous, k.fmt) }}</span>
          </p>
        </div>
      </div>

      <!-- saúde -->
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4" data-test="financeiro-saude">
        <div v-for="h in data.health" :key="h.key" class="rounded-card border-2 p-3" :class="toneClass[h.tone]">
          <p class="text-[12px] font-semibold">{{ h.label }}</p>
          <p class="text-[22px] font-bold" data-numeric>{{ h.value === null ? '—' : `${h.value.toFixed(1)}${h.unit}` }}</p>
          <p class="text-[11px] opacity-80">{{ h.target }}</p>
        </div>
      </div>

      <!-- gráficos -->
      <div class="grid gap-4 xl:grid-cols-3">
        <div class="card p-4 xl:col-span-2">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 class="section-title">Por dia: atual x {{ data.period.previous_label }}</h2>
            <div class="flex gap-1 text-[12px]" role="group" aria-label="Métrica">
              <button type="button" class="rounded-md px-2.5 py-1" :class="metric === 'revenue' ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2 hover:bg-surface-2'" @click="metric = 'revenue'">Receita</button>
              <button type="button" class="rounded-md px-2.5 py-1" :class="metric === 'profit' ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2 hover:bg-surface-2'" @click="metric = 'profit'">Lucro pós Ads</button>
            </div>
          </div>
          <FinanceDailyChart :daily="data.charts.daily" :metric="metric" :previous-label="data.period.previous_label" />
        </div>
        <div class="card p-4">
          <h2 class="section-title mb-2">Para onde vai a receita</h2>
          <ul class="space-y-1.5 text-[12px]">
            <li v-for="e in data.charts.expenses" :key="e.label">
              <div class="flex justify-between"><span class="text-ink">{{ e.label }}</span><span class="text-ink-2" data-numeric>{{ brl(e.amount) }} · {{ e.pct ?? 0 }}%</span></div>
              <div class="h-2 rounded bg-surface-2"><div class="h-2 rounded bg-primary" :style="{ width: `${Math.max(1, (e.amount / expenseMax) * 100)}%` }" /></div>
            </li>
          </ul>
          <p class="mt-2 text-[12px] font-semibold" :class="data.kpis.net.value >= 0 ? 'text-success' : 'text-danger'">Sobra: {{ brl(data.kpis.net.value) }} ({{ data.kpis.net_margin.value ?? 0 }}% da receita)</p>
        </div>
      </div>

      <!-- DRE -->
      <div class="card overflow-hidden" data-test="financeiro-dre">
        <div class="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <h2 class="section-title">Demonstrativo de resultado</h2>
          <span class="text-[12px] text-ink-3">clique numa linha para ver o detalhe</span>
          <button type="button" class="btn-link ml-auto text-[12px]" @click="exportCsv"><ArrowDownTrayIcon class="inline h-4 w-4" aria-hidden="true" /> Exportar (CSV)</button>
        </div>
        <table class="w-full table-fixed border-collapse text-[13px]">
          <thead>
            <tr class="border-b border-line text-[12px] text-ink-2">
              <th class="w-[40%] px-4 py-2 text-left font-semibold">Linha</th>
              <th class="w-[15%] px-2 py-2 text-right font-semibold">Período atual</th>
              <th class="w-[9%] px-2 py-2 text-right font-semibold">% receita</th>
              <th class="w-[15%] px-2 py-2 text-right font-semibold">{{ data.period.previous_label }}</th>
              <th class="w-[21%] px-2 py-2 text-right font-semibold">Variação</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="l in data.statement" :key="l.key">
              <tr class="border-b border-line" :class="[lineClass[l.kind], l.note || l.breakdown?.length ? 'cursor-pointer hover:brightness-95' : '']" :data-test="`dre-${l.key}`" @click="openLine = openLine === l.key ? null : l.key">
                <td class="px-4 py-2">
                  {{ l.label }}
                  <component :is="openLine === l.key ? ChevronUpIcon : ChevronDownIcon" v-if="l.note || l.breakdown?.length" class="ml-1 inline h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
                </td>
                <td class="px-2 py-2 text-right" data-numeric>{{ brl(l.value) }}</td>
                <td class="px-2 py-2 text-right text-ink-3" data-numeric>{{ l.pct_revenue === null ? '—' : `${l.pct_revenue}%` }}</td>
                <td class="px-2 py-2 text-right text-ink-2" data-numeric>{{ brl(l.previous) }}</td>
                <td class="px-2 py-2 text-right" :class="deltaClass(l)" data-numeric>{{ deltaText(l, 'brl') }}</td>
              </tr>
              <tr v-if="openLine === l.key && (l.note || l.breakdown?.length)" class="border-b border-line bg-surface-2 text-[12px]">
                <td colspan="5" class="px-6 py-2">
                  <p v-if="l.note" class="text-ink-2">{{ l.note }}</p>
                  <ul v-if="l.breakdown?.length" class="mt-1 space-y-0.5">
                    <li v-for="b in l.breakdown" :key="b.label" class="flex max-w-md justify-between gap-3"><span class="text-ink">{{ b.label }}</span><span data-numeric>{{ brl(b.amount) }}</span></li>
                  </ul>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- extrato do ML e conciliação -->
      <div class="grid gap-4 xl:grid-cols-2">
        <div class="card p-4" data-test="financeiro-extrato">
          <h2 class="section-title mb-1">Extrato do Mercado Livre no período</h2>
          <p class="mb-2 text-[12px] text-ink-3">Cobranças e bonificações pela data em que o ML lançou<template v-if="data.coverage.billing_synced_at">; lido em {{ dateTimeShort(data.coverage.billing_synced_at) }}</template>.</p>
          <table class="w-full text-[12px]">
            <thead><tr class="border-b border-line text-ink-2"><th class="py-1 text-left font-semibold">Grupo</th><th class="py-1 text-right font-semibold">Cobrado</th><th class="py-1 text-right font-semibold">Devolvido</th><th class="py-1 text-right font-semibold">Líquido</th></tr></thead>
            <tbody>
              <template v-for="g in data.statement_ml" :key="g.group">
                <tr class="cursor-pointer border-b border-line hover:bg-surface-2" @click="openGroup = openGroup === g.group ? null : g.group">
                  <td class="py-1.5 text-ink">{{ g.label }} <span class="text-ink-3">({{ g.count }})</span><span v-if="g.neutral" class="ml-1 text-ink-3" title="O comprador paga o acréscimo do parcelamento e o ML repassa a mesma cobrança ao vendedor: não muda o resultado">· neutra</span></td>
                  <td class="py-1.5 text-right" data-numeric>{{ brl(g.charge) }}</td>
                  <td class="py-1.5 text-right text-success" data-numeric>{{ g.bonus ? `−${brl(g.bonus)}` : '—' }}</td>
                  <td class="py-1.5 text-right font-semibold" data-numeric>{{ brl(g.net) }}</td>
                </tr>
                <tr v-if="openGroup === g.group" class="border-b border-line bg-surface-2">
                  <td colspan="4" class="px-3 py-2">
                    <ul class="space-y-0.5">
                      <li v-for="l in g.lines" :key="l.label ?? ''" class="flex justify-between gap-3"><span class="text-ink">{{ l.label }} <span class="text-ink-3">({{ l.count }})</span></span><span :class="l.amount < 0 ? 'text-success' : ''" data-numeric>{{ l.amount < 0 ? '−' : '' }}{{ brl(Math.abs(l.amount)) }}</span></li>
                    </ul>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <div class="card p-4" data-test="financeiro-conciliacao">
          <h2 class="section-title mb-1">Conciliação: Lunna x extrato do ML</h2>
          <p class="mb-2 text-[12px] text-ink-3">O Lunna calcula por venda, pela data da venda; o extrato traz o que foi cobrado, pela data da cobrança. Diferenças pequenas são de calendário e de cancelamentos.</p>
          <table class="w-full text-[12px]">
            <thead><tr class="border-b border-line text-ink-2"><th class="py-1 text-left font-semibold">Item</th><th class="py-1 text-right font-semibold">Lunna</th><th class="py-1 text-right font-semibold">Extrato</th><th class="py-1 text-right font-semibold">Diferença</th></tr></thead>
            <tbody>
              <tr v-for="r in data.reconciliation" :key="r.key" class="border-b border-line" :title="r.note">
                <td class="py-1.5 text-ink">{{ r.label }}</td>
                <td class="py-1.5 text-right" data-numeric>{{ brl(r.lunna) }}</td>
                <td class="py-1.5 text-right" data-numeric>{{ brl(r.extrato) }}</td>
                <td class="py-1.5 text-right font-semibold" :class="Math.abs(r.diff_pct ?? 0) > 10 ? 'text-warning' : 'text-ink'" data-numeric>{{ r.diff > 0 ? '+' : '' }}{{ brl(r.diff) }}<span v-if="r.diff_pct !== null" class="text-ink-3"> ({{ r.diff_pct > 0 ? '+' : '' }}{{ r.diff_pct }}%)</span></td>
              </tr>
            </tbody>
          </table>
          <ul class="mt-2 space-y-0.5 text-[11px] text-ink-3">
            <li v-for="r in data.reconciliation" :key="`n-${r.key}`">{{ r.label }}: {{ r.note }}</li>
          </ul>
          <p class="mt-2 text-[12px] text-ink-2">Para ver o demonstrativo com os valores cobrados, use <button type="button" class="btn-link" @click="filters.basis = 'extrato'">Extrato do ML</button> nos filtros.</p>
        </div>
      </div>

      <p class="text-[12px] text-ink-3">
        Vendas guardadas no Lunna desde {{ dateShort(data.coverage.orders_from) }}; extrato do ML desde {{ data.coverage.billing_from ? dateShort(data.coverage.billing_from) : '—' }}.
        Impostos e despesas fixas são as porcentagens de Configurações › Empresa. Custo dos produtos: Olist (PEPS) ou custo manual.
      </p>
    </template>
  </div>
</template>
