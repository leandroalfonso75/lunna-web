<script setup lang="ts">
import { ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import EmptyAccountState from '../components/painel/EmptyAccountState.vue'
import PageHeader from '../components/painel/PageHeader.vue'
import PromotionItemPanel from '../components/promocoes/PromotionItemPanel.vue'
import { usePageHeader } from '../composables/usePageHeader'
import { usePromotions } from '../composables/usePromotions'
import { brl, dateTimeShort, int, pct } from '../lib/format'
import { useSessionStore } from '../stores/session'
import type { PromotionItemRow, PromotionOfferShort } from '../types/promotions'

/**
 * `/promocoes`: promoções da Central de Promoções do Mercado Livre por anúncio — a promoção atual, a melhor
 * oferta (maior margem dentro da margem mínima/máxima) e o ganho da troca; promoções da conta; margens por
 * anúncio e exportação. Toda a conta é da API (`GET /api/promotions`).
 */
const session = useSessionStore()
const promos = usePromotions()
const { filters, tab, response, loading, stale, loadError, syncing, syncMessage, exporting, selected, detail, detailLoading, detailError, saving, saveError, acting, actionResult, checked, bulkMessage, history, historyLoading } = promos

const header = usePageHeader()
watchEffect(() => {
  header.state.title = 'Promoções'
  header.state.subtitle = session.selectedAccount ? `Mercado Livre · ${session.selectedAccount.nickname}` : 'Mercado Livre'
  header.state.sync = null
  header.state.generatedAt = null
  header.state.refreshing = promos.refreshing.value
  header.state.onRefresh = promos.refreshNow
})

onMounted(promos.start)
onBeforeUnmount(promos.stop)

const STATUS_TABS = [
  { value: '', label: 'Todos' },
  { value: 'trocar', label: 'Trocar por melhor' },
  { value: 'sem_promocao', label: 'Sem promoção' },
  { value: 'abaixo_minima', label: 'Abaixo da mínima' },
  { value: 'ok', label: 'Na melhor' },
  { value: 'sem_custo', label: 'Sem custo' }
]

const COLUMNS = [
  { key: 'item', label: 'Anúncio', sort: 'title', width: 'w-[30%]', align: 'left' },
  { key: 'price', label: 'Preço cheio', sort: 'price', width: 'w-[9%]', align: 'right' },
  { key: 'current', label: 'Promoção atual (margem real)', sort: 'margin', width: 'w-[20%]', align: 'left' },
  { key: 'best', label: 'Melhor oferta (margem real)', sort: 'best_margin', width: 'w-[20%]', align: 'left' },
  { key: 'gain', label: 'Ganho/un.', sort: 'gain', width: 'w-[8%]', align: 'right' },
  { key: 'status', label: 'Situação', width: 'w-[13%]', align: 'left' }
]

const TONE: Record<string, string> = { ok: 'text-success', warn: 'text-warning', bad: 'text-danger', neutral: 'text-ink-3' }
const tone = (t: string) => TONE[t] ?? 'text-ink-2'

const pages = computed(() => (response.value ? Math.max(1, Math.ceil(response.value.total / response.value.per_page)) : 1))
const promotionName = computed(() => response.value?.promotions.find((p) => p.promotion_id === filters.promotionId)?.name ?? filters.promotionId)
const hasFilters = computed(() => !!(filters.status || filters.promotionId || filters.q))

const cards = computed(() => {
  const s = response.value?.summary
  if (!s) return []
  return [
    { key: 'with', label: 'Em promoção', value: int(s.with_promotion), hint: `de ${int(s.items)} anúncios ativos` },
    { key: 'without', label: 'Sem promoção', value: int(s.without_promotion), hint: 'podem entrar numa oferta', tone: s.without_promotion ? 'text-warning' : '' },
    { key: 'switch', label: 'Trocas que rendem mais', value: int(s.to_switch), hint: `+${brl(s.switch_gain)} por unidade somando todas`, tone: s.to_switch ? 'text-warning' : '' },
    { key: 'below', label: 'Abaixo da margem mínima', value: int(s.below_min), hint: `${int(s.without_cost)} anúncios sem custo ficam de fora`, tone: s.below_min ? 'text-danger' : '' }
  ]
})

function offerLine(o: PromotionOfferShort | null) {
  if (!o) return null
  return { title: o.name || o.label, sub: o.label, price: o.price, margin: o.margin_pct, profit: o.profit, valid: o.valid, action: o.action }
}

function toggle(row: PromotionItemRow) {
  if (selected.value === row.item_id) promos.close()
  else promos.open(row.item_id)
}

const ACTION_HINT: Record<string, string> = { editar_preco: 'ajustar o preço da atual', aderir: 'entrar nesta', manter: '' }

/** Anúncios desta página em que dá para aplicar a melhor oferta (trocar ou entrar). */
const switchable = computed(() => (response.value?.items ?? []).filter((r) => ['trocar', 'sem_promocao', 'abaixo_minima'].includes(r.status.key) && r.best).map((r) => r.item_id))
const confirmingBulk = ref(false)

function toggleCheck(id: string) {
  checked.value = checked.value.includes(id) ? checked.value.filter((x) => x !== id) : [...checked.value, id]
}

function checkAllSwitchable() {
  checked.value = [...new Set([...checked.value, ...switchable.value])]
}

function runBulk() {
  confirmingBulk.value = false
  promos.applyBestChecked()
}
</script>

<template>
  <EmptyAccountState v-if="!session.selectedAccount" />
  <div v-else class="page space-y-5">
    <PageHeader />

    <div class="flex flex-wrap items-center gap-3 text-[12px] text-ink-3">
      <span v-if="response?.synced_at">Central de Promoções lida em {{ dateTimeShort(response.synced_at) }} (a cada hora)</span>
      <span v-if="response">Margem geral: mínima {{ pct(response.rules.min_margin_pct) }}<template v-if="response.rules.max_margin_pct !== null">, máxima {{ pct(response.rules.max_margin_pct) }}</template> (Configurações)</span>
      <div class="ml-auto flex gap-3 text-[13px]">
        <button type="button" class="btn-link" :disabled="exporting" @click="promos.exportCsv">{{ exporting ? 'Exportando…' : 'Exportar todas (CSV)' }}</button>
        <button v-if="session.isAdmin" type="button" class="btn-link" :disabled="syncing" @click="promos.syncNow">
          {{ syncing ? 'Pedindo…' : 'Atualizar do Mercado Livre agora' }}
        </button>
      </div>
    </div>
    <p v-if="syncMessage" class="text-[13px] text-ink-2" role="status">{{ syncMessage }}</p>
    <p v-if="stale" role="status" class="rounded-card border border-warning bg-warning-soft px-3 py-2 text-[13px] text-warning">
      Não foi possível atualizar agora — mostrando os últimos dados.
    </p>

    <div v-if="loadError" class="card p-6 text-center" role="alert">
      <p class="text-[15px] text-danger">{{ loadError }}</p>
      <button type="button" class="btn-link mt-3" @click="promos.refreshNow">Tentar de novo</button>
    </div>

    <template v-else>
      <div v-if="cards.length" class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div v-for="c in cards" :key="c.key" class="card p-4" :data-test="`kpi-${c.key}`">
          <p class="text-[12px] font-medium text-ink-2">{{ c.label }}</p>
          <p class="mt-1 text-[20px] font-semibold leading-tight" :class="c.tone || 'text-ink'" data-numeric>{{ c.value }}</p>
          <p class="mt-1 text-[11px] text-ink-3">{{ c.hint }}</p>
        </div>
      </div>
      <div v-else class="h-24 animate-pulse rounded-card bg-surface-2" />

      <p v-if="response && !response.synced_at" class="card p-6 text-center text-ink-2">
        A Central de Promoções ainda não foi lida para esta conta. {{ session.isAdmin ? 'Use "Atualizar do Mercado Livre agora".' : 'Peça a um administrador para atualizar.' }}
      </p>

      <div class="flex gap-1 border-b border-line" role="tablist">
        <button type="button" role="tab" :aria-selected="tab === 'anuncios'" class="-mb-px border-b-2 px-4 py-2 text-[14px]"
          :class="tab === 'anuncios' ? 'border-primary font-semibold text-primary' : 'border-transparent text-ink-2 hover:text-ink'" @click="tab = 'anuncios'">
          Anúncios <span class="ml-1 text-[12px] text-ink-3">{{ int(response?.summary.items ?? 0) }}</span>
        </button>
        <button type="button" role="tab" :aria-selected="tab === 'promocoes'" class="-mb-px border-b-2 px-4 py-2 text-[14px]"
          :class="tab === 'promocoes' ? 'border-primary font-semibold text-primary' : 'border-transparent text-ink-2 hover:text-ink'" @click="tab = 'promocoes'">
          Promoções do ML <span class="ml-1 text-[12px] text-ink-3">{{ int(response?.promotions.length ?? 0) }}</span>
        </button>
        <button type="button" role="tab" :aria-selected="tab === 'historico'" class="-mb-px border-b-2 px-4 py-2 text-[14px]"
          :class="tab === 'historico' ? 'border-primary font-semibold text-primary' : 'border-transparent text-ink-2 hover:text-ink'" @click="tab = 'historico'">
          Histórico
        </button>
      </div>

      <!-- aba Anúncios -->
      <template v-if="tab === 'anuncios'">
        <div class="space-y-3">
          <div class="relative max-w-xl">
            <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <input :value="filters.q" type="search" class="input h-10 w-full pl-9" placeholder="Buscar por anúncio, título ou SKU" aria-label="Buscar anúncios"
              @input="promos.change({ q: ($event.target as HTMLInputElement).value }, true)" />
          </div>
          <div class="flex flex-wrap items-center gap-1 text-[13px]" role="group" aria-label="Situação">
            <button v-for="t in STATUS_TABS" :key="t.label" type="button" class="rounded-md px-2.5 py-1"
              :class="filters.status === t.value ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2 hover:bg-surface-2'"
              @click="promos.change({ status: t.value })">
              {{ t.label }}<template v-if="t.value && response"> {{ int(response.counts[t.value] ?? 0) }}</template>
            </button>
            <span v-if="filters.promotionId" class="ml-2 rounded-md bg-primary-soft px-2.5 py-1 text-primary">
              Promoção: {{ promotionName }}
              <button type="button" class="ml-1 font-semibold" aria-label="Tirar filtro de promoção" @click="promos.change({ promotionId: '' })">×</button>
            </span>
            <button v-if="hasFilters" type="button" class="btn-link ml-2" @click="promos.change({ status: '', promotionId: '', q: '' })">Limpar filtros</button>
          </div>
          <div v-if="session.isAdmin" class="flex flex-wrap items-center gap-3 text-[13px]">
            <button v-if="switchable.length" type="button" class="btn-link" @click="checkAllSwitchable">Marcar os {{ switchable.length }} desta página que podem melhorar</button>
            <template v-if="checked.length">
              <span class="text-ink-2">{{ checked.length }} {{ checked.length === 1 ? 'marcado' : 'marcados' }}</span>
              <button type="button" class="btn-primary h-8 px-3 text-[12px]" :disabled="acting" data-test="aplicar-lote" @click="confirmingBulk = true">Aplicar a melhor oferta nos marcados</button>
              <button type="button" class="btn-link" @click="checked = []">Desmarcar</button>
            </template>
          </div>
          <div v-if="confirmingBulk" class="rounded-card border border-warning bg-warning-soft p-3 text-[13px]" role="alertdialog" aria-label="Confirmar aplicação em lote">
            <p class="text-ink">
              O Lunna vai aplicar no Mercado Livre a melhor oferta de {{ checked.length }} {{ checked.length === 1 ? 'anúncio' : 'anúncios' }}, um de cada vez,
              relendo as ofertas de cada um antes. Os preços mudam na hora; cada resultado fica na aba Histórico.
            </p>
            <div class="mt-2 flex gap-2">
              <button type="button" class="btn-primary h-8 px-3 text-[12px]" :disabled="acting" @click="runBulk">Confirmar</button>
              <button type="button" class="btn-link" @click="confirmingBulk = false">Cancelar</button>
            </div>
          </div>
          <p v-if="bulkMessage" class="text-[13px] text-ink-2" role="status">{{ bulkMessage }}</p>
        </div>

        <div class="card overflow-hidden">
          <table class="w-full table-fixed border-collapse text-[12px]">
            <thead>
              <tr class="border-b border-line">
                <th v-for="c in COLUMNS" :key="c.key" scope="col" class="px-2 py-2 font-semibold text-ink-2" :class="[c.width, c.align === 'right' ? 'text-right' : 'text-left']"
                  :aria-sort="c.sort && response?.sort === c.sort ? (response?.dir === 'asc' ? 'ascending' : 'descending') : undefined">
                  <button v-if="c.sort" type="button" class="inline-flex items-center gap-1 hover:text-ink" :class="response?.sort === c.sort ? 'text-ink' : ''" @click="promos.sortBy(c.sort)">
                    {{ c.label }}
                    <ChevronUpIcon v-if="response?.sort === c.sort && response?.dir === 'asc'" class="h-3.5 w-3.5" aria-hidden="true" />
                    <ChevronDownIcon v-else-if="response?.sort === c.sort && response?.dir === 'desc'" class="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <span v-else>{{ c.label }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-if="loading && !response">
                <tr v-for="i in 8" :key="i" class="border-b border-line">
                  <td :colspan="COLUMNS.length" class="px-3 py-3"><div class="h-4 animate-pulse rounded bg-surface-2" /></td>
                </tr>
              </template>
              <tr v-else-if="!response?.items.length">
                <td :colspan="COLUMNS.length" class="px-3 py-10 text-center text-ink-3">Nenhum anúncio encontrado com esses filtros.</td>
              </tr>
              <template v-for="row in response?.items ?? []" v-else :key="row.item_id">
                <tr class="cursor-pointer border-b border-line hover:bg-surface-2" data-test="promo-row" @click="toggle(row)">
                  <td class="px-2 py-2 align-top">
                    <div class="flex items-start gap-2">
                      <input
                        v-if="session.isAdmin"
                        type="checkbox"
                        class="mt-3 shrink-0"
                        :checked="checked.includes(row.item_id)"
                        :disabled="!row.best"
                        :aria-label="`Marcar ${row.item_id}`"
                        @click.stop="toggleCheck(row.item_id)"
                      />
                      <img v-if="row.thumbnail" :src="row.thumbnail" alt="" class="h-9 w-9 shrink-0 rounded object-cover" loading="lazy" />
                      <div class="min-w-0">
                        <p class="truncate font-medium text-ink" :title="row.title">{{ row.title }}</p>
                        <p class="truncate text-[11px] text-ink-3">
                          {{ row.item_id }} · {{ row.sku ?? 'sem SKU' }}<template v-if="row.stock !== null"> · {{ int(row.stock) }} em estoque</template>
                        </p>
                        <p class="text-[11px] text-ink-3">
                          <template v-if="row.settings.limit_mode === 'price'">
                            valor<template v-if="row.settings.min_price !== null"> mín. {{ brl(row.settings.min_price) }}</template><template v-if="row.settings.max_price !== null"> · máx. {{ brl(row.settings.max_price) }}</template>
                          </template>
                          <template v-else>
                            mín. {{ pct(row.settings.effective_min_pct) }}<template v-if="row.settings.effective_max_pct !== null"> · máx. {{ pct(row.settings.effective_max_pct) }}</template>
                            <template v-if="row.settings.min_margin_pct === null && row.settings.max_margin_pct === null"> (geral)</template>
                          </template>
                          <template v-if="row.ads.unit > 0"> · Ads {{ brl(row.ads.unit) }}/un.</template>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="px-2 py-2 text-right align-top" data-numeric>{{ brl(row.full_price) }}</td>
                  <td v-for="key in (['current', 'best'] as const)" :key="key" class="px-2 py-2 align-top">
                    <template v-if="offerLine(row[key])">
                      <p class="truncate font-medium text-ink" :title="offerLine(row[key])!.title">{{ offerLine(row[key])!.title }}</p>
                      <p class="text-[11px]" data-numeric>
                        <span class="text-ink-2">{{ brl(offerLine(row[key])!.price) }}</span>
                        · <span :class="offerLine(row[key])!.valid ? 'text-ink' : 'text-danger'">{{ pct(offerLine(row[key])!.margin) }}</span>
                        <span class="text-ink-3"> ({{ brl(offerLine(row[key])!.profit) }})</span>
                      </p>
                      <p v-if="key === 'best' && ACTION_HINT[offerLine(row[key])!.action] && row.gain" class="text-[11px] text-ink-3">{{ ACTION_HINT[offerLine(row[key])!.action] }}</p>
                    </template>
                    <span v-else class="text-ink-3">—</span>
                  </td>
                  <td class="px-2 py-2 text-right align-top font-medium" data-numeric :class="row.gain && row.gain > 0 ? 'text-success' : 'text-ink-3'">
                    {{ row.gain ? `+${brl(row.gain)}` : '—' }}
                  </td>
                  <td class="px-2 py-2 align-top"><span :class="tone(row.status.tone)">{{ row.status.label }}</span></td>
                </tr>
                <tr v-if="selected === row.item_id" class="border-b border-line bg-surface-2">
                  <td :colspan="COLUMNS.length" class="border-l-4 border-l-primary px-4 py-4">
                    <PromotionItemPanel
                      :detail="detail" :loading="detailLoading" :error="detailError" :is-admin="session.isAdmin" :saving="saving" :save-error="saveError"
                      :acting="acting" :action-result="actionResult"
                      @save="promos.saveSettings" @apply="promos.apply" @leave="promos.leave"
                    />
                  </td>
                </tr>
              </template>
            </tbody>
          </table>

          <div v-if="response && response.total > 0" class="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-[12px] text-ink-2">
            <span>{{ int(response.total) }} anúncios · página {{ response.page }} de {{ pages }}</span>
            <div class="flex gap-2">
              <button type="button" class="btn-link" :disabled="response.page <= 1" @click="promos.setPage(response.page - 1)">Anterior</button>
              <button type="button" class="btn-link" :disabled="response.page >= pages" @click="promos.setPage(response.page + 1)">Próxima</button>
            </div>
          </div>
        </div>
      </template>

      <!-- aba Histórico -->
      <div v-else-if="tab === 'historico'" class="card overflow-x-auto">
        <table class="w-full border-collapse text-[12px]">
          <thead>
            <tr class="border-b border-line text-left text-ink-2">
              <th scope="col" class="px-3 py-2 font-semibold">Quando</th>
              <th scope="col" class="px-3 py-2 font-semibold">Anúncio</th>
              <th scope="col" class="px-3 py-2 font-semibold">O que fez</th>
              <th scope="col" class="px-3 py-2 font-semibold">De</th>
              <th scope="col" class="px-3 py-2 font-semibold">Para</th>
              <th scope="col" class="px-3 py-2 text-right font-semibold">Ganho/un.</th>
              <th scope="col" class="px-3 py-2 font-semibold">Resultado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="historyLoading && !history.length"><td colspan="7" class="px-3 py-6 text-center text-ink-3">Carregando…</td></tr>
            <tr v-else-if="!history.length"><td colspan="7" class="px-3 py-10 text-center text-ink-3">Nenhuma ação ainda.</td></tr>
            <tr v-for="a in history" :key="a.id" class="border-b border-line align-top">
              <td class="px-3 py-2 text-[11px]">{{ dateTimeShort(a.created_at) }}<span class="block text-ink-3">{{ a.source_label }}<template v-if="a.user"> · {{ a.user }}</template></span></td>
              <td class="px-3 py-2"><span class="block max-w-[260px] truncate text-ink" :title="a.title ?? ''">{{ a.title ?? a.item_id }}</span><span class="text-[11px] text-ink-3">{{ a.item_id }}</span></td>
              <td class="px-3 py-2">{{ a.kind_label }}</td>
              <td class="px-3 py-2">{{ a.from ? `${a.from.name} · ${brl(a.from.price)} · ${pct(a.from.margin_pct)}` : '—' }}</td>
              <td class="px-3 py-2">{{ a.to ? `${a.to.name} · ${brl(a.to.price)} · ${pct(a.to.margin_pct)}` : '—' }}</td>
              <td class="px-3 py-2 text-right" data-numeric>{{ a.gain ? brl(a.gain) : '—' }}</td>
              <td class="px-3 py-2" :class="a.ok ? 'text-success' : 'text-danger'">{{ a.ok ? 'Feito' : 'Falhou' }}<span v-if="a.error" class="block max-w-[280px] truncate text-[11px] text-ink-3" :title="a.error">{{ a.error }}</span></td>
            </tr>
          </tbody>
        </table>
        <div class="border-t border-line px-3 py-2 text-right"><button type="button" class="btn-link text-[12px]" @click="promos.loadHistory">Atualizar</button></div>
      </div>

      <!-- aba Promoções do ML -->
      <div v-else class="card overflow-x-auto">
        <table class="w-full border-collapse text-[12px]">
          <thead>
            <tr class="border-b border-line text-left text-ink-2">
              <th scope="col" class="px-3 py-2 font-semibold">Promoção</th>
              <th scope="col" class="px-3 py-2 font-semibold">Tipo</th>
              <th scope="col" class="px-3 py-2 font-semibold">Situação</th>
              <th scope="col" class="px-3 py-2 font-semibold">Período</th>
              <th scope="col" class="px-3 py-2 text-right font-semibold">Anúncios ativos</th>
              <th scope="col" class="px-3 py-2 text-right font-semibold">Candidatos</th>
              <th scope="col" class="px-3 py-2"><span class="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in response?.promotions ?? []" :key="p.promotion_id" class="border-b border-line">
              <td class="px-3 py-2"><span class="font-medium text-ink">{{ p.name || p.label }}</span><span class="block text-[11px] text-ink-3">{{ p.promotion_id }}</span></td>
              <td class="px-3 py-2">{{ p.label }}</td>
              <td class="px-3 py-2">{{ p.status === 'started' ? 'Ativa' : p.status === 'pending' ? 'Programada' : p.status }}</td>
              <td class="px-3 py-2 text-[11px]">{{ p.start_date ? dateTimeShort(p.start_date) : '' }}<template v-if="p.finish_date"> até {{ dateTimeShort(p.finish_date) }}</template></td>
              <td class="px-3 py-2 text-right" data-numeric>{{ int(p.active_items) }}</td>
              <td class="px-3 py-2 text-right" data-numeric>{{ int(p.candidate_items) }}</td>
              <td class="px-3 py-2 text-right"><button type="button" class="btn-link" @click="promos.showPromotion(p.promotion_id)">Ver anúncios</button></td>
            </tr>
            <tr v-if="!response?.promotions.length">
              <td colspan="7" class="px-3 py-10 text-center text-ink-3">Nenhuma promoção lida da Central ainda.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
