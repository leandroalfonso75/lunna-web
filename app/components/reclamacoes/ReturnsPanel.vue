<script setup lang="ts">
import { ArrowDownTrayIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/vue/24/outline'
import { computed, ref } from 'vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import { useSessionStore } from '../../stores/session'
import { brl, dateShort, dateTimeShort, int } from '../../lib/format'
import type { ReturnRow, ReturnsResponse, ReturnsTab } from '../../types/claims'

/**
 * Card Devoluções (pedido do usuário em 05/11/2026): as devoluções liberadas pelo Mercado Livre em quatro guias —
 * Expiradas (liberadas e não efetivadas), Sem custo, Com custos (itemizados: frete de envio retido, frete de
 * devolução, tarifas da venda não devolvidas, reembolso parcial, outras) e Em andamento — com totais, principais
 * motivos, o extrato de cada venda e exportação em CSV.
 */
const props = defineProps<{ data: ReturnsResponse | null; loading: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const { $api } = useNuxtApp()
const session = useSessionStore()
const toast = useToast()

/**
 * "Ok, nota de retorno emitida" (pedido do usuário em 13/11/2026): tira a devolução de SEM NOTA na hora. Ela volta só se
 * a próxima rodada de conferência (a diária, às 5h) não achar a nota no ML (Full) ou no Olist (Agência/Flex).
 */
const declaring = ref<number | null>(null)
const hiddenNow = ref<Set<number>>(new Set())
async function declareInvoice(r: ReturnRow) {
  declaring.value = r.claim_id
  try {
    await $api(`/api/claims/${r.claim_id}/return_invoice_declared`, { method: 'POST', query: { account_id: session.selectedAccountId } })
    hiddenNow.value = new Set([...hiddenNow.value, r.claim_id])
    toast.success('Marcada como emitida. Se a próxima conferência não achar a nota, ela volta para SEM NOTA.')
    emit('changed')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível marcar agora.'))
  } finally {
    declaring.value = null
  }
}

const tab = ref<ReturnsTab>('com_custos')
const open = ref<number | null>(null)
const sort = ref<'date' | 'cost' | 'refund'>('date')

const TABS: { key: ReturnsTab; label: string; hint: string; tone: string }[] = [
  { key: 'expiradas', label: 'Expiradas', tone: 'text-ink-2', hint: 'Devolução liberada, mas não efetivada: o comprador perdeu o prazo de postagem ou desistiu.' },
  { key: 'sem_custo', label: 'Sem custo', tone: 'text-success', hint: 'Produto devolvido sem nenhum custo para você: frete de devolução grátis e frete de envio reintegrado pelo ML.' },
  { key: 'com_custos', label: 'Com custos', tone: 'text-danger', hint: 'Produto devolvido com custo para você. Cada custo aparece separado.' },
  { key: 'em_andamento', label: 'Em andamento', tone: 'text-warning', hint: 'Etiqueta gerada ou produto a caminho: ainda sem resultado.' },
  { key: 'sem_nota', label: 'Sem nota de devolução', tone: 'text-danger', hint: 'Produtos que voltaram e ainda não têm nota fiscal de devolução. No Full, emita pelo Mercado Livre (Detalhe da venda › Ver detalhes da NF-e); em Agência e Flex, pelo ERP (nota de entrada). O Lunna confere de novo a cada 6 horas.' }
]
/** Cor da situação da nota de devolução. */
const INVOICE_TONE: Record<string, string> = { com_nota: 'text-success', sem_nota: 'text-danger', aguardando: 'text-ink-3', nao_se_aplica: 'text-ink-3', sem_dados: 'text-ink-3' }
const KIND_LABELS: Record<string, string> = {
  frete_envio: 'Frete de envio retido', frete_devolucao: 'Frete de devolução', tarifa_venda: 'Tarifas da venda não devolvidas',
  reembolso_parcial: 'Reembolso parcial', outro: 'Outras cobranças'
}
const CATEGORY: Record<string, string> = { envio: 'Envio', devolucao: 'Devolução', venda: 'Venda', outro: 'Outro' }

const rows = computed<ReturnRow[]>(() => {
  const list = (props.data?.tabs[tab.value] ?? []).filter((r) => tab.value !== 'sem_nota' || !hiddenNow.value.has(r.claim_id))
  if (sort.value === 'cost') list.sort((a, b) => b.costs.total - a.costs.total)
  else if (sort.value === 'refund') list.sort((a, b) => (b.refund.amount ?? 0) - (a.refund.amount ?? 0))
  return list
})
const tabCost = computed(() => rows.value.reduce((s, r) => s + r.costs.total, 0))
const tabRefund = computed(() => rows.value.reduce((s, r) => s + (r.refund.amount ?? 0), 0))

function tone(t: string) {
  return { ok: 'pill-success', warn: 'pill-warning', bad: 'pill-danger', neutral: 'pill-neutral' }[t] ?? 'pill-neutral'
}

/** CSV da guia atual: uma linha por devolução, com os custos em colunas. */
function exportCsv() {
  const head = ['Reclamação', 'Venda', 'Aberta em', 'Devolução em', 'Situação', 'Motivo', 'Comprador', 'Produto', 'SKU', 'Envio', 'Valor da venda', 'Reembolso', 'Frete de envio retido', 'Frete de devolução', 'Tarifas não devolvidas', 'Reembolso parcial', 'Outras cobranças', 'Custo total', 'Observações', 'Nota de Devolução']
  const money = (v: number | null | undefined) => (v === null || v === undefined ? '' : v.toFixed(2).replace('.', ','))
  const kind = (r: ReturnRow, k: string) => money(r.costs.items.filter((i) => i.key === k).reduce((s, i) => s + i.amount, 0) || null)
  const lines = rows.value.map((r) => [
    r.claim_id, r.order_id ?? '', dateShort(r.opened_at), r.closed_at ? dateShort(r.closed_at) : '', r.status.label, r.reason ?? '', r.buyer ?? '',
    r.item?.title ?? '', r.item?.sku ?? '', r.logistic ?? '', money(r.order_total), money(r.refund.amount),
    kind(r, 'frete_envio'), kind(r, 'frete_devolucao'), kind(r, 'tarifa_venda'), kind(r, 'reembolso_parcial'), kind(r, 'outro'), money(r.costs.total), r.costs.notes.join(' | '), r.return_invoice?.label ?? ''
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
  const blob = new Blob(['﻿' + [head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `devolucoes-${tab.value}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <div class="space-y-3" data-test="devolucoes-painel">
    <p class="text-[13px] text-ink-2">
      Devoluções liberadas pelo Mercado Livre no período escolhido acima. Os custos vêm do extrato de faturamento da sua conta
      (cobrança menos o que o ML devolveu) e do custo de devolução que o ML informa por reclamação.
      <template v-if="data?.billing.synced_at"> Extrato lido em {{ dateTimeShort(data.billing.synced_at) }}<template v-if="data.billing.periods.length"> (períodos {{ data.billing.periods.join(', ') }})</template>.</template>
    </p>

    <!-- resumo -->
    <div v-if="data" class="grid grid-cols-2 gap-3 md:grid-cols-4" data-test="devolucoes-resumo">
      <div class="card p-3">
        <p class="text-[12px] text-ink-3">Custo total das devolvidas</p>
        <p class="text-[22px] font-bold text-danger" data-numeric>{{ brl(data.summary.total_cost) }}</p>
        <p class="text-[11px] text-ink-3">{{ int(data.summary.counts.com_custos) }} com custo · {{ int(data.summary.counts.sem_custo) }} sem custo</p>
      </div>
      <div class="card p-3">
        <p class="text-[12px] text-ink-3">Por tipo de custo</p>
        <ul class="text-[12px] text-ink">
          <li v-for="(v, k) in data.summary.by_kind" :key="k" class="flex justify-between gap-2"><span>{{ KIND_LABELS[k] ?? k }}</span><span data-numeric>{{ brl(v) }}</span></li>
          <li v-if="!Object.keys(data.summary.by_kind).length" class="text-ink-3">—</li>
        </ul>
      </div>
      <div class="card p-3">
        <p class="text-[12px] text-ink-3">Dinheiro devolvido aos compradores</p>
        <p class="text-[22px] font-bold text-ink" data-numeric>{{ brl(data.summary.refunded_total) }}</p>
        <p class="text-[11px] text-ink-3">nas devoluções efetivadas (o produto voltou)</p>
      </div>
      <div class="card p-3">
        <p class="text-[12px] text-ink-3">Motivos que mais custam</p>
        <ul class="text-[12px] text-ink">
          <li v-for="m in data.summary.by_reason.slice(0, 3)" :key="m.reason ?? ''" class="flex justify-between gap-2">
            <span class="truncate" :title="m.reason ?? ''">{{ m.reason ?? '—' }} ({{ m.count }})</span><span data-numeric>{{ brl(m.cost) }}</span>
          </li>
          <li v-if="!data.summary.by_reason.length" class="text-ink-3">—</li>
        </ul>
      </div>
    </div>

    <!-- guias -->
    <div class="flex flex-wrap items-end gap-1 border-b-2 border-line" role="tablist" aria-label="Devoluções">
      <button
        v-for="t in TABS"
        :key="t.key"
        type="button"
        role="tab"
        class="-mb-0.5 rounded-t-card border-b-4 px-4 py-2 text-[14px] font-semibold"
        :class="tab === t.key ? 'border-primary bg-primary-soft text-primary' : 'border-transparent text-ink-2 hover:bg-surface-2'"
        :aria-selected="tab === t.key"
        :title="t.hint"
        :data-test="`guia-devolucoes-${t.key}`"
        @click="tab = t.key; open = null"
      >{{ t.label }} <span class="ml-1 rounded-full bg-surface px-2 text-[12px]" :class="t.tone">{{ int(data?.summary.counts[t.key] ?? 0) }}</span></button>
    </div>
    <p class="text-[12px] text-ink-3">{{ TABS.find((t) => t.key === tab)?.hint }}</p>

    <div class="flex flex-wrap items-center gap-3 text-[12px]">
      <span class="text-ink-2">Ordenar:</span>
      <button v-for="s in ([['date', 'Mais recentes'], ['cost', 'Maior custo'], ['refund', 'Maior reembolso']] as const)" :key="s[0]" type="button" class="rounded-md px-2 py-1" :class="sort === s[0] ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2 hover:bg-surface-2'" @click="sort = s[0]">{{ s[1] }}</button>
      <span v-if="tab === 'com_custos' || tab === 'sem_custo'" class="ml-auto text-ink-2">
        {{ int(rows.length) }} devoluções · reembolsado {{ brl(tabRefund) }}<template v-if="tab === 'com_custos'"> · custo {{ brl(tabCost) }}</template>
      </span>
      <button type="button" class="btn-link" :class="tab === 'com_custos' || tab === 'sem_custo' ? '' : 'ml-auto'" :disabled="!rows.length" @click="exportCsv"><ArrowDownTrayIcon class="inline h-4 w-4" aria-hidden="true" /> Exportar (CSV)</button>
    </div>

    <p v-if="loading && !data" class="card p-6 text-center text-ink-3">Carregando…</p>
    <p v-else-if="data && !rows.length" class="card p-6 text-center text-ink-3">Nenhuma devolução nesta guia no período.</p>

    <div v-else-if="data" class="card overflow-hidden">
      <table class="w-full table-fixed border-collapse text-[12px]">
        <thead>
          <tr class="border-b border-line text-ink-2">
            <th class="w-[23%] px-2 py-2 text-left font-semibold">Venda / produto</th>
            <th class="w-[10%] px-2 py-2 text-left font-semibold">Devolução</th>
            <th class="w-[18%] px-2 py-2 text-left font-semibold">Motivo</th>
            <th class="w-[10%] px-2 py-2 text-right font-semibold">Reembolso</th>
            <th class="w-[21%] px-2 py-2 text-left font-semibold">Custos para você</th>
            <th class="w-[8%] px-2 py-2 text-right font-semibold">Total</th>
            <th class="w-[10%] px-2 py-2 text-left font-semibold">Nota de Devolução</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="r in rows" :key="r.claim_id">
            <tr class="cursor-pointer border-b border-line align-top hover:bg-surface-2" data-test="devolucao-linha" @click="open = open === r.claim_id ? null : r.claim_id">
              <td class="px-2 py-2">
                <div class="flex gap-2">
                  <img v-if="r.item?.thumbnail" :src="r.item.thumbnail" alt="" class="h-10 w-10 shrink-0 rounded object-cover" loading="lazy" />
                  <div class="min-w-0">
                    <p class="truncate font-medium text-ink" :title="r.item?.title ?? ''">{{ r.item?.title ?? 'Venda fora do Lunna' }}</p>
                    <p class="text-[11px] text-ink-3">
                      <template v-if="r.order_id">Venda #{{ r.order_id }} · </template>{{ r.item?.sku ?? 'sem SKU' }}<template v-if="r.logistic"> · {{ r.logistic }}</template>
                      <template v-if="r.order_total !== null"> · {{ brl(r.order_total) }}</template>
                    </p>
                    <p class="text-[11px] text-ink-3">Reclamação #{{ r.claim_id }} · aberta em {{ dateShort(r.opened_at) }}<template v-if="r.buyer"> · {{ r.buyer }}</template></p>
                  </div>
                </div>
              </td>
              <td class="px-2 py-2">
                <span class="pill" :class="tone(r.status.tone)">{{ r.status.label }}</span>
                <p v-if="r.closed_at" class="mt-0.5 text-[11px] text-ink-3">{{ dateShort(r.closed_at) }}</p>
                <p v-if="r.affects_reputation" class="text-[11px] font-semibold text-danger">afeta a reputação</p>
              </td>
              <td class="px-2 py-2 text-ink">{{ r.reason ?? '—' }}</td>
              <td class="px-2 py-2 text-right" data-numeric>
                <span class="block text-ink">{{ r.refund.amount !== null ? brl(r.refund.amount) : '—' }}</span>
                <span class="text-[11px] text-ink-3">{{ r.refund.label ?? '' }}</span>
              </td>
              <td class="px-2 py-2">
                <ul v-if="r.costs.items.length" class="space-y-0.5">
                  <li v-for="(i, k) in r.costs.items" :key="k" class="flex justify-between gap-2" :title="i.detail ?? ''">
                    <span class="text-ink">{{ i.label }}</span><span class="text-danger" data-numeric>{{ brl(i.amount) }}</span>
                  </li>
                </ul>
                <span v-else-if="r.tab === 'sem_custo'" class="font-semibold text-success">Nenhum custo</span>
                <span v-else class="text-ink-3">—</span>
                <p v-for="(n, k) in r.costs.notes" :key="k" class="text-[11px] text-warning">{{ n }}</p>
              </td>
              <td class="px-2 py-2 text-right font-semibold" :class="r.costs.total > 0 ? 'text-danger' : 'text-ink'" data-numeric>
                {{ r.costs.total > 0 ? brl(r.costs.total) : '—' }}
                <component :is="open === r.claim_id ? ChevronUpIcon : ChevronDownIcon" class="ml-1 inline h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
              </td>
              <td class="px-2 py-2" data-test="nota-devolucao" @click.stop>
                <template v-if="r.return_invoice">
                  <span class="font-semibold" :class="INVOICE_TONE[r.return_invoice.state]" data-numeric>{{ r.return_invoice.label }}</span>
                  <span v-if="r.return_invoice.state === 'com_nota'" class="block text-[11px] text-ink-3">{{ r.return_invoice.source === 'ml' ? 'emitida pelo ML' : 'entrada no ERP' }}<template v-if="r.return_invoice.issued_at"> · {{ dateShort(r.return_invoice.issued_at) }}</template></span>
                  <span v-if="r.return_invoice.state === 'emitida'" class="block text-[11px] text-ink-3">conferência na próxima rodada</span>
                  <span v-if="r.return_invoice.not_found_after_declared" class="block text-[11px] text-warning">marcada como emitida, mas não encontrada</span>
                  <a v-if="r.return_invoice.emit_link" :href="r.return_invoice.emit_link" target="_blank" rel="noopener" class="btn-link block text-[11px]" data-test="emitir-nota">emitir nota</a>
                  <button
                    v-if="r.return_invoice.state === 'sem_nota'" type="button" class="btn-secondary mt-1 h-7 px-2 text-[11px] leading-tight"
                    :disabled="declaring === r.claim_id" data-test="nota-emitida" @click="declareInvoice(r)"
                  >{{ declaring === r.claim_id ? 'Marcando…' : 'Ok, nota de retorno emitida' }}</button>
                </template>
                <span v-else class="text-ink-3">—</span>
              </td>
            </tr>
            <tr v-if="open === r.claim_id" class="border-b border-line bg-surface-2" data-test="devolucao-extrato">
              <td colspan="7" class="px-4 py-3">
                <div class="grid gap-4 md:grid-cols-2">
                  <div class="text-[12px]">
                    <p class="mb-1 font-semibold text-ink">Dados da devolução</p>
                    <dl class="grid grid-cols-[140px_1fr] gap-y-0.5">
                      <dt class="text-ink-3">Situação no ML</dt><dd class="text-ink">{{ r.status.label }}<template v-if="r.status.raw"> ({{ r.status.raw }})</template></dd>
                      <dt class="text-ink-3">Dinheiro</dt><dd class="text-ink">{{ r.money === 'refunded' ? 'devolvido ao comprador' : r.money === 'retained' ? 'retido pelo ML' : r.money ?? '—' }}</dd>
                      <dt class="text-ink-3">Rastreio</dt><dd class="text-ink">{{ r.tracking ?? '—' }}</dd>
                      <dt class="text-ink-3">Cobertura do ML</dt><dd class="text-ink">{{ r.coverage === true ? 'Sim' : r.coverage === false ? 'Não' : '—' }}</dd>
                      <dt class="text-ink-3">Reclamação</dt><dd class="text-ink">{{ r.claim_status === 'opened' ? 'aberta' : 'encerrada' }}</dd>
                    </dl>
                    <a v-if="r.link" :href="r.link" target="_blank" rel="noopener" class="btn-link mt-2 inline-block">Abrir a venda no Mercado Livre</a>
                  </div>
                  <div class="text-[12px]">
                    <p class="mb-1 font-semibold text-ink">Extrato do Mercado Livre desta venda</p>
                    <table v-if="r.costs.statement.length" class="w-full">
                      <tbody>
                        <tr v-for="(l, k) in r.costs.statement" :key="k" class="border-t border-line">
                          <td class="py-1 pr-2 text-ink-3">{{ l.date ? dateShort(l.date) : '' }}</td>
                          <td class="py-1 pr-2 text-ink">{{ l.label }} <span class="text-ink-3">· {{ CATEGORY[l.category] }}</span></td>
                          <td class="py-1 text-right" :class="l.amount < 0 ? 'text-success' : 'text-ink'" data-numeric>{{ l.amount < 0 ? '−' : '' }}{{ brl(Math.abs(l.amount)) }}</td>
                        </tr>
                      </tbody>
                    </table>
                    <p v-else class="text-ink-3">Sem linhas do extrato para esta venda (o Lunna guarda o período aberto e o anterior).</p>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
