<script setup lang="ts">
import { ArrowDownTrayIcon, ArrowPathIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, Cog6ToothIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { BanknotesIcon, CheckBadgeIcon, ClipboardDocumentCheckIcon, ExclamationTriangleIcon, ShieldExclamationIcon, SparklesIcon } from '@heroicons/vue/24/solid'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import EmptyAccountState from '../../painel/EmptyAccountState.vue'
import PromotionRoutinePanel from '../PromotionRoutinePanel.vue'
import PromoPanelNovo from './PromoPanelNovo.vue'
import PromoRowNovo from './PromoRowNovo.vue'
import { usePageHeader } from '../../../composables/usePageHeader'
import { usePromotions } from '../../../composables/usePromotions'
import { brl, dateTimeShort, int, pct } from '../../../lib/format'
import { LIST_TABS, PROMO_TABS, ROUTINE_CHIP, chipCount, defaultChip, recentFailures, resolvePromoRoute, tabCount, tabDef, type PromoTab } from '../../../lib/promotionTabs'
import { statusBadge } from '../../../lib/promotionStatus'
import { useSessionStore } from '../../../stores/session'
import type { PromotionGroupRow, PromotionItemRow, PromotionSpread, PromotionTarget } from '../../../types/promotions'

/**
 * `/promocoes` no layout novo (27/11/2026). Mesmos dados e as mesmas ações do layout atual (`usePromotions` e a API),
 * reorganizados pela tarefa: Decidir agora → Automação → Todos os anúncios → Campanhas do ML → Histórico, com um nível só
 * de filtros (chips). A ação principal de cada anúncio fica visível na linha e abre a confirmação no painel.
 */
const session = useSessionStore()
const promos = usePromotions()
const { filters, response, loading, stale, loadError, syncing, syncMessage, exporting, selected, detail, detailLoading, detailError, saving, saveError, acting, actionResult, checked, bulkMessage, history, historyLoading, reviewBusy } = promos
const route = useRoute()
const router = useRouter()

const header = usePageHeader()
watchEffect(() => {
  header.state.title = 'Promoções'
  header.state.subtitle = session.selectedAccount ? `Mercado Livre · ${session.selectedAccount.nickname}` : 'Mercado Livre'
  header.state.sync = null
  header.state.generatedAt = null
  header.state.refreshing = promos.refreshing.value
  header.state.onRefresh = promos.refreshNow
})

// ---- guias e filtros ----
const ptab = ref<PromoTab>('decidir')
const chip = ref<string>('')
/** Primeira abertura sem filtro no endereço: escolhe o chip pelo contador quando os dados chegarem. */
let pickChip = false
const histFilter = ref('')

function syncUrl() {
  const query: Record<string, string> = { aba: ptab.value }
  if (ptab.value === 'historico' ? histFilter.value : chip.value) query.filtro = ptab.value === 'historico' ? histFilter.value : chip.value
  router.replace({ query }).catch(() => {})
}

function applyChip(value: string) {
  chip.value = value
  if (value === ROUTINE_CHIP) {
    promos.tab.value = 'rotina'
  } else {
    promos.tab.value = 'anuncios'
    promos.change({ status: value, promotionId: '', q: filters.q })
  }
  syncUrl()
}

function openTab(key: PromoTab, wanted: string | null = null) {
  ptab.value = key
  promos.close()
  if (key === 'campanhas') { promos.tab.value = 'promocoes'; chip.value = ''; syncUrl(); return }
  if (key === 'historico') { promos.tab.value = 'historico'; histFilter.value = wanted ?? ''; syncUrl(); return }
  applyChip(wanted ?? defaultChip(key, response.value?.counts))
}

onMounted(() => {
  const r = resolvePromoRoute(route.query as Record<string, unknown>)
  ptab.value = r.tab
  if (r.tab === 'campanhas') promos.tab.value = 'promocoes'
  else if (r.tab === 'historico') { promos.tab.value = 'historico'; histFilter.value = r.chip ?? '' }
  else if (r.chip === ROUTINE_CHIP) { chip.value = ROUTINE_CHIP; promos.tab.value = 'rotina' }
  else {
    pickChip = r.chip === null && r.tab === 'decidir'
    chip.value = r.chip ?? defaultChip(r.tab, undefined)
    if (chip.value === ROUTINE_CHIP) promos.tab.value = 'rotina'
    Object.assign(filters, { status: chip.value === ROUTINE_CHIP ? '' : chip.value, page: 1 })
    if (chip.value === 'para_revisar' || chip.value === 'revisar_ciente') Object.assign(filters, { sort: 'review_round', dir: 'desc' })
  }
  // endereço antigo (?aba=anuncios, ?status=…) vira o novo, para o link copiado já sair certo
  if (!pickChip) syncUrl()
  promos.start()
  promos.loadHistory()
})
onBeforeUnmount(promos.stop)

/** Sem filtro no endereço: quando os contadores chegam, "Decidir agora" abre no primeiro chip com anúncio. */
watch(() => response.value?.counts, (c) => {
  if (!pickChip || !c) return
  pickChip = false
  const best = defaultChip(ptab.value, c)
  if (best !== chip.value) applyChip(best)
  else syncUrl()
})

const current = computed(() => tabDef(ptab.value))
const isList = computed(() => LIST_TABS.includes(ptab.value) && chip.value !== ROUTINE_CHIP)
const activeChip = computed(() => current.value.chips.find((c) => c.value === (ptab.value === 'historico' ? histFilter.value : chip.value)))
function countOf(value: string) {
  return value === ROUTINE_CHIP ? null : chipCount(response.value?.counts, value)
}
const CHIP_DOT: Record<string, string> = { danger: 'bg-danger', warning: 'bg-warning', success: 'bg-success', accent: 'bg-accent' }

// ---- cartões do topo ----
const failures = computed(() => recentFailures(history.value))
const cards = computed(() => {
  const s = response.value?.summary
  if (!s) return []
  const c = response.value?.counts
  const decide = tabCount(c, 'decidir') ?? 0
  return [
    { key: 'decidir', label: 'Para decidir', value: int(decide), hint: `${int(s.to_review)} para revisar · ${int(s.to_switch)} trocas · ${int(s.without_promotion)} sem promoção`, icon: ClipboardDocumentCheckIcon, tone: 'primary', go: () => openTab('decidir') },
    { key: 'ganho', label: 'Ganho somando as trocas', value: `${s.switch_gain > 0 ? '+' : ''}${brl(s.switch_gain)}`, hint: `por unidade, somando as ${int(s.to_switch)} trocas que rendem mais${s.to_lower ? ` · ${int(s.to_lower)} para baixar até o alvo (${brl(s.lower_loss ?? 0)})` : ''}`, icon: BanknotesIcon, tone: s.switch_gain >= 0 ? 'success' : 'danger', go: () => openTab('decidir', 'trocar') },
    { key: 'abaixo', label: 'Abaixo da margem mínima', value: int(s.below_min), hint: `margem mínima geral ${pct(response.value?.rules.min_margin_pct ?? 0)}`, icon: ExclamationTriangleIcon, tone: s.below_min ? 'warning' : 'neutral', go: () => openTab('decidir', 'abaixo_minima') },
    { key: 'em', label: 'Em promoção', value: int(s.with_promotion), hint: `de ${int(s.items)} anúncios ativos`, icon: CheckBadgeIcon, tone: 'accent', bar: s.items ? Math.round((s.with_promotion / s.items) * 100) : 0, go: () => openTab('todos', '') },
    { key: 'recusas', label: 'Recusas do ML (24 h)', value: int(failures.value.length), hint: failures.value.length ? 'pode haver nova tentativa automática' : 'nenhuma recusa recente', icon: ShieldExclamationIcon, tone: failures.value.length ? 'danger' : 'neutral', go: () => openTab('historico', 'falhou') }
  ]
})
const CARD_TONE: Record<string, { icon: string; strip: string }> = {
  primary: { icon: 'bg-primary-soft text-primary', strip: 'bg-primary' },
  success: { icon: 'bg-success-soft text-success', strip: 'bg-success' },
  warning: { icon: 'bg-warning-soft text-warning', strip: 'bg-warning' },
  danger: { icon: 'bg-danger-soft text-danger', strip: 'bg-danger' },
  accent: { icon: 'bg-accent-soft text-accent-ink', strip: 'bg-accent' },
  neutral: { icon: 'bg-surface-2 text-ink-3', strip: 'bg-line' }
}
const automation = computed(() => ({ scheduled: response.value?.counts.programado ?? 0, unreachable: response.value?.counts.minima_inalcancavel ?? 0 }))

// ---- lista (mesma navegação do layout atual) ----
const expanded = ref<Set<string>>(new Set())
const hasFilters = computed(() => !!(filters.promotionId || filters.q))
function toggleGroup(g: PromotionGroupRow) {
  const next = new Set(expanded.value)
  if (next.has(g.key)) next.delete(g.key)
  else next.add(g.key)
  expanded.value = next
}
const isOpen = (g: PromotionGroupRow) => expanded.value.has(g.key) || (!!(filters.status || hasFilters.value) && g.matched !== undefined)

const groupPanel = ref<string | null>(null)
function openGroupPanel(g: PromotionGroupRow) {
  if (groupPanel.value === g.key) { groupPanel.value = null; promos.close(); return }
  groupPanel.value = g.key
  promos.open(g.item_id)
}

type WalkStop = { id: string; group: string | null }
const walkOrder = computed<WalkStop[]>(() => (response.value?.items ?? []).flatMap((r): WalkStop[] => ('group' in r ? r.children.map((c) => ({ id: c.item_id, group: r.key })) : [{ id: r.item_id, group: null }])))
function nextAfter(id: string | null): WalkStop | null {
  const list = walkOrder.value
  const i = list.findIndex((x) => x.id === id)
  return (i >= 0 ? list[i + 1] : undefined) ?? null
}
const hasNext = computed(() => !!nextAfter(selected.value))

/** Ação escolhida na linha ("Aplicar melhor"/"Aplicar cabível"): o painel abre já pedindo a confirmação. */
const autoAction = ref<'best' | 'fitting' | null>(null)

async function goTo(target: WalkStop | null) {
  if (!target) return
  groupPanel.value = null
  autoAction.value = null
  if (target.group && !expanded.value.has(target.group)) expanded.value = new Set([...expanded.value, target.group])
  promos.open(target.id)
  await nextTick()
  document.querySelector(`[data-item="${target.id}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

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

function toggle(row: PromotionItemRow) {
  groupPanel.value = null
  autoAction.value = null
  if (selected.value === row.item_id) promos.close()
  else promos.open(row.item_id)
}
function act(row: PromotionItemRow, kind: 'best' | 'fitting') {
  groupPanel.value = null
  autoAction.value = kind
  if (selected.value !== row.item_id) promos.open(row.item_id)
}

function openAlert(itemId: string) {
  ptab.value = 'todos'
  chip.value = ''
  promos.tab.value = 'anuncios'
  promos.change({ q: itemId, status: '', promotionId: '' })
  promos.open(itemId)
  syncUrl()
}
function showPromotion(promotionId: string) {
  ptab.value = 'todos'
  chip.value = ''
  promos.showPromotion(promotionId)
  syncUrl()
}

const allItems = computed<PromotionItemRow[]>(() => (response.value?.items ?? []).flatMap((r) => ('group' in r ? r.children : [r])))
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

const COLUMNS = computed(() => [
  { key: 'item', label: 'Anúncio', sort: 'title', width: 'w-[29%]' },
  { key: 'current', label: 'Hoje', sort: 'margin', width: 'w-[15%]' },
  { key: 'best', label: 'Melhor opção', sort: 'best_margin', width: 'w-[16%]' },
  { key: 'gain', label: 'Ganho/un.', sort: 'gain', width: 'w-[9%]', right: true },
  { key: 'status', label: ['para_revisar', 'revisar_ciente'].includes(filters.status) ? 'Situação · rodada' : 'Situação', sort: ['para_revisar', 'revisar_ciente'].includes(filters.status) ? 'review_round' : undefined, width: 'w-[15%]' },
  { key: 'action', label: 'Ação', width: 'w-[16%]', right: true }
])
const STATUS_SHORT: Record<string, string> = {
  trocar: 'trocar', baixar_alvo: 'baixar até o alvo', acima_maxima: 'acima da máx.', sem_promocao: 'sem promoção', ok: 'na melhor', abaixo_minima: 'abaixo da mín.',
  sem_custo: 'sem custo', para_revisar: 'para revisar', programado: 'programado', minima_inalcancavel: 'mín. inalcançável'
}
function groupRound(children: PromotionItemRow[]) {
  const list = children.filter((c) => c.review_round)
  if (!list.length) return null
  return list.find((c) => c.review_round?.after_last)?.review_round ?? list.map((c) => c.review_round!).sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))[0]
}
const pages = computed(() => (response.value ? Math.max(1, Math.ceil(response.value.total / response.value.per_page)) : 1))
const promotionName = computed(() => response.value?.promotions.find((p) => p.promotion_id === filters.promotionId)?.name ?? filters.promotionId)

function searchAll() {
  ptab.value = 'todos'
  applyChip('')
}

// ---- histórico ----
const historyRows = computed(() => {
  if (histFilter.value === 'falhou') return history.value.filter((a) => !a.ok)
  if (histFilter.value === 'forcado') return history.value.filter((a) => a.forced_reason)
  return history.value
})
function histCount(value: string) {
  if (value === 'falhou') return history.value.filter((a) => !a.ok).length
  if (value === 'forcado') return history.value.filter((a) => a.forced_reason).length
  return history.value.length
}
function setHist(value: string) {
  histFilter.value = value
  syncUrl()
}
</script>

<template>
  <EmptyAccountState v-if="!session.selectedAccount" />
  <div v-else class="page-new space-y-5" data-test="promocoes-novo">
    <!-- cabeçalho da seção -->
    <section class="relative overflow-hidden rounded-panel border border-line bg-surface px-5 py-4 shadow-panel md:px-6">
      <div class="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full opacity-[0.12] blur-2xl" style="background: radial-gradient(circle, var(--accent), transparent 70%)" aria-hidden="true" />
      <div class="pointer-events-none absolute -bottom-28 right-40 h-56 w-56 rounded-full opacity-[0.10] blur-2xl" style="background: radial-gradient(circle, var(--primary), transparent 70%)" aria-hidden="true" />
      <div class="relative flex flex-wrap items-start justify-between gap-4 xl:flex-nowrap">
        <div class="min-w-0">
          <p class="eyebrow">Central de Promoções do Mercado Livre</p>
          <h1 class="mt-1 text-[26px] font-bold tracking-tight text-ink">Decida e aplique as melhores ofertas</h1>
          <div class="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-ink-2">
            <span v-if="response" class="badge-info">Margem mínima {{ pct(response.rules.min_margin_pct) }}</span>
            <span v-if="response && response.rules.max_margin_pct !== null" class="badge-info">Máxima {{ pct(response.rules.max_margin_pct) }}</span>
            <span v-if="automation.scheduled || automation.unreachable" class="badge-accent" title="O Lunna já tem um plano para estes anúncios">
              <SparklesIcon class="h-3.5 w-3.5" aria-hidden="true" /> Automação cuidando de {{ int(automation.scheduled + automation.unreachable) }}
            </span>
            <span v-if="response?.synced_at" class="text-[13px] text-ink-3">Lida em {{ dateTimeShort(response.synced_at) }} · atualiza a cada hora</span>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="nbtn-ghost" :disabled="exporting" data-test="exportar-csv" @click="promos.exportCsv">
            <span v-if="exporting" class="nbtn-spin" aria-hidden="true" /><ArrowDownTrayIcon v-else class="h-5 w-5" aria-hidden="true" />
            {{ exporting ? 'Exportando…' : 'Exportar CSV' }}
          </button>
          <button v-if="session.isAdmin" type="button" class="nbtn-secondary" :disabled="syncing" data-test="atualizar-ml" @click="promos.syncNow">
            <ArrowPathIcon class="h-5 w-5" :class="syncing ? 'animate-spin' : ''" aria-hidden="true" />
            {{ syncing ? 'Pedindo…' : 'Atualizar do ML' }}
          </button>
          <NuxtLink v-if="session.isAdmin" to="/configuracoes?aba=promocoes" class="nbtn-secondary" data-test="configurar-promocoes">
            <Cog6ToothIcon class="h-5 w-5" aria-hidden="true" /> Configurar
          </NuxtLink>
        </div>
      </div>
      <p v-if="syncMessage" class="relative mt-3 text-[14px] text-ink-2" role="status">{{ syncMessage }}</p>
    </section>

    <p v-if="stale" role="status" class="rounded-panel border border-warning bg-warning-soft px-4 py-3 text-[14px] text-warning">Não foi possível atualizar agora — mostrando os últimos dados.</p>

    <div v-if="loadError" class="panel p-8 text-center" role="alert">
      <p class="text-[16px] font-semibold text-danger">{{ loadError }}</p>
      <button type="button" class="nbtn-secondary mt-4" @click="promos.refreshNow"><ArrowPathIcon class="h-5 w-5" aria-hidden="true" /> Tentar de novo</button>
    </div>

    <template v-else>
      <!-- cartões -->
      <div v-if="cards.length" class="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <button v-for="c in cards" :key="c.key" type="button" class="panel group relative overflow-hidden p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lift" :data-test="`kpi-${c.key}`" @click="c.go()">
          <span class="absolute inset-x-0 top-0 h-1" :class="CARD_TONE[c.tone]!.strip" aria-hidden="true" />
          <div class="flex items-start justify-between gap-2">
            <p class="text-[14px] font-semibold text-ink-2">{{ c.label }}</p>
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" :class="CARD_TONE[c.tone]!.icon"><component :is="c.icon" class="h-5 w-5" aria-hidden="true" /></span>
          </div>
          <p class="kpi-value mt-1" data-numeric>{{ c.value }}</p>
          <div v-if="c.bar !== undefined" class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><div class="h-full rounded-full bg-accent" :style="{ width: `${c.bar}%` }" /></div>
          <p class="mt-1.5 text-[13px] text-ink-3">{{ c.hint }}</p>
          <span class="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">Ver <ChevronRightIcon class="h-4 w-4" aria-hidden="true" /></span>
        </button>
      </div>
      <div v-else class="grid grid-cols-2 gap-3 lg:grid-cols-5"><div v-for="i in 5" :key="i" class="h-[150px] animate-pulse rounded-panel bg-surface-2" /></div>

      <!-- avisos de catálogo -->
      <div v-if="response?.catalog_alerts?.length" class="panel border-danger p-5" role="alert" data-test="avisos-catalogo">
        <p class="flex items-center gap-2 text-[16px] font-bold text-danger"><ExclamationTriangleIcon class="h-5 w-5" aria-hidden="true" /> Catálogo para análise manual ({{ response.catalog_alerts.length }})</p>
        <p class="text-[14px] text-ink-2">Mesmo depois de voltar ao preço anterior, estes anúncios de catálogo não estão ganhando.</p>
        <ul class="mt-2 space-y-1.5">
          <li v-for="a in response.catalog_alerts" :key="a.id" class="flex flex-wrap items-center gap-2 text-[14px]">
            <button type="button" class="font-semibold text-primary hover:underline" @click="openAlert(a.item_id)">{{ a.title || a.item_id }}</button>
            <span class="text-[13px] text-ink-3">{{ a.item_id }} · {{ a.message }}<template v-if="a.checked_at"> · {{ dateTimeShort(a.checked_at) }}</template></span>
            <button v-if="session.isAdmin" type="button" class="nbtn-ghost nbtn-sm ml-auto" @click="promos.dismissCatalogAlert(a.id)">Marcar como visto</button>
          </li>
        </ul>
      </div>

      <p v-if="response && !response.synced_at" class="panel p-6 text-center text-ink-2">
        A Central de Promoções ainda não foi lida para esta conta. {{ session.isAdmin ? 'Use "Atualizar do ML".' : 'Peça a um administrador para atualizar.' }}
      </p>

      <!-- guias -->
      <div class="space-y-3">
        <div class="ntabs" role="tablist" aria-label="Guias de Promoções">
          <button v-for="t in PROMO_TABS" :key="t.key" type="button" role="tab" :aria-selected="ptab === t.key" :class="ptab === t.key ? 'ntab-active' : 'ntab'" :data-test="`guia-${t.key}`" @click="openTab(t.key)">
            {{ t.label }}
            <span v-if="tabCount(response?.counts, t.key) !== null" class="ntab-count" :class="t.key === 'decidir' && ptab !== t.key && (response?.counts.para_revisar ?? 0) > 0 ? 'ntab-count-alert' : ''" data-numeric>
              {{ int(tabCount(response?.counts, t.key) ?? 0) }}
            </span>
            <span v-else-if="t.key === 'campanhas' && response" class="ntab-count" data-numeric>{{ int(response.promotions.length) }}</span>
          </button>
        </div>
        <p class="px-1 text-[14px] text-ink-2">{{ current.hint }}</p>

        <!-- chips -->
        <div v-if="current.chips.length" class="flex flex-wrap items-center gap-2">
          <template v-if="ptab === 'historico'">
            <button v-for="c in current.chips" :key="c.value" type="button" :class="histFilter === c.value ? 'chip-active' : 'chip'" :title="c.hint" :data-test="`filtro-${c.value || 'tudo'}`" @click="setHist(c.value)">
              <span v-if="c.tone" class="h-2 w-2 rounded-full" :class="CHIP_DOT[c.tone]" aria-hidden="true" />{{ c.label }}<span class="chip-count" data-numeric>{{ int(histCount(c.value)) }}</span>
            </button>
          </template>
          <template v-else>
            <button v-for="c in current.chips" :key="c.value" type="button" :class="chip === c.value ? 'chip-active' : 'chip'" :title="c.hint" :data-test="`filtro-${c.value || 'todos'}`" @click="applyChip(c.value)">
              <span v-if="c.tone" class="h-2 w-2 rounded-full" :class="CHIP_DOT[c.tone]" aria-hidden="true" />{{ c.label }}
              <span v-if="countOf(c.value) !== null && response" class="chip-count" data-numeric>{{ int(countOf(c.value) ?? 0) }}</span>
              <span v-if="c.value === 'catalogo' && response?.counts.catalogo_perdendo" class="badge-danger !py-0 !text-[12px]">{{ response.counts.catalogo_perdendo }} perdendo</span>
            </button>
          </template>
          <div v-if="isList" class="relative ml-auto w-full max-w-sm md:w-auto md:min-w-[320px]">
            <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <input :value="filters.q" type="search" class="input h-10 w-full pl-10" placeholder="Buscar anúncio, título ou SKU" aria-label="Buscar anúncios"
              @input="promos.change({ q: ($event.target as HTMLInputElement).value }, true)" />
          </div>
        </div>
        <p v-if="activeChip && activeChip.hint && current.chips.length > 1" class="px-1 text-[13px] text-ink-3" data-test="explica-filtro">{{ activeChip.label }}: {{ activeChip.hint }}</p>
      </div>

      <!-- lista de anúncios -->
      <template v-if="isList">
        <div v-if="filters.promotionId || (session.isAdmin && switchable.length)" class="flex flex-wrap items-center gap-2">
          <span v-if="filters.promotionId" class="badge-info !py-1.5 !text-[14px]">
            Campanha: {{ promotionName }}
            <button type="button" class="ml-1" aria-label="Tirar filtro de campanha" @click="promos.change({ promotionId: '' })"><XMarkIcon class="h-4 w-4" /></button>
          </span>
          <button v-if="session.isAdmin && switchable.length" type="button" class="nbtn-ghost nbtn-sm ml-auto" data-test="marcar-melhoraveis" @click="checkAllSwitchable">
            Marcar os {{ switchable.length }} desta página que podem melhorar
          </button>
        </div>

        <div class="panel overflow-clip">
          <table class="ntable table-fixed">
            <thead>
              <tr>
                <th v-for="c in COLUMNS" :key="c.key" scope="col" class="sticky top-16 z-10" :class="[c.width, c.right ? '!text-right' : '']"
                  :aria-sort="c.sort && response?.sort === c.sort ? (response?.dir === 'asc' ? 'ascending' : 'descending') : undefined">
                  <button v-if="c.sort" type="button" class="inline-flex items-center gap-1 uppercase hover:text-ink" :class="response?.sort === c.sort ? 'text-ink' : ''" @click="promos.sortBy(c.sort)">
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
                <tr v-for="i in 6" :key="i"><td :colspan="COLUMNS.length"><div class="h-12 animate-pulse rounded-[10px] bg-surface-2" /></td></tr>
              </template>
              <tr v-else-if="!response?.items.length">
                <td :colspan="COLUMNS.length" class="!py-14 text-center">
                  <template v-if="filters.q">
                    <p class="text-[16px] font-semibold text-ink">Nada encontrado para “{{ filters.q }}” neste filtro</p>
                    <button v-if="chip !== '' || ptab !== 'todos'" type="button" class="nbtn-secondary mt-3" data-test="buscar-em-todos" @click="searchAll">Buscar em todos os anúncios</button>
                  </template>
                  <template v-else>
                    <CheckBadgeIcon class="mx-auto h-10 w-10 text-success" aria-hidden="true" />
                    <p class="mt-2 text-[16px] font-semibold text-ink">{{ ptab === 'decidir' ? 'Nada para decidir aqui' : 'Nenhum anúncio neste filtro' }}</p>
                    <p class="text-[14px] text-ink-3">{{ ptab === 'decidir' ? 'Escolha outro filtro acima ou volte mais tarde.' : 'Tente outro filtro.' }}</p>
                  </template>
                </td>
              </tr>
              <template v-for="row in response?.items ?? []" v-else :key="'group' in row ? row.key : row.item_id">
                <!-- produto com variações -->
                <template v-if="'group' in row">
                  <tr class="cursor-pointer transition-colors hover:bg-surface-2" data-test="promo-group" @click="toggleGroup(row)">
                    <td>
                      <div class="flex items-start gap-3">
                        <button type="button" class="mt-4 shrink-0 rounded-md p-0.5 text-ink-2 hover:bg-surface-2" :aria-expanded="isOpen(row)" :aria-label="isOpen(row) ? 'Recolher variações' : 'Ver variações'">
                          <ChevronDownIcon v-if="isOpen(row)" class="h-5 w-5" aria-hidden="true" /><ChevronRightIcon v-else class="h-5 w-5" aria-hidden="true" />
                        </button>
                        <img v-if="row.thumbnail" :src="row.thumbnail" alt="" class="h-14 w-14 shrink-0 rounded-[10px] border border-line object-cover" loading="lazy" />
                        <div class="min-w-0">
                          <p class="line-clamp-2 text-[15px] font-semibold leading-snug text-ink" :title="row.title">{{ row.title }}</p>
                          <p class="mt-0.5 truncate text-[13px] text-ink-2">
                            {{ row.sku ?? 'produto' }} · {{ int(row.variations) }} {{ row.variations === 1 ? 'variação' : 'variações' }} · {{ int(row.count) }} anúncios
                            <template v-if="row.matched !== undefined && row.matched < row.count"> ({{ int(row.matched) }} no filtro)</template>
                          </p>
                          <button v-if="session.isAdmin" type="button" class="mt-1 text-[13px] font-semibold text-primary hover:underline" @click.stop="openGroupPanel(row)">
                            {{ groupPanel === row.key ? 'Fechar limites do produto' : 'Limites do produto (todas as variações)' }}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p class="text-[13px] text-ink-2">preço cheio</p>
                      <p class="text-[16px] font-bold text-ink" data-numeric>{{ brl(row.price_min) }}<template v-if="row.price_max > row.price_min"> a {{ brl(row.price_max) }}</template></p>
                      <p class="text-[13px] text-ink-2" data-numeric>{{ row.current_margin === null ? '—' : `margem mín. ${pct(row.current_margin)}` }}</p>
                    </td>
                    <td class="text-[13px] text-ink-2" data-numeric>{{ row.best_margin === null ? '—' : `até ${pct(row.best_margin)}` }}</td>
                    <td class="text-right">
                      <span v-if="row.gain" class="inline-block rounded-[8px] px-2 py-1 text-[15px] font-bold" :class="row.gain > 0 ? 'bg-success-soft text-success' : row.status.key === 'baixar_alvo' ? 'bg-surface-2 text-ink-2' : 'bg-danger-soft text-danger'" data-numeric>{{ row.gain > 0 ? '+' : '' }}{{ brl(row.gain) }}</span>
                      <span v-else class="text-ink-3">—</span>
                    </td>
                    <td>
                      <span :class="statusBadge(row.status).cls"><component :is="statusBadge(row.status).icon" class="h-3.5 w-3.5" aria-hidden="true" />{{ row.status.label }}</span>
                      <p class="mt-1 text-[12px] text-ink-3">{{ Object.entries(row.statuses).map(([k, n]) => `${n} ${STATUS_SHORT[k] ?? k}`).join(' · ') }}</p>
                      <p v-if="groupRound(row.children)" class="text-[12px] font-medium text-ink-2" data-test="rodada-revisar">{{ groupRound(row.children)?.label }}</p>
                    </td>
                    <td class="text-right">
                      <button type="button" class="nbtn-ghost nbtn-sm" :aria-expanded="isOpen(row)" @click.stop="toggleGroup(row)">
                        {{ isOpen(row) ? 'Recolher' : `Ver ${row.count}` }}
                        <ChevronDownIcon v-if="isOpen(row)" class="h-4 w-4" aria-hidden="true" /><ChevronRightIcon v-else class="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                  <tr v-if="groupPanel === row.key">
                    <td :colspan="COLUMNS.length" class="!bg-bg !p-4 shadow-[inset_4px_0_0_var(--primary)]">
                      <PromoPanelNovo
                        :detail="detail" :loading="detailLoading" :error="detailError" :is-admin="session.isAdmin" :saving="saving" :save-error="saveError"
                        :acting="acting" :action-result="actionResult" group-mode :group-count="row.count"
                        @save="promos.saveSettings" @apply="(t, sp) => promos.apply(t, sp)" @leave="() => promos.leave()" @automation="promos.setAutomation"
                      />
                    </td>
                  </tr>
                  <template v-if="isOpen(row)">
                    <template v-for="child in row.children" :key="child.item_id">
                      <PromoRowNovo :row="child" :is-admin="session.isAdmin" :checked="checked.includes(child.item_id)" :selected="selected === child.item_id" nested
                        :busy="acting && selected === child.item_id" :review-busy="reviewBusy.includes(child.item_id)"
                        @toggle="toggle(child)" @check="toggleCheck(child.item_id)" @act="(k) => act(child, k)" @review="(d) => promos.setReviewDismissed(child.item_id, d)" />
                      <tr v-if="selected === child.item_id && groupPanel !== row.key">
                        <td :colspan="COLUMNS.length" class="!bg-bg !p-4 shadow-[inset_4px_0_0_var(--primary)]">
                          <PromoPanelNovo
                            :detail="detail" :loading="detailLoading" :error="detailError" :is-admin="session.isAdmin" :saving="saving" :save-error="saveError"
                            :acting="acting" :action-result="actionResult" :has-next="hasNext" :review-busy="reviewBusy.includes(child.item_id)" :auto-action="autoAction"
                            @save="promos.saveSettings" @apply="onApply" @leave="onLeave" @next="goTo(nextAfter(selected))" @automation="promos.setAutomation"
                            @review="(d) => promos.setReviewDismissed(child.item_id, d)" @auto-done="autoAction = null"
                          />
                        </td>
                      </tr>
                    </template>
                  </template>
                </template>

                <!-- anúncio solto -->
                <template v-else>
                  <PromoRowNovo :row="row" :is-admin="session.isAdmin" :checked="checked.includes(row.item_id)" :selected="selected === row.item_id"
                    :busy="acting && selected === row.item_id" :review-busy="reviewBusy.includes(row.item_id)"
                    @toggle="toggle(row)" @check="toggleCheck(row.item_id)" @act="(k) => act(row, k)" @review="(d) => promos.setReviewDismissed(row.item_id, d)" />
                  <tr v-if="selected === row.item_id">
                    <td :colspan="COLUMNS.length" class="!bg-bg !p-4 shadow-[inset_4px_0_0_var(--primary)]">
                      <PromoPanelNovo
                        :detail="detail" :loading="detailLoading" :error="detailError" :is-admin="session.isAdmin" :saving="saving" :save-error="saveError"
                        :acting="acting" :action-result="actionResult" :has-next="hasNext" :review-busy="reviewBusy.includes(row.item_id)" :auto-action="autoAction"
                        @save="promos.saveSettings" @apply="onApply" @leave="onLeave" @next="goTo(nextAfter(selected))" @automation="promos.setAutomation"
                        @review="(d) => promos.setReviewDismissed(row.item_id, d)" @auto-done="autoAction = null"
                      />
                    </td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>

          <div v-if="response && response.total > 0" class="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[14px] text-ink-2">
            <span>{{ int(response.total) }} {{ response.total === 1 ? 'linha' : 'linhas' }} (produtos e anúncios) · página {{ response.page }} de {{ pages }}</span>
            <div class="flex gap-2">
              <button type="button" class="nbtn-secondary nbtn-sm" :disabled="response.page <= 1" @click="promos.setPage(response.page - 1)">← Anterior</button>
              <button type="button" class="nbtn-secondary nbtn-sm" :disabled="response.page >= pages" @click="promos.setPage(response.page + 1)">Próxima →</button>
            </div>
          </div>
        </div>
      </template>

      <!-- rotina automática (guia Automação) -->
      <PromotionRoutinePanel v-else-if="ptab === 'automacao' && chip === ROUTINE_CHIP && session.selectedAccountId" :client="promos.client" :account-id="session.selectedAccountId" :is-admin="session.isAdmin" />

      <!-- histórico -->
      <div v-else-if="ptab === 'historico'" class="panel overflow-x-auto">
        <table class="ntable">
          <thead>
            <tr>
              <th scope="col">Quando</th>
              <th scope="col">Anúncio</th>
              <th scope="col">O que fez</th>
              <th scope="col">De</th>
              <th scope="col">Para</th>
              <th scope="col" class="!text-right">Ganho/un.</th>
              <th scope="col">Resultado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="historyLoading && !history.length"><td colspan="7" class="!py-8 text-center text-ink-3"><span class="nbtn-spin mr-2 align-middle text-primary" aria-hidden="true" />Carregando…</td></tr>
            <tr v-else-if="!historyRows.length"><td colspan="7" class="!py-12 text-center text-ink-3">{{ histFilter ? 'Nada neste filtro.' : 'Nenhuma ação ainda.' }}</td></tr>
            <tr v-for="a in historyRows" :key="a.id">
              <td class="whitespace-nowrap text-[13px]">{{ dateTimeShort(a.created_at) }}<span class="block text-ink-3">{{ a.source_label }}<template v-if="a.user"> · {{ a.user }}</template></span></td>
              <td><span class="block max-w-[280px] truncate font-semibold text-ink" :title="a.title ?? ''">{{ a.title ?? a.item_id }}</span><span class="text-[13px] text-ink-3">{{ a.item_id }}</span></td>
              <td>{{ a.kind_label }}</td>
              <td class="text-[13px]">{{ a.from ? `${a.from.name} · ${brl(a.from.price)} · ${pct(a.from.margin_pct)}` : '—' }}</td>
              <td class="text-[13px]">{{ a.to ? `${a.to.name} · ${brl(a.to.price)} · ${pct(a.to.margin_pct)}` : '—' }}</td>
              <td class="text-right font-semibold" data-numeric>{{ a.gain ? brl(a.gain) : '—' }}</td>
              <td>
                <span :class="a.ok ? 'badge-success' : 'badge-danger'">{{ a.ok ? '✓ Feito' : '✕ Falhou' }}</span>
                <span v-if="a.forced_reason" class="mt-1 block text-[12px] font-medium text-warning" :title="`Aplicado mesmo assim, ferindo a regra: ${a.forced_reason}`">mesmo assim: {{ a.forced_reason }}</span>
                <span v-if="a.error" class="mt-1 block max-w-[300px] truncate text-[12px] text-ink-3" :title="a.error">{{ a.error }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="border-t border-line px-4 py-3 text-right"><button type="button" class="nbtn-ghost nbtn-sm" @click="promos.loadHistory"><ArrowPathIcon class="h-4 w-4" aria-hidden="true" /> Atualizar</button></div>
      </div>

      <!-- campanhas do ML -->
      <div v-else-if="ptab === 'campanhas'" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="p in response?.promotions ?? []" :key="p.promotion_id" class="panel flex flex-col p-5">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate text-[16px] font-bold text-ink" :title="p.name || p.label">{{ p.name || p.label }}</p>
              <p class="text-[13px] text-ink-3">{{ p.label }} · {{ p.promotion_id }}</p>
            </div>
            <span :class="p.status === 'started' ? 'badge-success' : p.status === 'pending' ? 'badge-accent' : 'badge-neutral'">{{ p.status === 'started' ? 'Ativa' : p.status === 'pending' ? 'Programada' : p.status }}</span>
          </div>
          <p class="mt-2 text-[13px] text-ink-2">{{ p.start_date ? dateTimeShort(p.start_date) : '' }}<template v-if="p.finish_date"> até {{ dateTimeShort(p.finish_date) }}</template></p>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <div class="rounded-[10px] bg-surface-2 px-3 py-2"><p class="text-[12px] text-ink-3">Anúncios ativos</p><p class="text-[20px] font-bold text-ink" data-numeric>{{ int(p.active_items) }}</p></div>
            <div class="rounded-[10px] bg-surface-2 px-3 py-2"><p class="text-[12px] text-ink-3">Candidatos</p><p class="text-[20px] font-bold text-ink" data-numeric>{{ int(p.candidate_items) }}</p></div>
          </div>
          <button type="button" class="nbtn-secondary mt-4 w-full" data-test="ver-anuncios-campanha" @click="showPromotion(p.promotion_id)">Ver anúncios <ChevronRightIcon class="h-4 w-4" aria-hidden="true" /></button>
        </div>
        <p v-if="!response?.promotions.length" class="panel col-span-full p-10 text-center text-ink-3">Nenhuma campanha lida da Central ainda.</p>
      </div>
    </template>

    <!-- barra de ação em lote -->
    <Transition enter-from-class="translate-y-6 opacity-0" enter-active-class="transition duration-200" leave-to-class="translate-y-6 opacity-0" leave-active-class="transition duration-150">
      <div v-if="session.isAdmin && checked.length && isList" class="sticky bottom-4 z-20 mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-panel border border-line bg-surface px-4 py-3 shadow-lift" data-test="barra-lote">
        <span class="flex h-8 min-w-8 items-center justify-center rounded-full bg-primary px-2 text-[14px] font-bold text-primary-ink">{{ checked.length }}</span>
        <span class="text-[14px] font-semibold text-ink">{{ checked.length === 1 ? 'anúncio marcado' : 'anúncios marcados' }}</span>
        <template v-if="!confirmingBulk">
          <button type="button" class="nbtn-primary ml-auto" :disabled="acting" data-test="aplicar-lote" @click="confirmingBulk = true"><SparklesIcon class="h-5 w-5" aria-hidden="true" /> Aplicar a melhor oferta</button>
          <button type="button" class="nbtn-ghost" @click="checked = []">Desmarcar</button>
        </template>
        <div v-else class="w-full rounded-[10px] bg-warning-soft p-3 text-[14px]" role="alertdialog" aria-label="Confirmar aplicação em lote">
          <p class="text-ink">
            O Lunna vai aplicar no Mercado Livre a melhor oferta de {{ checked.length }} {{ checked.length === 1 ? 'anúncio' : 'anúncios' }}, um de cada vez,
            relendo as ofertas de cada um antes. Os preços mudam na hora; cada resultado fica no Histórico.
          </p>
          <div class="mt-2 flex gap-2">
            <button type="button" class="nbtn-primary nbtn-sm" :disabled="acting" data-test="confirmar-lote" @click="runBulk">Confirmar</button>
            <button type="button" class="nbtn-ghost nbtn-sm" @click="confirmingBulk = false">Cancelar</button>
          </div>
        </div>
      </div>
    </Transition>
    <p v-if="bulkMessage" class="pop-in panel px-4 py-3 text-[14px] text-ink-2" role="status">{{ bulkMessage }}</p>
  </div>
</template>
