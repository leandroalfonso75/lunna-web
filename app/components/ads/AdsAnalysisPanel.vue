<script setup lang="ts">
import { computed, ref } from 'vue'
import { brl, dateShort, int, pct } from '../../lib/format'
import type { AdsAnalysis, AdsAnalysisFamily, AdsAnalysisQueueItem } from '../../types/ads'

/**
 * Aba Análise da seção Ads: saúde da conta (com TACOS), a fila de decisões ordenada por dinheiro em jogo, os
 * intocáveis, o leilão por campanha e as famílias (produtos) com sinais. Só recomenda: quem aplica é o operador, no
 * Seller Center. Regras e contas em docs/secoes/ads.md ("Análise").
 */
const props = defineProps<{ data: AdsAnalysis | null; loading: boolean; error: string }>()

const CLASS_TONE: Record<string, string> = {
  destravar: 'bg-success-soft text-success', desperdicio: 'bg-danger-soft text-danger', alocacao: 'bg-warning-soft text-warning',
  orcamento: 'bg-primary-soft text-primary', posicao: 'bg-primary-soft text-primary', ajuste: 'bg-surface-2 text-ink-2'
}
const SIGNAL_LABEL: Record<string, string> = {
  saiu_do_ar_com_historico: 'Saiu do ar com histórico', gasto_sem_receita: 'Gastou e não vendeu', impressao_sem_clique: 'Impressões sem clique',
  abaixo_do_equilibrio: 'Abaixo do equilíbrio', familia_com_multiplos_anuncios_ativos: 'Vários anúncios ativos', capa_suspeita: 'Capa suspeita',
  idle_recomendado: 'Recomendado fora de campanha', exposicao_perdida_por_orcamento: 'Perde por orçamento', exposicao_perdida_por_ad_rank: 'Perde por classificação'
}
const PRIORITY_TONE: Record<string, string> = { alta: 'text-danger', media: 'text-warning', baixa: 'text-ink-3' }

const TACOS_TONE: Record<string, string> = { ok: 'text-success', warn: 'text-warning', bad: 'text-danger', sem_dados: 'text-ink-3' }

const cards = computed(() => {
  const h = props.data?.health
  const rules = props.data?.rules
  if (!h || !rules) return []
  const delta = (v: number | null, suffix = '%') => (v === null || v === undefined ? '' : `${v > 0 ? '+' : ''}${v}${suffix} vs. 7 dias antes`)
  return [
    { label: 'Investimento', value: brl(h.cost), hint: delta(h.variation.cost) },
    { label: 'Receita por Ads', value: brl(h.revenue), hint: delta(h.variation.revenue) },
    { label: 'ROAS', value: h.roas === null ? '—' : `${h.roas}x`, hint: delta(h.variation.roas) },
    { label: 'ACOS', value: h.acos === null ? '—' : pct(h.acos), hint: 'investimento ÷ receita por Ads' },
    { label: 'TACOS', value: h.tacos === null ? '—' : pct(h.tacos), hint: `alvo ${rules.tacos_target[0]}% a ${rules.tacos_target[1]}%${h.variation.tacos === null ? '' : ` · ${h.variation.tacos > 0 ? '+' : ''}${h.variation.tacos} p.p.`}`, tone: TACOS_TONE[h.tacos_state] },
    { label: 'Share de Ads', value: h.ads_share === null ? '—' : pct(h.ads_share), hint: `orgânico ${brl(h.organic)} (${h.variation.organic === null ? '—' : `${h.variation.organic > 0 ? '+' : ''}${h.variation.organic}%`})` }
  ]
})

const showAll = ref(false)
const families = computed(() => {
  const list = props.data?.families ?? []
  return showAll.value ? list : list.filter((f) => f.signals.length || f.untouchable).slice(0, 40)
})
const open = ref<Set<string>>(new Set())
function toggle(f: AdsAnalysisFamily) {
  const next = new Set(open.value)
  if (next.has(f.key)) next.delete(f.key)
  else next.add(f.key)
  open.value = next
}
function value(q: AdsAnalysisQueueItem) {
  return q.value === null ? '—' : brl(q.value)
}
</script>

