<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiErrorMessage } from '../../lib/apiErrors'
import { brl, dateTimeShort, int, pct } from '../../lib/format'
import type { PromotionsClient } from '../../lib/promotionsClient'
import type { PromotionRunDetail, PromotionRunsResponse } from '../../types/promotions'

/**
 * Aba "Rotina das 03:00" da seção Promoções: se a rotina está ligada e em que modo (muda em Configurações), as
 * execuções (agendadas e "Simular agora") e, da escolhida, o antes e o depois de cada anúncio, com exportação.
 */
const props = defineProps<{ client: PromotionsClient; accountId: string; isAdmin: boolean }>()

const data = ref<PromotionRunsResponse | null>(null)
const run = ref<PromotionRunDetail | null>(null)
const loading = ref(false)
const loadingRun = ref(false)
const message = ref('')
const filter = ref<'mudancas' | 'revisar' | 'todos'>('mudancas')

async function load() {
  loading.value = true
  try {
    data.value = await props.client.runs(props.accountId)
    const first = data.value.runs[0]
    if (first && (!run.value || run.value.id !== first.id)) openRun(first.id)
  } catch (err) {
    message.value = apiErrorMessage(err, 'Não foi possível carregar a rotina agora.')
  } finally {
    loading.value = false
  }
}

async function openRun(id: number) {
  loadingRun.value = true
  try {
    run.value = await props.client.run(props.accountId, id)
  } finally {
    loadingRun.value = false
  }
}

async function simulateNow() {
  message.value = ''
  try {
    await props.client.simulate(props.accountId)
    message.value = 'Simulação pedida. Ela relê a Central e avalia todos os anúncios (cerca de 3 minutos); nada muda no Mercado Livre. A lista se atualiza sozinha.'
    setTimeout(load, 90_000)
    setTimeout(load, 200_000)
  } catch (err) {
    message.value = apiErrorMessage(err, 'Não foi possível pedir a simulação agora.')
  }
}

