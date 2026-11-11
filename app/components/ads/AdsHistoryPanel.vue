<script setup lang="ts">
import { computed } from 'vue'
import { brl, dateShort, dateTimeShort, num } from '../../lib/format'
import type { AdsAnalysis, AdsHistoryItem, AdsMetricsWindow } from '../../types/ads'

/**
 * Ads › Análise › Histórico de Ações (pedido do usuário em 10/11/2026). Cada ação marcada como "Feito" fica aqui até a
 * revisão (8º dia). Na revisão: a evolução do anúncio/campanha desde a alteração, as sugestões atuais do mesmo item
 * (com "Marcar como feito" e "Ignorar") e os botões "Aguardar mais 7 dias" e "Arquivar". Ignoradas ficam listadas no
 * fim, com a data em que podem voltar para a Análise (15 dias, se o problema seguir). Regras em docs/secoes/ads.md.
 */
const props = defineProps<{ data: AdsAnalysis; isAdmin: boolean }>()
const emit = defineEmits<{
  decide: [key: string, signal: string, status: 'feito' | 'ignorado', parentId?: number]
  review: [id: number, op: 'aguardar' | 'arquivar']
  undecide: [id: number]
}>()

const due = computed(() => props.data.history.filter((h) => h.due))
const waiting = computed(() => props.data.history.filter((h) => !h.due))

const CLASS_TONE: Record<string, string> = {
  destravar: 'bg-success-soft text-success', desperdicio: 'bg-danger-soft text-danger', alocacao: 'bg-warning-soft text-warning',
  orcamento: 'bg-primary-soft text-primary', posicao: 'bg-primary-soft text-primary', ajuste: 'bg-surface-2 text-ink-2',
  estrutura: 'bg-primary-soft text-primary'
}

