<script setup lang="ts">
import { ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { onBeforeUnmount, onMounted, reactive, ref, watch, watchEffect } from 'vue'
import EmptyAccountState from '../components/painel/EmptyAccountState.vue'
import PageHeader from '../components/painel/PageHeader.vue'
import ClaimAttentionCard from '../components/reclamacoes/ClaimAttentionCard.vue'
import ClaimDetailPanel from '../components/reclamacoes/ClaimDetailPanel.vue'
import { usePageHeader } from '../composables/usePageHeader'
import { useToast } from '../composables/useToast'
import { apiErrorMessage } from '../lib/apiErrors'
import { brl, dateShort, dateTimeShort, int } from '../lib/format'
import { useSessionStore } from '../stores/session'
import type { ClaimDetail, ClaimsResponse } from '../types/claims'

/**
 * `/reclamacoes`: todas as reclamações do Mercado Livre (cancelamentos, mediações, devoluções) importadas pelo Lunna,
 * mais novas primeiro, com busca e o detalhe completo de cada uma. Filtros e regras vêm depois (pedido do usuário em
 * 03/11/2026). A importação é gradual: a lista vem toda; os detalhes completam a cada sincronização.
 */
const { $api } = useNuxtApp()
const session = useSessionStore()
const header = usePageHeader()

// período (como em Vendas: presets, mês ou datas; padrão: todas) e ordenação por coluna
const filters = reactive({ q: '', page: 1, per_page: 50, period: 'all', from: '', to: '', sort: 'date', dir: 'desc' as 'asc' | 'desc', view: '' as '' | 'atender' | 'abertas' })
const toast = useToast()
const sending = ref(false)
const cards = ref<InstanceType<typeof ClaimAttentionCard>[]>([])

function setView(view: '' | 'atender' | 'abertas') {
  Object.assign(filters, { view: filters.view === view ? '' : view, page: 1 })
}

// Resposta na reclamação: vai para o Mercado Livre (o cartão já pediu a confirmação).
async function reply(claimId: number, receiver: string, text: string) {
  sending.value = true
  try {
    await $api(`/api/claims/${claimId}/reply`, {
      method: 'POST',
      query: { account_id: session.selectedAccountId },
      body: { receiver_role: receiver, message: text, confirm: true }
    })
    toast.success('Resposta enviada na reclamação no Mercado Livre.')
    cards.value.forEach((c) => c?.reset())
    await load(true)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'O Mercado Livre não aceitou a resposta. Nada foi enviado.'))
  } finally {
    sending.value = false
  }
}
const PERIODS = [
  { value: 'all', label: 'Todas' }, { value: 'today', label: 'Hoje' }, { value: 'yesterday', label: 'Ontem' },
  { value: '7d', label: '7 dias' }, { value: '30d', label: '30 dias' }, { value: '60d', label: '60 dias' },
  { value: '90d', label: '3 meses' }, { value: '365d', label: '12 meses' }
]
const COLUMNS: { label: string; sort?: string }[] = [
  { label: 'Aberta em', sort: 'date' }, { label: 'Reclamação', sort: 'type' }, { label: 'Venda' }, { label: 'Motivo', sort: 'reason' },
  { label: 'Situação', sort: 'status' }, { label: 'Devolução habilitada', sort: 'return_enabled' },
  { label: 'Devolução efetivada', sort: 'return_state' }, { label: 'Reembolso', sort: 'refund' },
  { label: 'Custo com frete', sort: 'freight' }, { label: 'Quem age / prazo' }, { label: 'Reputação', sort: 'reputation' }
]

function periodQuery() {
  if (filters.period.startsWith('month:')) return { month: filters.period.slice(6) }
  if (filters.period === 'custom') return filters.from && filters.to ? { from: filters.from, to: filters.to } : {}
  return filters.period === 'all' ? {} : { period: filters.period }
}
function setPeriod(value: string) {
  Object.assign(filters, { period: value, from: '', to: '', page: 1 })
}
function onMonth(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value) setPeriod(value)
}
function onDate(which: 'from' | 'to', event: Event) {
  filters[which] = (event.target as HTMLInputElement).value
  filters.period = 'custom'
  filters.page = 1
}
// mesma coluna inverte; coluna nova começa decrescente (data) ou crescente (texto)
function sortBy(key: string) {
  if (filters.sort === key) filters.dir = filters.dir === 'asc' ? 'desc' : 'asc'
  else Object.assign(filters, { sort: key, dir: key === 'date' ? 'desc' : 'asc' })
  filters.page = 1
}
const response = ref<ClaimsResponse | null>(null)
const loading = ref(true)
const error = ref('')
const expanded = ref<number | null>(null)
const details = reactive<Record<number, ClaimDetail>>({})
const detailLoading = ref(false)

