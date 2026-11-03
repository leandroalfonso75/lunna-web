<script setup lang="ts">
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { onBeforeUnmount, onMounted, reactive, ref, watch, watchEffect } from 'vue'
import EmptyAccountState from '../components/painel/EmptyAccountState.vue'
import PageHeader from '../components/painel/PageHeader.vue'
import ClaimDetailPanel from '../components/reclamacoes/ClaimDetailPanel.vue'
import { usePageHeader } from '../composables/usePageHeader'
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

const filters = reactive({ q: '', page: 1, per_page: 50 })
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
    response.value = await $api('/api/claims', { query: { account_id: accountId, q: filters.q.trim() || undefined, page: filters.page, per_page: filters.per_page } })
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
watch(() => [filters.page, filters.per_page, session.selectedAccountId], () => void load())

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

    <div class="card flex flex-wrap items-center gap-3 p-3">
      <div class="relative min-w-[240px] flex-1">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input v-model="filters.q" type="search" class="input pl-9" placeholder="Buscar por nº da reclamação ou da venda, comprador, produto, SKU ou motivo" aria-label="Buscar reclamações" data-test="reclamacoes-busca" />
      </div>
      <span v-if="response" class="text-[13px] text-ink-3">{{ int(response.total) }} reclamações</span>
    </div>

    <div v-if="error" class="card p-6 text-center text-danger" role="alert">{{ error }}</div>

    <div v-else class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[980px] border-collapse text-[13px]">
          <thead class="bg-surface-2 text-left text-ink-2">
            <tr class="border-b border-line">
              <th class="px-3 py-2 font-semibold">Aberta em</th>
              <th class="px-3 py-2 font-semibold">Reclamação</th>
              <th class="px-3 py-2 font-semibold">Venda</th>
              <th class="px-3 py-2 font-semibold">Motivo</th>
              <th class="px-3 py-2 font-semibold">Situação</th>
              <th class="px-3 py-2 font-semibold">Devolução habilitada</th>
              <th class="px-3 py-2 font-semibold">Devolução efetivada</th>
              <th class="px-3 py-2 font-semibold">Reembolso</th>
              <th class="px-3 py-2 font-semibold">Custo com frete</th>
              <th class="px-3 py-2 font-semibold">Quem age / prazo</th>
              <th class="px-3 py-2 font-semibold">Reputação</th>
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

    <div v-if="response && pages() > 1" class="flex items-center justify-center gap-3">
      <button type="button" class="btn-secondary" :disabled="filters.page <= 1" @click="filters.page -= 1">← Anteriores</button>
      <span class="text-[13px] text-ink-3">Página {{ filters.page }} de {{ int(pages()) }}</span>
      <button type="button" class="btn-secondary" :disabled="filters.page >= pages()" @click="filters.page += 1">Próximas →</button>
    </div>
  </div>
</template>