<template>
  <div class="space-y-5 text-[13px]" data-test="ads-analise">
    <p v-if="loading && !data" class="text-ink-3">Analisando os últimos 7 dias…</p>
    <p v-else-if="error" class="text-danger" role="alert">{{ error }}</p>
    <template v-else-if="data">
      <p class="text-[12px] text-ink-3">
        Janela: {{ dateShort(data.period.from) }} a {{ dateShort(data.period.to) }} (7 dias fechados), comparada com {{ dateShort(data.period.prev_from) }} a {{ dateShort(data.period.prev_to) }}.
        A análise só recomenda; a execução é no Seller Center. {{ data.rules.note }}
      </p>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div v-for="c in cards" :key="c.label" class="card p-4">
          <p class="text-[12px] font-medium text-ink-2">{{ c.label }}</p>
          <p class="mt-1 text-[20px] font-semibold leading-tight" :class="c.tone || 'text-ink'" data-numeric>{{ c.value }}</p>
          <p class="mt-1 text-[11px] text-ink-3">{{ c.hint }}</p>
        </div>
      </div>

      <div class="card p-4" data-test="fila">
        <div class="flex flex-wrap items-baseline gap-2">
          <p class="font-semibold text-ink">O que mexer agora</p>
          <p class="text-[12px] text-ink-3">até {{ data.rules.max_actions }} ações, por dinheiro em jogo; {{ data.next_round.length }} na próxima rodada, {{ data.watch.length }} para observar</p>
        </div>
        <p v-if="!data.queue.length" class="mt-2 text-ink-3">Nenhuma ação com valor estimável nesta janela.</p>
        <ol class="mt-3 space-y-3">
          <li v-for="q in data.queue" :key="`${q.key}-${q.signal}`" class="rounded-card border border-line p-3" :data-test="`acao-${q.n}`">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-[15px] font-semibold text-ink">#{{ q.n }}</span>
              <span class="rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="CLASS_TONE[q.class]">{{ q.class_label }}</span>
              <span class="font-medium text-ink">{{ q.title }}</span>
              <span class="ml-auto font-semibold text-ink" data-numeric>{{ value(q) }}</span>
            </div>
            <p class="mt-1 text-[12px] text-ink-3"><span class="font-medium text-ink-2">Valor em jogo:</span> {{ q.value_how ?? 'não estimável' }}</p>
            <p class="text-[12px] text-ink-2"><span class="font-medium">Evidência:</span> {{ q.evidence }}</p>
            <p class="mt-1 text-ink"><span class="font-medium">Ação:</span> {{ q.action }}</p>
            <p class="text-[12px] text-ink-2"><span class="font-medium">Antes de aplicar:</span> {{ q.check_before }} · <span class="font-medium">Reavaliar:</span> {{ q.reassess }}</p>
          </li>
        </ol>
        <p class="mt-3 text-[12px] text-ink-2" data-test="fechamento">{{ data.closing.text }}</p>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div class="card p-4" data-test="proxima-rodada">
          <p class="font-semibold text-ink">Próxima rodada <span class="text-[12px] font-normal text-ink-3">({{ data.next_round.length }})</span></p>
          <ul class="mt-2 space-y-1 text-[12px]">
            <li v-for="q in data.next_round" :key="`${q.key}-${q.signal}`" class="flex gap-2">
              <span class="shrink-0 rounded-full px-1.5 text-[10px] font-semibold" :class="CLASS_TONE[q.class]">{{ q.class_label }}</span>
              <span class="min-w-0 flex-1 truncate text-ink-2" :title="q.action">{{ q.title }}</span>
              <span class="shrink-0 text-ink" data-numeric>{{ value(q) }}</span>
            </li>
            <li v-if="!data.next_round.length" class="text-ink-3">Nada esperando.</li>
          </ul>
          <p class="mt-3 font-semibold text-ink">Observar <span class="text-[12px] font-normal text-ink-3">(sem valor estimável)</span></p>
          <ul class="mt-1 space-y-1 text-[12px]">
            <li v-for="q in data.watch" :key="`${q.key}-${q.signal}`" class="text-ink-2" :title="q.evidence">{{ q.title }}: {{ q.action }}</li>
            <li v-if="!data.watch.length" class="text-ink-3">Nada.</li>
          </ul>
        </div>
        <div class="card p-4" data-test="intocaveis">
          <p class="font-semibold text-ink">Intocáveis <span class="text-[12px] font-normal text-ink-3">({{ data.untouchables.length }}): não mexer ainda</span></p>
          <ul class="mt-2 space-y-1 text-[12px]">
            <li v-for="u in data.untouchables" :key="u.key" class="text-ink-2">
              <span class="text-ink">{{ u.name }}</span> · {{ u.reason }}<template v-if="u.until"> · avaliar a partir de {{ dateShort(u.until) }}</template>
            </li>
            <li v-if="!data.untouchables.length" class="text-ink-3">Nenhum.</li>
          </ul>
        </div>
      </div>

      <div class="card overflow-x-auto p-4" data-test="leilao">
        <p class="font-semibold text-ink">Campanhas e leilão <span class="text-[12px] font-normal text-ink-3">(só o detalhe da campanha traz essas métricas; com várias famílias, o share é do conjunto)</span></p>
        <table class="mt-2 w-full border-collapse text-[12px]">
          <thead>
            <tr class="border-b border-line text-left text-ink-2">
              <th class="py-1.5 pr-2 font-semibold">Campanha</th>
              <th class="py-1.5 pr-2 text-right font-semibold">Invest.</th>
              <th class="py-1.5 pr-2 text-right font-semibold">ROAS</th>
              <th class="py-1.5 pr-2 text-right font-semibold">ROAS Obj.</th>
              <th class="py-1.5 pr-2 text-right font-semibold">Equilíbrio</th>
              <th class="py-1.5 pr-2 text-right font-semibold">ACOS × benchmark</th>
              <th class="py-1.5 pr-2 text-right font-semibold">Aparece</th>
              <th class="py-1.5 pr-2 text-right font-semibold">Perde: orçamento</th>
              <th class="py-1.5 pr-2 text-right font-semibold">Perde: classificação</th>
              <th class="py-1.5 pr-2 text-right font-semibold">Famílias</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in data.campaigns" :key="c.id" class="border-b border-line" :class="c.status === 'active' ? '' : 'text-ink-3'">
              <td class="py-1.5 pr-2"><span class="font-medium" :class="c.status === 'active' ? 'text-ink' : ''">{{ c.name }}</span><span class="block text-[11px] text-ink-3">{{ c.status }} · {{ c.strategy ?? '—' }} · orçamento {{ brl(c.daily_budget) }}/dia</span></td>
              <td class="py-1.5 pr-2 text-right" data-numeric>{{ brl(c.metrics.cost) }}</td>
              <td class="py-1.5 pr-2 text-right" data-numeric :class="c.equilibrium !== null && c.metrics.roas !== null ? (c.metrics.roas >= c.equilibrium ? 'text-success' : 'text-danger') : ''">{{ c.metrics.roas ?? '—' }}</td>
              <td class="py-1.5 pr-2 text-right" data-numeric>{{ c.roas_target ?? '—' }}</td>
              <td class="py-1.5 pr-2 text-right" data-numeric>{{ c.equilibrium ?? '—' }}</td>
              <td class="py-1.5 pr-2 text-right" data-numeric>
                {{ c.metrics.acos === null ? '—' : pct(c.metrics.acos) }} × {{ c.auction.acos_benchmark ? pct(c.auction.acos_benchmark) : '—' }}
              </td>
              <td class="py-1.5 pr-2 text-right" data-numeric>{{ c.auction.impression_share === null || c.auction.impression_share === undefined ? '—' : pct(c.auction.impression_share * 100) }}</td>
              <td class="py-1.5 pr-2 text-right" data-numeric :class="(c.auction.lost_by_budget ?? 0) >= 0.2 ? 'font-semibold text-warning' : ''">{{ c.auction.lost_by_budget === null || c.auction.lost_by_budget === undefined ? '—' : pct(c.auction.lost_by_budget * 100) }}</td>
              <td class="py-1.5 pr-2 text-right" data-numeric :class="(c.auction.lost_by_ad_rank ?? 0) >= 0.5 ? 'font-semibold text-warning' : ''">{{ c.auction.lost_by_ad_rank === null || c.auction.lost_by_ad_rank === undefined ? '—' : pct(c.auction.lost_by_ad_rank * 100) }}</td>
              <td class="py-1.5 pr-2 text-right" data-numeric>{{ int(c.families) }} <span class="text-[11px] text-ink-3">({{ c.attribution }})</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card overflow-x-auto p-4" data-test="familias">
        <div class="flex flex-wrap items-baseline gap-2">
          <p class="font-semibold text-ink">Famílias (produtos)</p>
          <p class="text-[12px] text-ink-3">{{ data.families.length }} no período; mostrando {{ showAll ? 'todas' : 'as com sinal ou intocáveis' }}, por investimento</p>
          <button type="button" class="btn-link ml-auto text-[12px]" @click="showAll = !showAll">{{ showAll ? 'Só com sinais' : 'Mostrar todas' }}</button>
        </div>
        <table class="mt-2 w-full border-collapse text-[12px]">
          <thead>
            <tr class="border-b border-line text-left text-ink-2">
              <th class="py-1.5 pr-2 font-semibold">Família</th>
              <th class="py-1.5 pr-2 text-right font-semibold">Invest.</th>
              <th class="py-1.5 pr-2 text-right font-semibold">Receita</th>
              <th class="py-1.5 pr-2 text-right font-semibold">ROAS</th>
              <th class="py-1.5 pr-2 text-right font-semibold">Equilíbrio</th>
              <th class="py-1.5 pr-2 text-right font-semibold">CTR · conv.</th>
              <th class="py-1.5 pr-2 font-semibold">Sinais</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="f in families" :key="f.key">
              <tr class="cursor-pointer border-b border-line hover:bg-surface-2" :data-test="`familia-${f.key}`" @click="toggle(f)">
                <td class="py-1.5 pr-2">
                  <div class="flex items-start gap-2">
                    <img v-if="f.thumbnail" :src="f.thumbnail" alt="" class="h-9 w-9 shrink-0 rounded object-cover" loading="lazy" />
                    <div class="min-w-0">
                      <p class="truncate font-medium text-ink" :title="f.name ?? ''">{{ f.name }}</p>
                      <p class="text-[11px] text-ink-3">{{ f.n_active }} ativo(s) de {{ f.n_items }} · {{ f.domain ?? '' }}<template v-if="f.untouchable"> · <span class="text-warning">{{ f.untouchable.reason }}</span></template></p>
                    </div>
                  </div>
                </td>
                <td class="py-1.5 pr-2 text-right" data-numeric>{{ brl(f.metrics.cost) }}<span v-if="f.variation.cost !== null" class="block text-[11px] text-ink-3">{{ f.variation.cost > 0 ? '+' : '' }}{{ f.variation.cost }}%</span></td>
                <td class="py-1.5 pr-2 text-right" data-numeric>{{ brl(f.metrics.revenue) }}</td>
                <td class="py-1.5 pr-2 text-right" data-numeric :class="f.economics?.roas_equilibrio && f.metrics.roas !== null ? (f.metrics.roas >= f.economics.roas_equilibrio ? 'text-success' : 'text-danger') : ''">{{ f.metrics.roas ?? '—' }}</td>
                <td class="py-1.5 pr-2 text-right" data-numeric :title="f.economics ? `margem bruta ${f.economics.margin_pct}%` : 'sem custo cadastrado: não dá para afirmar lucro'">{{ f.economics?.roas_equilibrio ?? '—' }}</td>
                <td class="py-1.5 pr-2 text-right" data-numeric>
                  <span :class="f.sample.ctr_ok ? '' : 'text-ink-3'">{{ f.metrics.ctr === null ? '—' : pct(f.metrics.ctr) }}</span> ·
                  <span :class="f.sample.cvr_ok ? '' : 'text-ink-3'">{{ f.metrics.cvr === null ? '—' : pct(f.metrics.cvr) }}</span>
                </td>
                <td class="py-1.5 pr-2">
                  <span v-for="s in f.signals" :key="s.type" class="mr-1 inline-block text-[11px]" :class="PRIORITY_TONE[s.priority]" :title="s.detail">{{ SIGNAL_LABEL[s.type] ?? s.type }}</span>
                </td>
              </tr>
              <tr v-if="open.has(f.key)" class="border-b border-line bg-surface-2">
                <td colspan="7" class="px-4 py-3">
                  <ul class="space-y-1 text-[12px]">
                    <li v-for="s in f.signals" :key="s.type"><span class="font-semibold" :class="PRIORITY_TONE[s.priority]">{{ SIGNAL_LABEL[s.type] ?? s.type }}:</span> {{ s.detail }}</li>
                  </ul>
                  <table class="mt-2 w-full text-[11px]">
                    <tbody>
                      <tr v-for="i in f.items" :key="i.item_id" class="text-ink-2">
                        <td class="py-0.5 pr-2"><a :href="i.permalink ?? '#'" target="_blank" rel="noopener" class="hover:underline">{{ i.item_id }}</a> · {{ i.status }} · {{ i.campaign ?? 'sem campanha' }}<template v-if="i.age_days !== null"> · {{ i.age_days }} dias</template></td>
                        <td class="py-0.5 pr-2 text-right" data-numeric>{{ brl(i.cost) }}</td>
                        <td class="py-0.5 pr-2 text-right" data-numeric>{{ brl(i.revenue) }}</td>
                        <td class="py-0.5 pr-2 text-right" data-numeric>ROAS {{ i.roas ?? '—' }}</td>
                        <td class="py-0.5 text-right" data-numeric>{{ int(i.clicks) }} cliques · {{ int(i.prints) }} impr.</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