async function exportRun() {
  if (!run.value) return
  const blob = await props.client.runExport(props.accountId, run.value.id)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `rotina-promocoes-${run.value.id}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

const rows = computed(() => {
  const all = run.value?.rows ?? []
  if (filter.value === 'mudancas') return all.filter((r) => r.changes)
  if (filter.value === 'revisar') return all.filter((r) => !r.changes)
  return all
})

const TOTAL_LABELS: Record<string, string> = {
  simulado: 'mudariam', aplicado: 'aplicados', erro: 'com erro', revisar: 'para revisar', sem_mudanca: 'sem mudança',
  regra_propria: 'com regra própria (não mexe)', automacao_desligada: 'com automação desligada', catalogo_fora: 'de catálogo fora da automação'
}

onMounted(load)
</script>

<template>
  <div class="space-y-4 text-[13px]">
    <div class="card flex flex-wrap items-center gap-3 p-4">
      <div class="min-w-0 flex-1">
        <p class="font-semibold text-ink">Rotina das 03:00</p>
        <p v-if="data" class="text-ink-2">
          <template v-if="data.routine.enabled">
            Ligada, em <span class="font-semibold" :class="data.routine.mode === 'apply' ? 'text-danger' : 'text-ink'">{{ data.routine.mode === 'apply' ? 'aplicação real' : 'simulação' }}</span>:
            {{ data.routine.mode === 'apply' ? 'toda madrugada aplica no Mercado Livre a melhor oferta de cada anúncio.' : 'toda madrugada registra o que faria, sem mudar nada no Mercado Livre.' }}
          </template>
          <template v-else>Desligada: não roda de madrugada. Ligue em Configurações → Impostos e margem.</template>
        </p>
        <p class="text-[11px] text-ink-3">Precisa do computador ligado (ou do servidor) às 03:00. A mesma regra da tela: limites, preço cheio, aumento máximo por faixa e casa de cem. Anúncio com regra própria em texto não é mexido.</p>
      </div>
      <button v-if="isAdmin" type="button" class="btn-primary h-9 px-4 text-[13px]" :disabled="data?.running" data-test="simular-agora" @click="simulateNow">
        {{ data?.running ? 'Rodando…' : 'Simular agora' }}
      </button>
    </div>
    <p v-if="message" class="text-ink-2" role="status">{{ message }}</p>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-4">
      <div class="card overflow-hidden xl:col-span-1">
        <p class="border-b border-line px-3 py-2 font-semibold text-ink">Execuções</p>
        <p v-if="loading && !data" class="px-3 py-4 text-ink-3">Carregando…</p>
        <p v-else-if="!data?.runs.length" class="px-3 py-4 text-ink-3">Nenhuma execução ainda. Use "Simular agora".</p>
        <button
          v-for="r in data?.runs ?? []"
          :key="r.id"
          type="button"
          class="block w-full border-b border-line px-3 py-2 text-left hover:bg-surface-2"
          :class="run?.id === r.id ? 'bg-primary-soft' : ''"
          @click="openRun(r.id)"
        >
          <span class="font-medium text-ink">{{ dateTimeShort(r.started_at) }}</span>
          <span class="ml-1 text-[11px]" :class="r.mode === 'apply' ? 'text-danger' : 'text-ink-3'">{{ r.mode_label }} · {{ r.trigger_label }}</span>
          <span class="block text-[11px] text-ink-3">
            <template v-if="r.status === 'running'">rodando…</template>
            <template v-else-if="r.status === 'failed'"><span class="text-danger">falhou</span></template>
            <template v-else>{{ int(r.totals.simulado ?? r.totals.aplicado ?? 0) }} mudanças · {{ int(r.totals.revisar ?? 0) }} para revisar</template>
          </span>
        </button>
      </div>

      <div class="card p-4 xl:col-span-3">
        <p v-if="loadingRun && !run" class="text-ink-3">Carregando…</p>
        <p v-else-if="!run" class="text-ink-3">Escolha uma execução.</p>
        <template v-else>
          <div class="mb-3 flex flex-wrap items-start gap-3">
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-ink">{{ run.mode_label }} de {{ dateTimeShort(run.started_at) }}</p>
              <p v-if="run.error" class="text-danger">{{ run.error }}</p>
              <p class="text-[12px] text-ink-2">
                <template v-for="(n, k) in run.totals" :key="k"><template v-if="k !== 'anuncios' && TOTAL_LABELS[k]">{{ int(n) }} {{ TOTAL_LABELS[k] }} · </template></template>
                de {{ int(run.totals.anuncios ?? 0) }} anúncios
              </p>
              <p class="text-[12px] text-ink-2">
                {{ int(run.price_up) }} subiriam o preço (+{{ brl(run.gain_up) }} por unidade somando) ·
                {{ int(run.price_down) }} baixariam o preço ({{ brl(run.gain_down) }}, quase sempre por estarem acima da margem máxima)
              </p>
            </div>
            <button type="button" class="btn-link text-[12px]" @click="exportRun">Exportar (CSV)</button>
          </div>

          <div class="mb-2 flex gap-1 text-[12px]" role="group" aria-label="Filtrar anúncios da execução">
            <button v-for="f in ([['mudancas', 'Mudanças'], ['revisar', 'Não mexeu / revisar'], ['todos', 'Todos']] as const)" :key="f[0]" type="button" class="rounded-md px-2.5 py-1"
              :class="filter === f[0] ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2 hover:bg-surface-2'" @click="filter = f[0]">{{ f[1] }}</button>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-[12px]">
              <thead>
                <tr class="border-b border-line text-left text-ink-2">
                  <th scope="col" class="py-1.5 pr-2 font-semibold">Anúncio</th>
                  <th scope="col" class="py-1.5 pr-2 font-semibold">Antes</th>
                  <th scope="col" class="py-1.5 pr-2 font-semibold">Depois</th>
                  <th scope="col" class="py-1.5 pr-2 text-right font-semibold">Preço</th>
                  <th scope="col" class="py-1.5 pr-2 text-right font-semibold">Ganho/un.</th>
                  <th scope="col" class="py-1.5 font-semibold">Resultado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!rows.length"><td colspan="6" class="py-6 text-center text-ink-3">Nada nesta lista.</td></tr>
                <tr v-for="r in rows" :key="r.item_id" class="border-b border-line align-top">
                  <td class="py-1.5 pr-2">
                    <span class="block max-w-[280px] truncate font-medium text-ink" :title="r.title ?? ''">{{ r.title ?? r.item_id }}</span>
                    <span class="text-[11px] text-ink-3">{{ r.item_id }} · {{ r.sku ?? 'sem SKU' }}</span>
                  </td>
                  <td class="py-1.5 pr-2">
                    <template v-if="r.before">
                      {{ r.before.name }}
                      <span class="block text-[11px] text-ink-3" data-numeric>{{ brl(r.before.price) }} · {{ pct(r.before.margin_pct) }} · {{ brl(r.before.profit) }}</span>
                    </template>
                    <span v-else class="text-ink-3">sem promoção</span>
                  </td>
                  <td class="py-1.5 pr-2">
                    <template v-if="r.after">
                      <span :class="r.changes ? '' : 'text-ink-3 line-through'">{{ r.after.name }}</span>
                      <span class="block text-[11px] text-ink-3" data-numeric>{{ brl(r.after.price) }} · {{ pct(r.after.margin_pct) }} · {{ brl(r.after.profit) }}</span>
                    </template>
                    <span v-else class="text-ink-3">—</span>
                  </td>
                  <td class="py-1.5 pr-2 text-right" data-numeric :class="(r.price_change_pct ?? 0) > 0 ? 'text-warning' : (r.price_change_pct ?? 0) < 0 ? 'text-ink-2' : 'text-ink-3'">
                    {{ r.price_change_pct === null ? '—' : `${r.price_change_pct > 0 ? '+' : ''}${pct(r.price_change_pct)}` }}
                  </td>
                  <td class="py-1.5 pr-2 text-right font-medium" data-numeric :class="(r.gain ?? 0) > 0 ? 'text-success' : (r.gain ?? 0) < 0 ? 'text-danger' : 'text-ink-3'">
                    {{ r.gain === null ? '—' : brl(r.gain) }}
                  </td>
                  <td class="py-1.5">
                    <span :class="!r.ok ? 'text-danger' : r.kind === 'revisar' ? 'text-danger' : r.changes ? 'text-ink' : 'text-ink-3'">{{ r.ok ? r.kind_label : 'Falhou' }}</span>
                    <span v-if="r.reason" class="block max-w-[260px] text-[11px] text-ink-3" :title="r.reason">{{ r.reason }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
