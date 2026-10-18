<script setup lang="ts">
import { ref } from 'vue'
import { brl, dateTimeShort, int, num, pct } from '../../lib/format'
import type { AdsCampaign } from '../../types/ads'

defineProps<{ campaigns: AdsCampaign[] }>()
const emit = defineEmits<{ (e: 'show-items', id: number): void }>()

const expanded = ref<number | null>(null)

function tone(t: string): string {
  return { ok: 'pill-success', warn: 'pill-warning', bad: 'pill-danger', neutral: 'pill-neutral' }[t] ?? 'pill-neutral'
}

const ACOS_TEXT: Record<string, string> = { ok: 'text-success', warn: 'text-warning', bad: 'text-danger', neutral: 'text-ink' }
const ACOS_HINT: Record<string, string> = {
  ok: 'Dentro da meta de ACOS da campanha',
  warn: 'Até 20% acima da meta de ACOS',
  bad: 'Mais de 20% acima da meta de ACOS',
  neutral: ''
}

function barMax(c: AdsCampaign): number {
  return Math.max(1, ...c.daily.map((d) => Math.max(d.cost, d.total_amount)))
}
function dayLabel(date: string): string {
  const [, m, d] = date.split('-')
  return `${d}/${m}`
}
</script>

<template>
  <div class="card overflow-hidden">
    <table class="w-full table-fixed border-collapse text-[12px]">
      <thead>
        <tr class="border-b border-line text-ink-2">
          <th class="w-[24%] px-2 py-2 text-left font-semibold max-xl:w-[30%]">Campanha</th>
          <th class="w-[9%] px-2 py-2 text-right font-semibold">Investimento</th>
          <th class="w-[10%] px-2 py-2 text-right font-semibold">Vendas por Ads</th>
          <th class="w-[8%] px-2 py-2 text-right font-semibold">ACOS <span class="block text-[10px] font-normal text-ink-3">meta</span></th>
          <th class="w-[7%] px-2 py-2 text-right font-semibold">ROAS</th>
          <th class="w-[8%] px-2 py-2 text-right font-semibold max-xl:hidden">Cliques</th>
          <th class="w-[7%] px-2 py-2 text-right font-semibold max-xl:hidden">CTR</th>
          <th class="w-[7%] px-2 py-2 text-right font-semibold max-xl:hidden">CPC</th>
          <th class="w-[7%] px-2 py-2 text-right font-semibold max-xl:hidden">Conv.</th>
          <th class="w-[9%] px-2 py-2 text-right font-semibold">Orçamento/dia</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!campaigns.length">
          <td colspan="10" class="px-3 py-10 text-center text-ink-3">Nenhuma campanha de publicidade encontrada.</td>
        </tr>
        <template v-for="c in campaigns" :key="c.id">
          <tr class="cursor-pointer border-b border-line hover:bg-surface-2" data-test="campaign-row" @click="expanded = expanded === c.id ? null : c.id">
            <td class="px-2 py-2.5">
              <p class="truncate font-medium text-ink" :title="c.name">{{ c.name }}</p>
              <p class="text-[11px] text-ink-3">
                <span :class="tone(c.status.tone)">{{ c.status.label }}</span>
                {{ c.strategy ?? '' }} · {{ int(c.ads_count) }} anúncios
              </p>
            </td>
            <td class="px-2 py-2.5 text-right align-top" data-numeric>{{ brl(c.metrics.cost) }}</td>
            <td class="px-2 py-2.5 text-right align-top" data-numeric>{{ brl(c.metrics.total_amount) }}</td>
            <td class="px-2 py-2.5 text-right align-top" data-numeric :title="ACOS_HINT[c.acos_state]">
              <span class="block font-semibold" :class="ACOS_TEXT[c.acos_state]">{{ pct(c.metrics.acos) }}</span>
              <span class="block text-[11px] text-ink-3">{{ c.acos_target ? pct(c.acos_target) : 'sem meta' }}</span>
            </td>
            <td class="px-2 py-2.5 text-right align-top" data-numeric>{{ c.metrics.roas === null ? '—' : `${num(c.metrics.roas, 2)}x` }}</td>
            <td class="px-2 py-2.5 text-right align-top max-xl:hidden" data-numeric>{{ int(c.metrics.clicks) }}</td>
            <td class="px-2 py-2.5 text-right align-top max-xl:hidden" data-numeric>{{ pct(c.metrics.ctr) }}</td>
            <td class="px-2 py-2.5 text-right align-top max-xl:hidden" data-numeric>{{ brl(c.metrics.cpc) }}</td>
            <td class="px-2 py-2.5 text-right align-top max-xl:hidden" data-numeric>{{ pct(c.metrics.cvr) }}</td>
            <td class="px-2 py-2.5 text-right align-top" data-numeric>{{ c.daily_budget ? brl(c.daily_budget) : '—' }}</td>
          </tr>
          <tr v-if="expanded === c.id" class="border-b border-line bg-surface-2">
            <td colspan="10" class="border-l-4 border-l-primary px-4 py-4">
              <div class="grid grid-cols-1 gap-4 text-[13px] md:grid-cols-2 xl:grid-cols-3" data-test="campaign-detail">
                <div class="card p-4">
                  <p class="mb-2 font-semibold text-ink">Configuração</p>
                  <dl>
                    <div class="def-row"><dt>Estratégia</dt><dd>{{ c.strategy ?? '—' }}</dd></div>
                    <div class="def-row"><dt>Meta de ACOS</dt><dd data-numeric>{{ c.acos_target ? pct(c.acos_target) : '—' }}</dd></div>
                    <div class="def-row"><dt>Meta de ROAS</dt><dd data-numeric>{{ c.roas_target ? `${num(c.roas_target, 2)}x` : '—' }}</dd></div>
                    <div class="def-row"><dt>Orçamento diário</dt><dd data-numeric>{{ brl(c.daily_budget) }}</dd></div>
                    <div class="def-row"><dt>Orçamento automático</dt><dd>{{ c.automatic_budget ? 'Sim' : 'Não' }}</dd></div>
                    <div class="def-row"><dt>Criada em</dt><dd>{{ dateTimeShort(c.date_created) }}</dd></div>
                    <div class="def-row"><dt>Alterada em</dt><dd>{{ dateTimeShort(c.last_updated) }}</dd></div>
                  </dl>
                </div>
                <div class="card p-4">
                  <p class="mb-2 font-semibold text-ink">Resultado no período</p>
                  <dl>
                    <div class="def-row"><dt>Vendas diretas</dt><dd data-numeric>{{ brl(c.metrics.direct_amount) }} · {{ int(c.metrics.direct_units) }} un</dd></div>
                    <div class="def-row"><dt>Vendas indiretas</dt><dd data-numeric>{{ brl(c.metrics.indirect_amount) }} · {{ int(c.metrics.indirect_units) }} un</dd></div>
                    <div class="def-row"><dt>Vendas orgânicas</dt><dd data-numeric>{{ int(c.metrics.organic_units) }} un</dd></div>
                    <div class="def-row"><dt>Impressões</dt><dd data-numeric>{{ int(c.metrics.prints) }}</dd></div>
                    <div class="def-row"><dt>Cliques</dt><dd data-numeric>{{ int(c.metrics.clicks) }} (CTR {{ pct(c.metrics.ctr) }})</dd></div>
                    <div class="def-row"><dt>Custo por clique</dt><dd data-numeric>{{ brl(c.metrics.cpc) }}</dd></div>
                    <div class="def-row"><dt>Conversão</dt><dd data-numeric>{{ pct(c.metrics.cvr) }}</dd></div>
                  </dl>
                  <button type="button" class="btn-link mt-3" @click.stop="emit('show-items', c.id)">Ver os {{ int(c.ads_count) }} anúncios desta campanha</button>
                </div>
                <div class="card p-4 md:col-span-2 xl:col-span-1">
                  <p class="mb-2 font-semibold text-ink">Por dia</p>
                  <div class="flex h-28 items-end gap-[1px]">
                    <div
                      v-for="d in c.daily"
                      :key="d.date"
                      class="group flex h-full flex-1 items-end gap-[1px]"
                      :title="`${dayLabel(d.date)}: vendas ${brl(d.total_amount)} · investimento ${brl(d.cost)}`"
                    >
                      <div class="w-1/2 rounded-t bg-primary opacity-70 group-hover:opacity-100" :style="{ height: `${Math.max(1, (d.total_amount / barMax(c)) * 100)}%` }" />
                      <div class="w-1/2 rounded-t bg-warning opacity-70 group-hover:opacity-100" :style="{ height: `${Math.max(1, (d.cost / barMax(c)) * 100)}%` }" />
                    </div>
                  </div>
                  <p class="mt-1 text-[11px] text-ink-3">Azul: vendas por Ads · amarelo: investimento</p>
                </div>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
