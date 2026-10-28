<script setup lang="ts">
import { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import EmptyAccountState from '../components/painel/EmptyAccountState.vue'
import PageHeader from '../components/painel/PageHeader.vue'
import PromotionItemPanel from '../components/promocoes/PromotionItemPanel.vue'
import PromotionRoutinePanel from '../components/promocoes/PromotionRoutinePanel.vue'
import PromotionRow from '../components/promocoes/PromotionRow.vue'
import { usePageHeader } from '../composables/usePageHeader'
import { usePromotions } from '../composables/usePromotions'
import { brl, dateTimeShort, int, pct } from '../lib/format'
import { useSessionStore } from '../stores/session'
import type { PromotionGroupRow, PromotionItemRow, PromotionSpread, PromotionTarget } from '../types/promotions'

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
  { value: 'acima_maxima', label: 'Acima da máxima' },
  { value: 'ok', label: 'Na melhor' },
  { value: 'sem_custo', label: 'Sem custo' },
  { value: 'para_revisar', label: 'Para revisar', tone: 'text-danger' },
  { value: 'nao_automatizados', label: 'Não automatizados', tone: 'text-warning' }
]

/** Contagem de anúncios de cada guia; "Todos" soma todas. */
function tabCount(value: string): number {
  const c = response.value?.counts ?? {}
  return value ? (c[value] ?? 0) : Object.entries(c).reduce((a, [k, n]) => (k === 'nao_automatizados' ? a : a + n), 0)
}

/** Produtos com variações abertos na lista (chave do grupo). Com filtro ativo, todos começam abertos. */
const expanded = ref<Set<string>>(new Set())
function toggleGroup(g: PromotionGroupRow) {
  const next = new Set(expanded.value)
  if (next.has(g.key)) next.delete(g.key)
  else next.add(g.key)
  expanded.value = next
}
const isOpen = (g: PromotionGroupRow) => expanded.value.has(g.key) || (hasFilters.value && g.matched !== undefined)

/** Painel de limites do produto (grupo aberto): a chave do grupo, ou null. */
const groupPanel = ref<string | null>(null)
function openGroupPanel(g: PromotionGroupRow) {
  if (groupPanel.value === g.key) {
    groupPanel.value = null
    promos.close()
    return
  }
  groupPanel.value = g.key
  promos.open(g.item_id)
}

/** Ordem em que o operador percorre os anúncios: a da lista, com os anúncios de cada produto no lugar do produto. */
type WalkStop = { id: string; group: string | null }
const walkOrder = computed<WalkStop[]>(() =>
  (response.value?.items ?? []).flatMap((r): WalkStop[] => ('group' in r ? r.children.map((c) => ({ id: c.item_id, group: r.key })) : [{ id: r.item_id, group: null }]))
)

function nextAfter(id: string | null): WalkStop | null {
  const list = walkOrder.value
  const i = list.findIndex((x) => x.id === id)
  return (i >= 0 ? list[i + 1] : undefined) ?? null
}
const hasNext = computed(() => !!nextAfter(selected.value))

