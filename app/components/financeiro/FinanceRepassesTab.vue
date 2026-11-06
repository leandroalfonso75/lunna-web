<script setup lang="ts">
import { ArrowDownTrayIcon } from '@heroicons/vue/24/outline'
import { computed, ref, watch } from 'vue'
import { apiErrorMessage } from '../../lib/apiErrors'
import { brl, dateShort, dateTimeShort, int } from '../../lib/format'
import type { RepasseSale, RepassesResponse } from '../../types/finance'

/**
 * Aba Repasses do Financeiro (pedido do usuário em 06/11/2026): a conciliação geral com a conta do Mercado Pago.
 * Cada venda do período em quatro pernas: previsto no Lunna × faturado pelo ML × descontado no pagamento do Mercado Pago
 * × creditado na conta; e o resumo de todos os movimentos da conta (entradas, saídas, saques, reservas). Carrega à parte
 * (GET /api/finance/repasses) só quando a aba abre, com os mesmos filtros das outras abas.
 */
const props = defineProps<{ query: Record<string, unknown> }>()
const { $api } = useNuxtApp()

const data = ref<RepassesResponse | null>(null)
const loading = ref(false)
const error = ref('')
const statusFilter = ref<string>('')
const open = ref<string | null>(null)

async function load() {
  loading.value = true
  try {
    data.value = await $api<RepassesResponse>('/api/finance/repasses', { query: props.query })
    error.value = ''
  } catch (err) {
    error.value = apiErrorMessage(err, 'Não foi possível conciliar os repasses agora.')
  } finally {
    loading.value = false
  }
}
watch(() => JSON.stringify(props.query), () => void load(), { immediate: true })
defineExpose({ load })

const toneText: Record<string, string> = { ok: 'text-success', warn: 'text-warning', bad: 'text-danger', neutral: 'text-ink-2' }
const toneBox: Record<string, string> = { ok: 'border-success bg-success-soft', warn: 'border-warning bg-warning-soft', bad: 'border-danger bg-danger-soft', neutral: 'border-line bg-surface-2' }
const statusLabel = computed(() => Object.fromEntries((data.value?.by_status ?? []).map((s) => [s.key, s])))
const creditLabel = computed(() => Object.fromEntries((data.value?.by_credit ?? []).map((s) => [s.key, s])))
const explained = computed(() => {
  const d = data.value
  if (!d) return 0
  return d.by_status.filter((s) => s.key !== 'diferenca' && s.key !== 'sem_pagamento').reduce((a, s) => a + s.count, 0)
})
const list = computed(() => (data.value?.divergent ?? []).filter((s) => !statusFilter.value || s.status === statusFilter.value || s.credit === statusFilter.value))
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${brl(Math.abs(v))}`
const diffClass = (v: number) => (Math.abs(v) < 0.05 ? 'text-success' : v < 0 ? 'text-danger' : 'text-warning')
const orderLink = (s: RepasseSale) => `https://www.mercadolivre.com.br/vendas/${s.pack_id ?? s.order_ids[0]}/detalhe`