const roas = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${num(v, 2)}x`)
const perDay = (w: { cost?: number; revenue?: number; days?: number } | null | undefined, field: 'cost' | 'revenue', days = 7) =>
  w && w[field] !== undefined ? (w[field] ?? 0) / (w.days ?? days) : null

/** Linhas da evolução: antes (7 dias fechados antes da decisão), 1ª semana depois, últimos 7 dias e desde a alteração (média por dia). */
function rows(h: AdsHistoryItem) {
  const out: { label: string; period: string; cost: number | null; revenue: number | null; roas: number | null | undefined }[] = []
  const b = h.before
  out.push({ label: 'Antes', period: b.period ? `${dateShort(b.period.from)} a ${dateShort(b.period.to)}` : '7 dias antes', cost: b.cost ?? null, revenue: b.revenue ?? null, roas: b.roas })
  const add = (label: string, w: AdsMetricsWindow | null) => {
    if (w) out.push({ label, period: `${dateShort(w.from)} a ${dateShort(w.to)}${w.partial ? ` (${w.days} dias)` : ''}`, cost: w.cost, revenue: w.revenue, roas: w.roas })
  }
  add('1ª semana depois', h.after)
  if (h.evolution.last_week?.from !== h.after?.from) add('Últimos 7 dias', h.evolution.last_week)
  return out
}

/** Resumo em uma frase: compara a média por dia desde a alteração com a semana de antes. */
function verdict(h: AdsHistoryItem) {
  const s = h.evolution.since
  if (!s) return 'Ainda sem dia fechado depois da alteração.'
  const bc = perDay(h.before, 'cost')
  const br = perDay(h.before, 'revenue')
  const sc = perDay(s, 'cost')
  const sr = perDay(s, 'revenue')
  const change = (now: number | null, was: number | null) => {
    if (now === null || was === null) return '—'
    if (was === 0) return now === 0 ? 'igual' : 'saiu do zero'
    const p = Math.round(((now - was) / was) * 100)
    return p === 0 ? 'igual' : `${p > 0 ? '+' : ''}${p}%`
  }
  return `Desde a alteração (${s.days} ${s.days === 1 ? 'dia' : 'dias'}, ${dateShort(s.from)} a ${dateShort(s.to)}): por dia, investimento ${brl(sc ?? 0)} (${change(sc, bc)}), receita por Ads ${brl(sr ?? 0)} (${change(sr, br)}), ROAS ${roas(s.roas)} (antes ${roas(h.before.roas)}).`
}

function followText(f: AdsHistoryItem['follow_ups'][number]) {
  if (f.type === 'aguardar') return `${dateTimeShort(f.at)}: aguardar mais 7 dias${f.user ? ` (${f.user})` : ''}`
  return `${dateTimeShort(f.at)}: feito — ${f.title ?? ''}${f.action ? `: ${f.action}` : ''}${f.user ? ` (${f.user})` : ''}`
}
</script>

<template>
  <div class="space-y-4 text-[13px]" data-test="historico-acoes">
    <p class="text-[12px] text-ink-3">
      As ações marcadas como "Feito" ficam aqui até o 8º dia. Nesse dia aparece a evolução do anúncio ou da campanha desde a alteração e, se houver,
      novas sugestões. Aguardar mais 7 dias ou marcar uma nova sugestão como feita mantém a ação aqui por mais 7 dias; Arquivar tira do histórico.
      Sugestões ignoradas saem da Análise por 15 dias e só voltam se o problema seguir.
    </p>

    <div class="card p-4" data-test="historico-revisar">
      <p class="font-semibold text-ink">Para revisar <span class="text-[12px] font-normal text-ink-3">({{ due.length }})</span></p>
      <p v-if="!due.length" class="mt-2 text-ink-3">Nenhuma ação chegou ao dia da revisão.</p>
      <ul class="mt-3 space-y-3">
        <li v-for="h in due" :key="h.id" class="rounded-card border border-primary p-3" :data-test="`revisar-${h.id}`">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">Revisão</span>
            <span class="rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="CLASS_TONE[h.class]">{{ h.class_label }}</span>
            <span class="font-medium text-ink">{{ h.title }}</span>
            <span v-if="h.campaigns_now?.length" class="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">hoje na campanha {{ h.campaigns_now.join(', ') }}</span>
            <span class="text-[12px] text-ink-3">feito em {{ dateTimeShort(h.decided_at) }}<template v-if="h.user"> · {{ h.user }}</template></span>
          </div>
          <p class="mt-1 text-ink-2"><span class="font-medium">O que foi feito:</span> {{ h.action }}</p>
          <ul v-if="h.follow_ups.length" class="mt-1 space-y-0.5 text-[12px] text-ink-3">
            <li v-for="(f, k) in h.follow_ups" :key="k">{{ followText(f) }}</li>
          </ul>

          <div class="mt-2 rounded-card bg-surface-2 p-3" data-test="evolucao">
            <p class="text-[12px] font-semibold uppercase tracking-wide text-ink-3">Evolução desde a alteração</p>
            <table class="mt-1 w-full text-[12px]">
              <thead class="text-left text-ink-3">
                <tr><th class="py-0.5 pr-2 font-medium">Período</th><th class="py-0.5 pr-2 text-right font-medium">Investimento</th><th class="py-0.5 pr-2 text-right font-medium">Receita por Ads</th><th class="py-0.5 text-right font-medium">ROAS</th></tr>
              </thead>
              <tbody>
                <tr v-for="r in rows(h)" :key="r.label" class="border-t border-line">
                  <td class="py-0.5 pr-2"><span class="font-medium text-ink">{{ r.label }}</span> <span class="text-ink-3">· {{ r.period }}</span></td>
                  <td class="py-0.5 pr-2 text-right" data-numeric>{{ r.cost === null ? '—' : brl(r.cost) }}</td>
                  <td class="py-0.5 pr-2 text-right" data-numeric>{{ r.revenue === null ? '—' : brl(r.revenue) }}</td>
                  <td class="py-0.5 text-right" data-numeric>{{ roas(r.roas) }}</td>
                </tr>
              </tbody>
            </table>
            <p class="mt-1 text-ink">{{ verdict(h) }}</p>
          </div>

          <div class="mt-2" data-test="novas-sugestoes">
            <p class="text-[12px] font-semibold uppercase tracking-wide text-ink-3">Sugestões agora</p>
            <p v-if="!h.suggestions.length" class="mt-1 text-ink-2">Nenhuma sugestão nova para este item: o problema não aparece mais na análise.</p>
            <ul class="mt-1 space-y-2">
              <li v-for="s in h.suggestions" :key="`${s.key}-${s.signal}`" class="rounded-card border border-line p-2">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="CLASS_TONE[s.class]">{{ s.class_label }}</span>
                  <span v-if="s.persists" class="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">o mesmo problema continua</span>
                  <span class="font-medium text-ink">{{ s.title }}</span>
                  <span v-if="s.value != null" class="ml-auto text-[12px] font-semibold text-ink" data-numeric>{{ brl(s.value) }}</span>
                </div>
                <p v-if="s.situation" class="mt-1 text-ink">{{ s.situation }}</p>
                <ol v-if="s.steps?.length" class="mt-1 list-decimal space-y-0.5 pl-5 text-ink">
                  <li v-for="(st, k) in s.steps" :key="k">{{ st }}</li>
                </ol>
                <p v-if="!s.situation && s.action" class="mt-1 text-ink"><span class="font-medium">Ação:</span> {{ s.action }}</p>
                <div v-if="isAdmin" class="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                  <button type="button" class="btn-secondary h-7 px-2.5 text-[12px]" :data-test="`sugestao-feito-${h.id}`" @click="emit('decide', s.key, s.signal, 'feito', h.id)">Marcar como feito</button>
                  <button type="button" class="btn-link" @click="emit('decide', s.key, s.signal, 'ignorado', h.id)">Ignorar</button>
                </div>
              </li>
            </ul>
          </div>

          <div v-if="isAdmin" class="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2">
            <button type="button" class="btn-secondary h-8 px-3 text-[12px]" :data-test="`aguardar-${h.id}`" @click="emit('review', h.id, 'aguardar')">Aguardar mais 7 dias</button>
            <button type="button" class="btn-secondary h-8 px-3 text-[12px]" :data-test="`arquivar-${h.id}`" @click="emit('review', h.id, 'arquivar')">Arquivar</button>
          </div>
        </li>
      </ul>
    </div>

    <div class="card p-4" data-test="historico-aguardando">
      <p class="font-semibold text-ink">Aguardando o 8º dia <span class="text-[12px] font-normal text-ink-3">({{ waiting.length }})</span></p>
      <p v-if="!waiting.length" class="mt-2 text-ink-3">Nenhuma ação em espera. Marque as sugestões da Análise como feitas para acompanhar o efeito aqui.</p>
      <ul class="mt-2 space-y-2 text-[12px]">
        <li v-for="h in waiting" :key="h.id" class="rounded-card border border-line p-2">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full bg-success-soft px-2 py-0.5 font-semibold text-success">Feito</span>
            <span class="rounded-full px-1.5 text-[10px] font-semibold" :class="CLASS_TONE[h.class]">{{ h.class_label }}</span>
            <span class="font-medium text-ink">{{ h.title }}</span>
            <span v-if="h.campaigns_now?.length" class="rounded-full bg-primary-soft px-2 py-0.5 font-semibold text-primary">hoje na campanha {{ h.campaigns_now.join(', ') }}</span>
            <span class="text-ink-3">{{ dateTimeShort(h.decided_at) }}<template v-if="h.user"> · {{ h.user }}</template></span>
            <span class="ml-auto font-medium text-ink-2">revisão em {{ dateShort(h.review_at) }} ({{ h.days_left === 1 ? 'falta 1 dia' : `faltam ${h.days_left} dias` }})</span>
            <button v-if="isAdmin" type="button" class="btn-link" @click="emit('undecide', h.id)">desfazer</button>
          </div>
          <p class="mt-1 text-ink-2">{{ h.action }}</p>
          <ul v-if="h.follow_ups.length" class="mt-1 space-y-0.5 text-ink-3">
            <li v-for="(f, k) in h.follow_ups" :key="k">{{ followText(f) }}</li>
          </ul>
          <p class="mt-1 text-ink-3">{{ verdict(h) }}</p>
        </li>
      </ul>
    </div>

    <details class="card p-4" data-test="historico-ignoradas">
      <summary class="cursor-pointer select-none font-semibold text-ink">Ignoradas nos últimos 15 dias <span class="text-[12px] font-normal text-ink-3">({{ data.ignored.length }})</span></summary>
      <p v-if="!data.ignored.length" class="mt-2 text-ink-3">Nenhuma sugestão ignorada.</p>
      <ul class="mt-2 space-y-2 text-[12px]">
        <li v-for="d in data.ignored" :key="d.id" class="rounded-card border border-line p-2">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full bg-surface-2 px-2 py-0.5 font-semibold text-ink-2">Ignorado</span>
            <span class="font-medium text-ink">{{ d.title }}</span>
            <span class="text-ink-3">{{ dateTimeShort(d.decided_at) }}<template v-if="d.user"> · {{ d.user }}</template></span>
            <span class="ml-auto text-ink-2">pode voltar para a Análise em {{ dateShort(d.back_on) }}, se o problema seguir</span>
            <button v-if="isAdmin" type="button" class="btn-link" @click="emit('undecide', d.id)">desfazer</button>
          </div>
          <p class="mt-1 text-ink-2">{{ d.action }}</p>
        </li>
      </ul>
    </details>
  </div>
</template>