/** Abre o próximo anúncio da lista (abrindo o produto, se ele estiver dentro de um) e rola a tela até ele. */
async function goTo(target: WalkStop | null) {
  if (!target) return
  groupPanel.value = null
  if (target.group && !expanded.value.has(target.group)) expanded.value = new Set([...expanded.value, target.group])
  promos.open(target.id)
  await nextTick()
  document.querySelector(`[data-item="${target.id}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

function goNext() {
  goTo(nextAfter(selected.value))
}

/** Aplica; com "ir para o próximo", abre o próximo só se o Mercado Livre aceitou (o próximo é guardado antes, porque a
 * lista pode mudar depois da troca). */
async function onApply(target: PromotionTarget | undefined, spread: PromotionSpread, next: boolean) {
  const following = next ? nextAfter(selected.value) : null
  const ok = await promos.apply(target, spread)
  if (ok && following) goTo(following)
}

async function onLeave(next: boolean) {
  const following = next ? nextAfter(selected.value) : null
  const ok = await promos.leave()
  if (ok && following) goTo(following)
}

/** Todos os anúncios da página, soltos e dentro dos produtos. */
const allItems = computed<PromotionItemRow[]>(() => (response.value?.items ?? []).flatMap((r) => ('group' in r ? r.children : [r])))

const COLUMNS = [
  { key: 'item', label: 'Anúncio', sort: 'title', width: 'w-[30%]', align: 'left' },
  { key: 'price', label: 'Preço cheio', sort: 'price', width: 'w-[9%]', align: 'right' },
  { key: 'current', label: 'Promoção atual (margem real)', sort: 'margin', width: 'w-[20%]', align: 'left' },
  { key: 'best', label: 'Melhor oferta (margem real)', sort: 'best_margin', width: 'w-[20%]', align: 'left' },
  { key: 'gain', label: 'Ganho/un.', sort: 'gain', width: 'w-[8%]', align: 'right' },
  { key: 'status', label: 'Situação', width: 'w-[13%]', align: 'left' }
]

const TONE: Record<string, string> = { ok: 'text-success', warn: 'text-warning', bad: 'text-danger', neutral: 'text-ink-3' }
const STATUS_SHORT: Record<string, string> = {
  trocar: 'trocar', acima_maxima: 'acima da máx.', sem_promocao: 'sem promoção', ok: 'na melhor', abaixo_minima: 'abaixo da mín.',
  sem_custo: 'sem custo', para_revisar: 'para revisar'
}
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
    { key: 'review', label: 'Para revisar', value: int(s.to_review), hint: 'nenhuma oferta cabe nas regras; nada foi aplicado', tone: s.to_review ? 'text-danger' : '' }
  ]
})

function toggle(row: PromotionItemRow) {
  groupPanel.value = null
  if (selected.value === row.item_id) promos.close()
  else promos.open(row.item_id)
}

/** Anúncios desta página em que dá para aplicar a melhor oferta (trocar ou entrar). */
const switchable = computed(() => allItems.value.filter((r) => !r.manual && ['trocar', 'sem_promocao', 'acima_maxima'].includes(r.status.key) && r.best).map((r) => r.item_id))
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
        <button type="button" role="tab" :aria-selected="tab === 'rotina'" class="-mb-px border-b-2 px-4 py-2 text-[14px]"
          :class="tab === 'rotina' ? 'border-primary font-semibold text-primary' : 'border-transparent text-ink-2 hover:text-ink'" data-test="aba-rotina" @click="tab = 'rotina'">
          Rotina das 03:00
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
              <span :class="t.tone && filters.status !== t.value ? t.tone : ''">{{ t.label }}</span><template v-if="response"> ({{ int(tabCount(t.value)) }})</template>
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

        <div class="card overflow-clip">
          <table class="w-full table-fixed border-collapse text-[12px]">
            <thead>
              <tr class="border-b border-line">
                <th v-for="c in COLUMNS" :key="c.key" scope="col" class="sticky top-0 z-10 border-b border-line bg-surface px-2 py-2 font-semibold text-ink-2" :class="[c.width, c.align === 'right' ? 'text-right' : 'text-left']"
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
              <template v-for="row in response?.items ?? []" v-else :key="'group' in row ? row.key : row.item_id">
                <!-- produto com variações -->
                <template v-if="'group' in row">
                  <tr class="cursor-pointer border-b border-line bg-surface hover:bg-surface-2" data-test="promo-group" @click="toggleGroup(row)">
                    <td class="px-2 py-2 align-top">
                      <div class="flex items-start gap-2">
                        <button type="button" class="mt-2 shrink-0 text-ink-3" :aria-expanded="isOpen(row)" :aria-label="isOpen(row) ? 'Recolher variações' : 'Ver variações'">
                          <ChevronDownIcon v-if="isOpen(row)" class="h-4 w-4" aria-hidden="true" />
                          <ChevronRightIcon v-else class="h-4 w-4" aria-hidden="true" />
                        </button>
                        <img v-if="row.thumbnail" :src="row.thumbnail" alt="" class="h-9 w-9 shrink-0 rounded object-cover" loading="lazy" />
                        <div class="min-w-0">
                          <p class="truncate font-semibold text-ink" :title="row.title">{{ row.title }}</p>
                          <p class="truncate text-[11px] text-ink-3">
                            {{ row.sku ?? 'produto' }} · {{ int(row.variations) }} {{ row.variations === 1 ? 'variação' : 'variações' }} · {{ int(row.count) }} anúncios
                            <template v-if="row.matched !== undefined && row.matched < row.count"> ({{ int(row.matched) }} no filtro)</template>
                          </p>
                          <button v-if="session.isAdmin" type="button" class="btn-link text-[11px]" @click.stop="openGroupPanel(row)">
                            {{ groupPanel === row.key ? 'Fechar limites do produto' : 'Limites do produto (todas as variações)' }}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td class="px-2 py-2 text-right align-top" data-numeric>
                      {{ brl(row.price_min) }}<template v-if="row.price_max > row.price_min"> a {{ brl(row.price_max) }}</template>
                    </td>
                    <td class="px-2 py-2 align-top text-[11px] text-ink-2" data-numeric>{{ row.current_margin === null ? '—' : `margem mín. ${pct(row.current_margin)}` }}</td>
                    <td class="px-2 py-2 align-top text-[11px] text-ink-2" data-numeric>{{ row.best_margin === null ? '—' : `até ${pct(row.best_margin)}` }}</td>
                    <td class="px-2 py-2 text-right align-top font-medium" data-numeric :class="row.gain && row.gain > 0 ? 'text-success' : 'text-ink-3'">
                      {{ row.gain ? `+${brl(row.gain)}` : '—' }}
                    </td>
                    <td class="px-2 py-2 align-top">
                      <span :class="tone(row.status.tone)">{{ row.status.label }}</span>
                      <span class="block text-[11px] text-ink-3">{{ Object.entries(row.statuses).map(([k, n]) => `${n} ${STATUS_SHORT[k] ?? k}`).join(' · ') }}</span>
                    </td>
                  </tr>
                  <tr v-if="groupPanel === row.key" class="border-b border-line bg-surface-2">
                    <td :colspan="COLUMNS.length" class="border-l-4 border-l-primary px-4 py-4">
                      <PromotionItemPanel
                        :detail="detail" :loading="detailLoading" :error="detailError" :is-admin="session.isAdmin" :saving="saving" :save-error="saveError"
                        :acting="acting" :action-result="actionResult" group-mode :group-count="row.count"
                        @save="promos.saveSettings" @apply="(t, sp) => promos.apply(t, sp)" @leave="() => promos.leave()" @automation="promos.setAutomation"
                      />
                    </td>
                  </tr>
                  <template v-if="isOpen(row)">
                    <template v-for="child in row.children" :key="child.item_id">
                      <PromotionRow :row="child" :is-admin="session.isAdmin" :checked="checked.includes(child.item_id)" :selected="selected === child.item_id" nested
                        @toggle="toggle(child)" @check="toggleCheck(child.item_id)" />
                      <tr v-if="selected === child.item_id && groupPanel !== row.key" class="border-b border-line bg-surface-2">
                        <td :colspan="COLUMNS.length" class="border-l-4 border-l-primary px-4 py-4">
                          <PromotionItemPanel
                            :detail="detail" :loading="detailLoading" :error="detailError" :is-admin="session.isAdmin" :saving="saving" :save-error="saveError"
                            :acting="acting" :action-result="actionResult" :has-next="hasNext"
                            @save="promos.saveSettings" @apply="onApply" @leave="onLeave" @next="goNext" @automation="promos.setAutomation"
                          />
                        </td>
                      </tr>
                    </template>
                  </template>
                </template>

                <!-- anúncio solto -->
                <template v-else>
                  <PromotionRow :row="row" :is-admin="session.isAdmin" :checked="checked.includes(row.item_id)" :selected="selected === row.item_id"
                    @toggle="toggle(row)" @check="toggleCheck(row.item_id)" />
                  <tr v-if="selected === row.item_id" class="border-b border-line bg-surface-2">
                    <td :colspan="COLUMNS.length" class="border-l-4 border-l-primary px-4 py-4">
                      <PromotionItemPanel
                        :detail="detail" :loading="detailLoading" :error="detailError" :is-admin="session.isAdmin" :saving="saving" :save-error="saveError"
                        :acting="acting" :action-result="actionResult" :has-next="hasNext"
                        @save="promos.saveSettings" @apply="onApply" @leave="onLeave" @next="goNext" @automation="promos.setAutomation"
                      />
                    </td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>

          <div v-if="response && response.total > 0" class="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-[12px] text-ink-2">
            <span>{{ int(response.total) }} {{ response.total === 1 ? 'linha' : 'linhas' }} (produtos e anúncios) · página {{ response.page }} de {{ pages }}</span>
            <div class="flex gap-2">
              <button type="button" class="btn-link" :disabled="response.page <= 1" @click="promos.setPage(response.page - 1)">Anterior</button>
              <button type="button" class="btn-link" :disabled="response.page >= pages" @click="promos.setPage(response.page + 1)">Próxima</button>
            </div>
          </div>
        </div>
      </template>

      <!-- aba Histórico -->
      <PromotionRoutinePanel v-else-if="tab === 'rotina' && session.selectedAccountId" :client="promos.client" :account-id="session.selectedAccountId" :is-admin="session.isAdmin" />

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
              <td class="px-3 py-2" :class="a.ok ? 'text-success' : 'text-danger'">{{ a.ok ? 'Feito' : 'Falhou' }}<span v-if="a.forced_reason" class="block text-[11px] text-warning" :title="`Aplicado mesmo assim, ferindo a regra: ${a.forced_reason}`">mesmo assim: {{ a.forced_reason }}</span><span v-if="a.error" class="block max-w-[280px] truncate text-[11px] text-ink-3" :title="a.error">{{ a.error }}</span></td>
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