function exportCsv() {
  if (!data.value) return
  const m = (v: number | null | undefined) => (v === null || v === undefined ? '' : v.toFixed(2).replace('.', ','))
  const rows = [
    ['Venda(s)', 'Envio', 'Data', 'Produto', 'Situação', 'Crédito', 'Receita', 'Previsto Lunna', 'Tarifa Lunna', 'Tarifa faturada', 'Tarifa MP',
      'Frete Lunna', 'Frete faturado', 'Frete MP', 'Comprador pagou', 'Cupom vendedor', 'Líquido MP', 'Creditado', 'Diferença', 'Liberação', 'Pagamentos'],
    ...data.value.divergent.map((s) => [s.order_ids.join(' '), s.shipment_id, dateShort(s.date), s.items.join(' | '), statusLabel.value[s.status]?.label ?? s.status,
      creditLabel.value[s.credit]?.label ?? s.credit, m(s.revenue), m(s.expected), m(s.lunna_fee), m(s.billed_fee), m(s.mp_fee), m(s.lunna_shipping), m(s.billed_shipping),
      m(s.mp_shipping), m(s.buyer_paid), m(s.mp_coupon), m(s.mp_net), m(s.credited), m(s.diff), s.release_date ? dateShort(s.release_date) : '', s.payment_ids.join(' ')])
  ]
  const blob = new Blob(['﻿' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'financeiro-repasses.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <div class="space-y-4" data-test="financeiro-repasses">
    <p v-if="error" class="rounded-card border border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger" role="alert">{{ error }}</p>
    <p v-else-if="loading && !data" class="card p-6 text-center text-ink-3">Conciliando com o Mercado Pago…</p>

    <template v-if="data">
      <!-- totais -->
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4" data-test="repasses-totais">
        <div class="card p-3" title="Receita − tarifa − frete do vendedor, venda a venda, como o Lunna calcula">
          <p class="text-[12px] text-ink-3">Previsto no Lunna</p>
          <p class="text-[20px] font-bold text-ink" data-numeric>{{ brl(data.totals.expected) }}</p>
          <p class="text-[12px] text-ink-3">{{ int(data.totals.sales) }} vendas (carrinho conta uma)</p>
        </div>
        <div class="card p-3" title="Valor líquido dos pagamentos aprovados, depois das taxas, com a parte do comprador no frete">
          <p class="text-[12px] text-ink-3">Líquido no Mercado Pago</p>
          <p class="text-[20px] font-bold text-ink" data-numeric>{{ brl(data.totals.mp_net) }}</p>
          <p class="text-[12px]" :class="diffClass(data.totals.diff)">{{ signed(data.totals.diff) }} nas vendas pagas</p>
        </div>
        <div class="card p-3" title="O que já entrou no saldo da conta (relatório de liberações)">
          <p class="text-[12px] text-ink-3">Creditado na conta</p>
          <p class="text-[20px] font-bold text-ink" data-numeric>{{ brl(data.totals.credited) }}</p>
          <p class="text-[12px] text-ink-3">{{ brl(data.totals.to_release) }} a liberar ou aguardando relatório</p>
        </div>
        <div class="card p-3" title="Vendas que fecham até o centavo ou com o motivo da diferença identificado">
          <p class="text-[12px] text-ink-3">Vendas explicadas</p>
          <p class="text-[20px] font-bold" :class="explained === data.totals.sales ? 'text-success' : 'text-ink'" data-numeric>{{ int(explained) }} de {{ int(data.totals.sales) }}</p>
          <p v-if="data.totals.coupon" class="text-[12px] text-warning">{{ brl(data.totals.coupon) }} em cupons do vendedor</p>
        </div>
      </div>

      <p class="text-[12px] text-ink-3">
        Pagamentos lidos do Mercado Pago<template v-if="data.coverage.payments_synced_at"> até {{ dateTimeShort(data.coverage.payments_synced_at) }}</template>.
        Movimentos da conta (relatório de liberações) de {{ data.coverage.releases_from ? dateShort(data.coverage.releases_from) : '—' }} a {{ data.coverage.releases_until ? dateShort(data.coverage.releases_until) : '—' }};
        o Mercado Pago gera esse relatório toda segunda-feira com a semana anterior.
        <span v-if="!data.coverage.releases_cover_period" class="text-warning">Os dias depois de {{ data.coverage.releases_until ? dateShort(data.coverage.releases_until) : '—' }} ainda não têm os créditos na conta.</span>
      </p>

      <div class="grid gap-4 xl:grid-cols-2">
        <!-- situação das vendas -->
        <div class="card p-4" data-test="repasses-situacao">
          <h2 class="section-title mb-1">Vendas: previsto x pagamento</h2>
          <p class="mb-2 text-[12px] text-ink-3">Cada venda comparada com o líquido do pagamento no Mercado Pago. Clique numa linha para ver as vendas.</p>
          <table class="w-full text-[12px]">
            <thead><tr class="border-b border-line text-ink-2"><th class="py-1 text-left font-semibold">Situação</th><th class="py-1 text-right font-semibold">Vendas</th><th class="py-1 text-right font-semibold">Previsto</th><th class="py-1 text-right font-semibold">Líquido MP</th><th class="py-1 text-right font-semibold">Diferença</th></tr></thead>
            <tbody>
              <tr
                v-for="s in data.by_status"
                :key="s.key"
                class="cursor-pointer border-b border-line hover:bg-surface-2"
                :class="statusFilter === s.key ? 'bg-primary-soft' : ''"
                @click="statusFilter = statusFilter === s.key ? '' : s.key"
              >
                <td class="py-1.5 font-medium" :class="toneText[s.tone]">{{ s.label }}</td>
                <td class="py-1.5 text-right" data-numeric>{{ int(s.count) }}</td>
                <td class="py-1.5 text-right" data-numeric>{{ brl(s.expected) }}</td>
                <td class="py-1.5 text-right" data-numeric>{{ brl(s.mp_net) }}</td>
                <td class="py-1.5 text-right font-semibold" :class="diffClass(s.diff)" data-numeric>{{ signed(s.diff) }}</td>
              </tr>
            </tbody>
          </table>
          <ul class="mt-2 space-y-0.5 text-[11px] text-ink-3">
            <li><strong>Frete descontado na liberação:</strong> no carrinho com frete na fatura do ML, o pagamento não desconta a etiqueta; ela sai na hora da liberação e o creditado bate com o previsto.</li>
            <li><strong>Cupom com participação do vendedor:</strong> o pagamento desconta a sua parte do cupom, que o Lunna ainda não conta como custo da venda.</li>
            <li><strong>Frete previsto que o ML não cobrou:</strong> o Lunna previu um frete do vendedor que não foi descontado nem faturado.</li>
            <li><strong>Em mediação / reembolsada:</strong> o dinheiro está retido ou voltou ao comprador.</li>
          </ul>
        </div>

        <!-- crédito na conta -->
        <div class="card p-4" data-test="repasses-credito">
          <h2 class="section-title mb-1">Pagamento x crédito na conta</h2>
          <p class="mb-2 text-[12px] text-ink-3">Se o líquido de cada venda entrou no saldo do Mercado Pago.</p>
          <table class="w-full text-[12px]">
            <thead><tr class="border-b border-line text-ink-2"><th class="py-1 text-left font-semibold">Situação</th><th class="py-1 text-right font-semibold">Vendas</th><th class="py-1 text-right font-semibold">Líquido MP</th><th class="py-1 text-right font-semibold">Creditado</th></tr></thead>
            <tbody>
              <tr
                v-for="s in data.by_credit"
                :key="s.key"
                class="cursor-pointer border-b border-line hover:bg-surface-2"
                :class="statusFilter === s.key ? 'bg-primary-soft' : ''"
                @click="statusFilter = statusFilter === s.key ? '' : s.key"
              >
                <td class="py-1.5 font-medium" :class="toneText[s.tone]">{{ s.label }}</td>
                <td class="py-1.5 text-right" data-numeric>{{ int(s.count) }}</td>
                <td class="py-1.5 text-right" data-numeric>{{ brl(s.mp_net) }}</td>
                <td class="py-1.5 text-right" data-numeric>{{ brl(s.credited) }}</td>
              </tr>
            </tbody>
          </table>

          <h3 class="mb-1 mt-4 text-[13px] font-semibold text-ink">Descontos nas três fontes</h3>
          <p class="mb-1 text-[11px] text-ink-3">Só as vendas pagas e já faturadas pelo ML ({{ int(data.legs[0]?.sales ?? 0) }}), o mesmo conjunto nas três colunas.</p>
          <table class="w-full text-[12px]">
            <thead><tr class="border-b border-line text-ink-2"><th class="py-1 text-left font-semibold">Item</th><th class="py-1 text-right font-semibold">Lunna</th><th class="py-1 text-right font-semibold">Faturado ML</th><th class="py-1 text-right font-semibold">Mercado Pago</th><th class="py-1 text-right font-semibold">MP − Lunna</th></tr></thead>
            <tbody>
              <tr v-for="l in data.legs" :key="l.key" class="border-b border-line" :title="l.note">
                <td class="py-1.5 text-ink">{{ l.label }}</td>
                <td class="py-1.5 text-right" data-numeric>{{ brl(l.lunna) }}</td>
                <td class="py-1.5 text-right" data-numeric>{{ l.billed === null ? '—' : brl(l.billed) }}</td>
                <td class="py-1.5 text-right" data-numeric>{{ brl(l.mp) }}</td>
                <td class="py-1.5 text-right font-semibold" :class="diffClass(l.diff)" data-numeric>{{ signed(l.diff) }}</td>
              </tr>
            </tbody>
          </table>
          <ul class="mt-2 space-y-0.5 text-[11px] text-ink-3">
            <li v-for="l in data.legs" :key="`n-${l.key}`">{{ l.label }}: {{ l.note }}</li>
          </ul>
        </div>
      </div>

      <!-- vendas com diferença ou pendência -->
      <div class="card overflow-hidden" data-test="repasses-vendas">
        <div class="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <h2 class="section-title">Vendas fora do "conferido e creditado"</h2>
          <span class="text-[12px] text-ink-3">{{ int(list.length) }}<template v-if="statusFilter"> · filtro: {{ statusLabel[statusFilter]?.label ?? creditLabel[statusFilter]?.label }} <button type="button" class="btn-link" @click="statusFilter = ''">limpar</button></template></span>
          <button type="button" class="btn-link ml-auto text-[12px]" @click="exportCsv"><ArrowDownTrayIcon class="inline h-4 w-4" aria-hidden="true" /> Exportar (CSV)</button>
        </div>
        <p v-if="!list.length" class="px-4 py-6 text-center text-[13px] text-ink-3">Nenhuma venda nesta situação.</p>
        <div v-else class="max-h-[520px] overflow-auto">
          <table class="w-full text-[12px]">
            <thead class="sticky top-0 bg-surface"><tr class="border-b border-line text-ink-2">
              <th class="px-3 py-1.5 text-left font-semibold">Venda</th><th class="px-2 py-1.5 text-left font-semibold">Situação</th>
              <th class="px-2 py-1.5 text-right font-semibold">Previsto</th><th class="px-2 py-1.5 text-right font-semibold">Líquido MP</th>
              <th class="px-2 py-1.5 text-right font-semibold">Creditado</th><th class="px-2 py-1.5 text-right font-semibold">Diferença</th>
            </tr></thead>
            <tbody>
              <template v-for="s in list" :key="s.key">
                <tr class="cursor-pointer border-b border-line hover:bg-surface-2" @click="open = open === s.key ? null : s.key">
                  <td class="px-3 py-1.5">
                    <a :href="orderLink(s)" target="_blank" rel="noopener" class="btn-link" @click.stop>{{ s.pack_id ?? s.order_ids[0] }}</a>
                    <span class="text-ink-3"> {{ dateShort(s.date) }}</span>
                    <span class="block max-w-[340px] truncate text-[11px] text-ink-3" :title="s.items.join(' · ')">{{ s.items.join(' · ') }}</span>
                  </td>
                  <td class="px-2 py-1.5">
                    <span :class="toneText[statusLabel[s.status]?.tone ?? 'neutral']">{{ statusLabel[s.status]?.label ?? s.status }}</span>
                    <span class="block text-[11px]" :class="toneText[creditLabel[s.credit]?.tone ?? 'neutral']">{{ creditLabel[s.credit]?.label ?? s.credit }}<template v-if="s.credit === 'a_liberar' && s.release_date"> em {{ dateShort(s.release_date) }}</template></span>
                  </td>
                  <td class="px-2 py-1.5 text-right" data-numeric>{{ brl(s.expected) }}</td>
                  <td class="px-2 py-1.5 text-right" data-numeric>{{ brl(s.mp_net) }}</td>
                  <td class="px-2 py-1.5 text-right" data-numeric>{{ brl(s.credited) }}</td>
                  <td class="px-2 py-1.5 text-right font-semibold" :class="diffClass(s.diff)" data-numeric>{{ signed(s.diff) }}</td>
                </tr>
                <tr v-if="open === s.key" class="border-b border-line bg-surface-2">
                  <td colspan="6" class="px-3 py-2">
                    <div class="grid gap-3 text-[12px] md:grid-cols-4">
                      <div :class="toneBox.neutral" class="rounded-card border p-2">
                        <p class="font-semibold text-ink">1. Previsto no Lunna</p>
                        <p>Receita {{ brl(s.revenue) }}</p><p>Tarifa −{{ brl(s.lunna_fee) }}</p><p>Frete (etiqueta) −{{ brl(s.lunna_shipping) }}</p>
                        <p class="font-semibold">Líquido {{ brl(s.expected) }}</p>
                      </div>
                      <div :class="toneBox.neutral" class="rounded-card border p-2">
                        <p class="font-semibold text-ink">2. Faturado pelo ML</p>
                        <template v-if="s.billed"><p>Tarifa {{ brl(s.billed_fee) }}</p><p>Frete {{ brl(s.billed_shipping) }}</p></template>
                        <p v-else class="text-ink-3">Ainda não está no extrato de faturamento.</p>
                      </div>
                      <div :class="toneBox.neutral" class="rounded-card border p-2">
                        <p class="font-semibold text-ink">3. Pagamento no Mercado Pago</p>
                        <p>Pago {{ brl(s.mp_gross) }}</p><p>Tarifas −{{ brl(s.mp_fee) }}</p><p>Frete −{{ brl(s.mp_shipping) }}</p>
                        <p v-if="s.buyer_paid">Comprador pagou do frete +{{ brl(s.buyer_paid) }}</p>
                        <p v-if="s.mp_coupon" class="text-warning">Cupom do vendedor −{{ brl(s.mp_coupon) }}</p>
                        <p v-if="s.mp_other">Outros −{{ brl(s.mp_other) }}</p>
                        <p class="font-semibold">Líquido {{ brl(s.mp_net) }}</p>
                        <p class="text-[11px] text-ink-3">{{ s.payment_statuses.join(', ') || 'sem pagamento' }} · {{ s.payment_ids.join(', ') }}</p>
                      </div>
                      <div :class="toneBox.neutral" class="rounded-card border p-2">
                        <p class="font-semibold text-ink">4. Crédito na conta</p>
                        <p>Creditado {{ brl(s.credited) }}</p>
                        <p v-if="s.release_date">Liberação {{ dateShort(s.release_date) }}</p>
                        <p v-if="s.shipment_id" class="text-[11px] text-ink-3">Envio {{ s.shipment_id }}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- movimentos da conta -->
      <div class="card p-4" data-test="repasses-conta">
        <h2 class="section-title mb-1">Movimentos da conta do Mercado Pago no período</h2>
        <p class="mb-3 text-[12px] text-ink-3">{{ data.account.note }}</p>
        <div class="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div><p class="text-[12px] text-ink-3">Saldo no início</p><p class="text-[16px] font-semibold" data-numeric>{{ data.account.opening === null ? '—' : brl(data.account.opening) }}</p></div>
          <div><p class="text-[12px] text-ink-3">Entradas</p><p class="text-[16px] font-semibold text-success" data-numeric>{{ brl(data.account.credits) }}</p><p class="text-[11px] text-ink-3">{{ data.period.previous_label }}: {{ brl(data.account.previous_credits) }}</p></div>
          <div><p class="text-[12px] text-ink-3">Saídas</p><p class="text-[16px] font-semibold text-danger" data-numeric>{{ brl(data.account.debits) }}</p><p class="text-[11px] text-ink-3">{{ data.period.previous_label }}: {{ brl(data.account.previous_debits) }}</p></div>
          <div><p class="text-[12px] text-ink-3">Saldo no fim</p><p class="text-[16px] font-semibold" data-numeric>{{ data.account.closing === null ? '—' : brl(data.account.closing) }}</p></div>
        </div>
        <table class="w-full text-[12px]">
          <thead><tr class="border-b border-line text-ink-2"><th class="py-1 text-left font-semibold">Movimento</th><th class="py-1 text-right font-semibold">Qtde</th><th class="py-1 text-right font-semibold">Entradas</th><th class="py-1 text-right font-semibold">Saídas</th><th class="py-1 text-right font-semibold">Líquido</th><th class="py-1 text-right font-semibold">{{ data.period.previous_label }}</th></tr></thead>
          <tbody>
            <tr v-for="r in data.account.rows" :key="r.key" class="border-b border-line">
              <td class="py-1.5 text-ink">{{ r.label }}</td>
              <td class="py-1.5 text-right text-ink-3" data-numeric>{{ int(r.count) }}</td>
              <td class="py-1.5 text-right" data-numeric>{{ r.credit ? brl(r.credit) : '—' }}</td>
              <td class="py-1.5 text-right" data-numeric>{{ r.debit ? brl(r.debit) : '—' }}</td>
              <td class="py-1.5 text-right font-semibold" :class="r.net < 0 ? 'text-danger' : r.net > 0 ? 'text-success' : 'text-ink-3'" data-numeric>{{ signed(r.net) }}</td>
              <td class="py-1.5 text-right text-ink-2" data-numeric>{{ signed(r.previous) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="data.account.reserves.length" class="mt-3 rounded-card border border-warning bg-warning-soft p-2 text-[12px]" data-test="repasses-reservas">
          <p class="font-semibold text-ink">Valores retidos até o fim do período</p>
          <ul class="mt-1 space-y-0.5">
            <li v-for="r in data.account.reserves" :key="r.key" class="flex justify-between gap-3"><span>{{ r.label }}</span><span data-numeric>{{ brl(Math.abs(r.amount)) }}</span></li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>