const TONE: Record<string, string> = { warn: 'pill-warning', neutral: 'pill-neutral', ok: 'pill-success', bad: 'pill-danger' }

async function load(silent = false) {
  const accountId = session.selectedAccountId
  if (!accountId) return
  if (!silent) loading.value = true
  try {
    response.value = await $api('/api/claims', {
      query: {
        account_id: accountId, q: filters.q.trim() || undefined, page: filters.page, per_page: filters.per_page,
        view: filters.view || undefined,
        // na visão A atender/Abertas a ordem é pelo prazo e o período não se aplica
        ...(filters.view ? {} : { sort: filters.sort, dir: filters.dir, ...periodQuery() })
      }
    })
    error.value = ''
  } catch (err) {
    error.value = apiErrorMessage(err, 'Não foi possível carregar as reclamações.')
  } finally {
    loading.value = false
  }
}

async function toggle(id: number) {
  expanded.value = expanded.value === id ? null : id
  if (expanded.value === null) return
  detailLoading.value = true
  try {
    details[id] = await $api(`/api/claims/${id}`, { query: { account_id: session.selectedAccountId } })
  } catch {
    // o painel mostra "Carregando…" e a próxima abertura tenta de novo
  } finally {
    detailLoading.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(() => filters.q, () => {
  clearTimeout(timer)
  timer = setTimeout(() => { filters.page = 1; void load() }, 300)
})
watch(() => [filters.page, filters.per_page, filters.sort, filters.dir, filters.period, filters.from, filters.to, filters.view, session.selectedAccountId], () => {
  if (filters.period === 'custom' && !(filters.from && filters.to)) return
  void load()
})

let poll: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  void load()
  poll = setInterval(() => void load(true), 60_000)
})
onBeforeUnmount(() => { clearInterval(poll); clearTimeout(timer) })

watchEffect(() => {
  header.state.title = 'Reclamações'
  header.state.subtitle = session.selectedAccount ? `Mercado Livre · ${session.selectedAccount.nickname}` : 'Mercado Livre'
  header.state.sync = null
  header.state.generatedAt = null
  header.state.refreshing = loading.value
  header.state.onRefresh = () => void load()
})

const pages = () => (response.value ? Math.max(1, Math.ceil(response.value.total / response.value.per_page)) : 1)
</script>

<template>
  <EmptyAccountState v-if="!session.selectedAccount" />
  <div v-else class="page space-y-5">
    <PageHeader />

    <p v-if="response" class="text-[13px] text-ink-2" role="status" data-test="reclamacoes-importacao">
      {{ int(response.import.total) }} reclamações importadas do Mercado Livre ({{ int(response.import.open) }} abertas)
      <template v-if="response.import.detailed < response.import.total">
        · detalhes completos de {{ int(response.import.detailed) }}; o restante chega sozinho a cada sincronização (das mais novas para as mais antigas)
      </template>
      <template v-else> · todas com detalhes completos</template>
      <template v-if="response.import.listed_at"> · lista lida em {{ dateTimeShort(response.import.listed_at) }}</template>
    </p>

    <!-- período (data de abertura da reclamação) -->
    <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Período" data-test="reclamacoes-periodo">
      <button
        v-for="p in PERIODS"
        :key="p.value"
        type="button"
        class="rounded-full border px-3 py-1 text-[13px]"
        :class="filters.period === p.value ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink-2 hover:bg-surface-2'"
        :aria-pressed="filters.period === p.value"
        @click="setPeriod(p.value)"
      >{{ p.label }}</button>
      <select
        class="input h-8 w-auto rounded-full text-[13px]"
        :class="filters.period.startsWith('month:') ? 'border-primary bg-primary text-white' : ''"
        aria-label="Mês"
        data-test="reclamacoes-mes"
        :value="filters.period.startsWith('month:') ? filters.period : ''"
        @change="onMonth($event)"
      >
        <option value="" disabled>Mês</option>
        <option v-for="m in response?.months ?? []" :key="m.value" :value="`month:${m.value}`">{{ m.label }}{{ m.current ? ' (até hoje)' : '' }}</option>
      </select>
      <span class="mx-1 text-[12px] text-ink-3">ou</span>
      <input type="date" class="input h-8 w-auto text-[13px]" :value="filters.from" aria-label="Data inicial" @change="onDate('from', $event)" />
      <span class="text-[12px] text-ink-3">até</span>
      <input type="date" class="input h-8 w-auto text-[13px]" :value="filters.to" aria-label="Data final" @change="onDate('to', $event)" />
    </div>

    <!-- A atender: reclamações que aguardam o vendedor (maior e mais chamativo que os filtros de data) -->
    <div class="flex flex-wrap items-stretch gap-3" data-test="reclamacoes-atender">
      <button
        type="button"
        class="group relative flex min-w-[260px] items-center gap-3 rounded-card border-2 px-5 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        :class="filters.view === 'atender'
          ? 'border-warning bg-warning text-white'
          : (response?.attention?.to_attend ? 'border-warning bg-warning-soft text-warning' : 'border-line bg-surface text-ink-2')"
        :aria-pressed="filters.view === 'atender'"
        data-test="botao-a-atender"
        @click="setView('atender')"
      >
        <span class="relative flex h-3 w-3">
          <span v-if="response?.attention?.to_attend" class="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
          <span class="relative inline-flex h-3 w-3 rounded-full" :class="response?.attention?.to_attend ? 'bg-warning' : 'bg-success'" />
        </span>
        <span>
          <span class="block text-[18px] font-bold leading-tight">A atender</span>
          <span class="block text-[12px]" :class="filters.view === 'atender' ? 'text-white' : 'text-ink-2'">
            {{ response?.attention?.to_attend ? `${response.attention.to_attend} aguardando sua ação` : 'nada aguardando você agora' }}
          </span>
        </span>
        <span class="ml-auto rounded-full px-3 py-1 text-[20px] font-bold" :class="filters.view === 'atender' ? 'bg-white text-warning' : 'bg-surface text-ink'">{{ int(response?.attention?.to_attend ?? 0) }}</span>
      </button>
      <button
        type="button"
        class="flex min-w-[200px] items-center gap-3 rounded-card border-2 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
        :class="filters.view === 'abertas' ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink-2'"
        :aria-pressed="filters.view === 'abertas'"
        data-test="botao-abertas"
        @click="setView('abertas')"
      >
        <span>
          <span class="block text-[16px] font-bold leading-tight">Abertas</span>
          <span class="block text-[12px]">{{ int(response?.attention?.can_reply ?? 0) }} em que você pode responder</span>
        </span>
        <span class="ml-auto text-[20px] font-bold">{{ int(response?.attention?.open ?? 0) }}</span>
      </button>
      <button v-if="filters.view" type="button" class="btn-link self-center text-[13px]" @click="setView(filters.view)">← Ver todas as reclamações</button>
    </div>

    <div v-if="filters.view" class="space-y-3" data-test="lista-atender">
      <p class="text-[13px] text-ink-2">
        {{ filters.view === 'atender' ? 'Reclamações abertas em que o Mercado Livre aguarda uma ação sua' : 'Todas as reclamações abertas' }}, pelo prazo (as que aguardam você primeiro).
        A resposta vai direto para a reclamação no Mercado Livre.
      </p>
      <p v-if="response && !response.claims.length" class="card p-6 text-center text-ink-3">
        {{ filters.view === 'atender' ? 'Nenhuma reclamação aguardando você agora. Veja as abertas para acompanhar os prazos.' : 'Nenhuma reclamação aberta.' }}
      </p>
      <ClaimAttentionCard
        v-for="c in response?.claims ?? []"
        :key="c.claim_id"
        ref="cards"
        :claim="c"
        :can-reply="session.isAdmin"
        :sending="sending"
        @reply="reply"
      />
    </div>

    <div v-if="!filters.view" class="card flex flex-wrap items-center gap-3 p-3">
      <div class="relative min-w-[240px] flex-1">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input v-model="filters.q" type="search" class="input pl-9" placeholder="Buscar por nº da reclamação ou da venda, comprador, produto, SKU ou motivo" aria-label="Buscar reclamações" data-test="reclamacoes-busca" />
      </div>
      <span v-if="response" class="text-[13px] text-ink-3">{{ int(response.total) }} reclamações</span>
    </div>

    <div v-if="error" class="card p-6 text-center text-danger" role="alert">{{ error }}</div>

    <div v-else-if="!filters.view" class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[980px] border-collapse text-[13px]">
          <thead class="bg-surface-2 text-left text-ink-2">
            <tr class="border-b border-line">
              <th
                v-for="col in COLUMNS"
                :key="col.label"
                class="px-3 py-2 font-semibold"
                :aria-sort="col.sort && response?.sort === col.sort ? (response?.dir === 'asc' ? 'ascending' : 'descending') : undefined"
              >
                <button v-if="col.sort" type="button" class="inline-flex items-center gap-1 text-left hover:text-ink" :data-test="`ordenar-${col.sort}`" @click="sortBy(col.sort)">
                  {{ col.label }}
                  <ChevronUpIcon v-if="response?.sort === col.sort && response?.dir === 'asc'" class="h-3.5 w-3.5" aria-hidden="true" />
                  <ChevronDownIcon v-else-if="response?.sort === col.sort" class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <template v-else>{{ col.label }}</template>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading && !response"><td colspan="11" class="px-3 py-10 text-center text-ink-3" role="status">Carregando reclamações…</td></tr>
            <tr v-else-if="response && !response.claims.length"><td colspan="11" class="px-3 py-10 text-center text-ink-3">Nenhuma reclamação {{ filters.q ? 'com essa busca' : 'importada ainda' }}.</td></tr>
            <template v-for="c in response?.claims ?? []" :key="c.claim_id">
              <tr class="cursor-pointer border-b border-line align-top hover:bg-surface-2" data-test="reclamacao-linha" @click="toggle(c.claim_id)">
                <td class="whitespace-nowrap px-3 py-2 text-ink-2">{{ dateTimeShort(c.date_created) }}</td>
                <td class="px-3 py-2">
                  <p class="font-medium text-ink">{{ c.type_label }}<template v-if="c.stage_label && c.stage_label !== '—'"> · {{ c.stage_label }}</template></p>
                  <p class="text-[12px] text-ink-3">#{{ c.claim_id }}</p>
                </td>
                <td class="max-w-[300px] px-3 py-2">
                  <template v-if="c.order">
                    <div class="flex items-start gap-2">
                      <img v-if="c.order.item?.thumbnail" :src="c.order.item.thumbnail" alt="" class="h-10 w-10 shrink-0 rounded object-cover" loading="lazy" />
                      <div class="min-w-0">
                        <p class="truncate text-ink" :title="c.order.item?.title ?? ''">{{ c.order.item?.title ?? '—' }}</p>
                        <p class="truncate text-[12px] text-ink-3">#{{ c.order.order_id }} · {{ c.order.item?.sku ?? 'sem SKU' }} · {{ brl(c.order.total) }}</p>
                        <p class="truncate text-[12px] text-ink-3">{{ c.order.buyer_name ?? c.order.buyer_nickname ?? '—' }}</p>
                      </div>
                    </div>
                  </template>
                  <span v-else class="text-[12px] text-ink-3">Venda antes de {{ dateShort(new Date(Date.now() - 92 * 864e5).toISOString()) }} (fora do Lunna)</span>
                </td>
                <td class="max-w-[220px] px-3 py-2 text-ink-2">{{ c.reason ?? '—' }}</td>
                <td class="px-3 py-2"><span :class="TONE[c.tone] ?? 'pill-neutral'">{{ c.status_label }}</span></td>
                <td class="px-3 py-2 text-[12px]" data-test="devolucao-habilitada">
                  <span v-if="c.devolution_status?.enabled === true" class="font-semibold text-ink">Sim</span>
                  <span v-else-if="c.devolution_status?.enabled === false" class="text-ink-3">Não</span>
                  <span v-else class="text-ink-3">carregando…</span>
                </td>
                <td class="px-3 py-2 text-[12px]" data-test="devolucao-efetivada">
                  <template v-if="c.devolution_status?.enabled">
                    <span :class="TONE[c.devolution_status.tone ?? 'neutral'] ?? 'pill-neutral'" :title="c.devolution_status.status ? `Situação no Mercado Livre: ${c.devolution_status.status}` : 'Devolução autorizada, ainda sem envio gerado'">{{ c.devolution_status.label }}</span>
                    <span v-if="c.devolution_status.date && c.devolution_status.key !== 'aguardando'" class="block text-ink-3">{{ dateShort(c.devolution_status.date) }}</span>
                  </template>
                  <span v-else class="text-ink-3">—</span>
                </td>
                <td class="px-3 py-2 text-[12px]" data-test="reembolso">
                  <template v-if="c.refund?.key">
                    <span :class="c.refund.key === 'sem' ? 'text-ink-3' : 'font-semibold text-ink'" :title="c.refund.source === 'reclamacao' ? 'Pelo que o Mercado Livre registrou na reclamação (venda fora do Lunna)' : 'Pelos pagamentos da venda'">{{ c.refund.label }}</span>
                    <span v-if="c.refund.amount" class="block text-ink-3">{{ brl(c.refund.amount) }}<template v-if="c.refund.key === 'parcial' && c.refund.paid"> de {{ brl(c.refund.paid) }}</template></span>
                  </template>
                  <span v-else class="text-ink-3">carregando…</span>
                </td>
                <td class="px-3 py-2 text-[12px]" data-test="custo-frete">
                  <template v-if="c.freight?.key">
                    <span :class="c.freight.key === 'nao' ? 'text-ink-3' : 'font-semibold text-ink'" :title="c.freight.source ? `Valor: ${c.freight.source}` : (c.freight.note ?? '')">{{ c.freight.label }}</span>
                    <span v-if="c.freight.amount" class="block text-ink-3">{{ brl(c.freight.amount) }}</span>
                    <span v-if="c.freight.covered && c.freight.key !== 'nao'" class="block text-ink-3" title="O Mercado Livre aplicou cobertura nesta reclamação: o custo pode ter sido reembolsado a você">cobertura do ML</span>
                  </template>
                  <span v-else class="text-ink-3">{{ c.detailed ? '—' : 'carregando…' }}</span>
                </td>
                <td class="px-3 py-2 text-[12px]">
                  <template v-if="c.action_responsible_label">{{ c.action_responsible_label }}<span v-if="c.due_date" class="block text-ink-3">até {{ dateTimeShort(c.due_date) }}</span></template>
                  <span v-else class="text-ink-3">{{ c.detailed ? '—' : 'carregando…' }}</span>
                </td>
                <td class="px-3 py-2 text-[12px]">
                  <span v-if="c.affects_reputation === true" class="font-semibold text-danger">Afeta</span>
                  <span v-else-if="c.affects_reputation === false" class="text-ink-3">Não afeta</span>
                  <span v-else class="text-ink-3">{{ c.detailed ? '—' : 'carregando…' }}</span>
                </td>
              </tr>
              <tr v-if="expanded === c.claim_id" class="border-b border-line bg-surface-2">
                <td colspan="11" class="border-l-4 border-l-primary px-4 py-4">
                  <ClaimDetailPanel :claim="details[c.claim_id] ?? null" :loading="detailLoading" />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="response && pages() > 1 && !filters.view" class="flex items-center justify-center gap-3">
      <button type="button" class="btn-secondary" :disabled="filters.page <= 1" @click="filters.page -= 1">← Anteriores</button>
      <span class="text-[13px] text-ink-3">Página {{ filters.page }} de {{ int(pages()) }}</span>
      <button type="button" class="btn-secondary" :disabled="filters.page >= pages()" @click="filters.page += 1">Próximas →</button>
    </div>
  </div>
</template>
