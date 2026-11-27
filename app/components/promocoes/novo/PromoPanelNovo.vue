<script setup lang="ts">
import { ArrowLongRightIcon, ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/vue/24/outline'
import { SparklesIcon } from '@heroicons/vue/20/solid'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { usePromotionPanel } from '../../../composables/usePromotionPanel'
import { brl, pct } from '../../../lib/format'
import { promotionValidity } from '../../../lib/promotionValidity'
import type { PromotionItemDetail, PromotionSettingsInput, PromotionSpread, PromotionTarget } from '../../../types/promotions'

/**
 * Painel de um anúncio em Promoções no layout novo (27/11/2026). Mesma lógica do painel do layout atual
 * (`usePromotionPanel`: confirmações, contas, "aplicar mesmo assim", cabível, outro valor, limites), com a decisão em
 * destaque no topo: hoje → melhor opção, o ganho e o botão que resolve. Os detalhes (custos e todas as ofertas) vêm
 * abaixo. `autoAction` abre já com a confirmação da ação escolhida na linha da lista.
 */
const props = defineProps<{
  detail: PromotionItemDetail | null
  loading: boolean
  error: string
  isAdmin: boolean
  saving: boolean
  saveError: string
  acting: boolean
  actionResult: { ok: boolean; message: string } | null
  groupMode?: boolean
  groupCount?: number
  hasNext?: boolean
  reviewBusy?: boolean
  autoAction?: 'best' | 'fitting' | null
}>()
const emit = defineEmits<{
  save: [input: PromotionSettingsInput]
  apply: [target: PromotionTarget | undefined, spread: PromotionSpread, goNext: boolean]
  leave: [goNext: boolean]
  next: []
  automation: [enabled: boolean, spread: { sku: boolean; variations: boolean }]
  review: [dismissed: boolean]
  autoDone: []
}>()

const {
  pending, spread, dialogEl, canApplyBest, askBest, askOffer, forceable, blockedOffers, askForceOffer, askLeave, useSuggestion,
  confirm, cancel, JOINABLE, manual, saveManual, form, savedNote, submitLimits, COST_ROWS, today, cols, askFitting,
  blocked, custom, customPrice, customRange, customError, customPreview, askForce, askCustom, ACTION, range, isBest
} = usePromotionPanel(props, emit)

/** Ação pedida na linha da lista: abre a confirmação assim que as ofertas chegam (nunca aplica sozinho). */
watch(() => [props.detail, props.autoAction] as const, ([d, a]) => {
  if (!d || !a || props.groupMode) return
  if (a === 'best' && canApplyBest.value) askBest()
  else if (a === 'fitting' && d.review?.fitting) askFitting()
  emit('autoDone')
}, { immediate: true })

const fitting = computed(() => props.detail?.review?.fitting ?? null)
/** Botão principal do painel: a melhor oferta; sem ela, a cabível. */
const primary = computed<'best' | 'fitting' | null>(() => (canApplyBest.value ? 'best' : fitting.value ? 'fitting' : null))

/** Nova tentativa automática (o ML recusou logo depois de sair da promoção): a API tenta a cada 2 min por 20 min. */
const retryAt = ref<number | null>(null)
const now = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null
watch(() => props.actionResult, (r) => {
  retryAt.value = r && !r.ok && /Nova tentativa em 2 minutos/i.test(r.message) ? Date.now() : null
  if (retryAt.value && !tick) tick = setInterval(() => { now.value = Date.now() }, 1000)
})
onBeforeUnmount(() => { if (tick) clearInterval(tick) })
const retry = computed(() => {
  if (!retryAt.value) return null
  const elapsed = Math.max(0, now.value - retryAt.value)
  const total = 20 * 60 * 1000
  if (elapsed > total) return { done: true, pct: 100, next: '' }
  const left = 120_000 - (elapsed % 120_000)
  const m = Math.floor(left / 60000)
  const s = Math.floor((left % 60000) / 1000)
  return { done: false, pct: Math.round((elapsed / total) * 100), next: `${m}:${String(s).padStart(2, '0')}` }
})

/** "Baixar preço até o alvo": o botão não sugere ganho (o lucro por unidade cai, dentro da tolerância). */
const lowering = computed(() => props.detail?.status.key === 'baixar_alvo' && (props.detail?.gain ?? 0) < 0)
const REF_SOURCE: Record<string, string> = { inicial: 'implantação', automacao: 'antes da 1ª redução da automação', manual: 'sua última decisão' }
const pp = (v: number) => `${v.toFixed(1).replace('.', ',')} p.p.`
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const COLUMN_STYLE: Record<string, string> = { ok: 'border-primary', blocked: 'border-danger', fit: 'border-success' }
const name = (o: { name: string | null; label: string }) => o.name || o.label
</script>

<template>
  <div v-if="loading" class="flex items-center gap-3 py-2 text-[14px] text-ink-2"><span class="nbtn-spin text-primary" aria-hidden="true" /> Carregando as ofertas deste anúncio…</div>
  <p v-else-if="error" class="text-[14px] text-danger" role="alert">{{ error }}</p>

  <div v-else-if="detail" class="pop-in grid grid-cols-1 gap-5 text-[14px]" :class="groupMode ? 'xl:grid-cols-2' : 'xl:grid-cols-[minmax(0,1fr)_320px]'" data-test="promo-detail">
    <!-- produto com variações: só os limites -->
    <div v-if="groupMode" class="panel p-5 text-ink-2">
      <p class="panel-title">Limites do produto</p>
      <p class="mt-1">
        O que você salvar aqui vale para todos os {{ groupCount ?? detail.variation_total + 1 }} anúncios deste produto (todas as variações e os
        anúncios do mesmo SKU). Para ver as ofertas e aplicar uma promoção, abra cada anúncio na lista.
      </p>
      <p v-if="detail.review" class="mt-2 font-medium text-danger">Este produto tem anúncios para revisar: {{ detail.review.label }}.</p>
    </div>

    <div v-else class="min-w-0 space-y-4">
      <!-- decisão: hoje → melhor opção -->
      <div class="panel p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="panel-title">O que fazer neste anúncio</p>
            <p class="panel-sub mt-0.5">
              Preço cheio {{ brl(detail.full_price) }} · custo {{ detail.cost === null ? 'sem custo' : brl(detail.cost) }} · Ads nos últimos {{ detail.ads.days }} dias:
              <template v-if="detail.ads.spend > 0">{{ brl(detail.ads.spend) }} ÷ {{ detail.ads.units }} {{ detail.ads.units === 1 ? 'unidade' : 'unidades' }} = {{ brl(detail.ads.unit) }}/un.<template v-if="detail.ads.units === 0"> (gastou sem vender; fica zero na conta)</template></template>
              <template v-else>sem gasto (zero na conta)</template>
            </p>
            <p v-if="detail.drop_ref" class="mt-1 text-[13px] text-ink-2" data-test="referencia-reducao">
              <span class="font-semibold text-ink">Referência da redução:</span> {{ pct(detail.drop_ref.ref_pct) }}
              <template v-if="detail.drop_ref.set_at"> em {{ shortDate(detail.drop_ref.set_at) }} ({{ REF_SOURCE[detail.drop_ref.source ?? ''] ?? detail.drop_ref.source }})</template>
              <template v-else> (margem de hoje{{ detail.drop_ref.renewed ? ', renovada' : '' }})</template>
              · tolerância usada {{ pp(detail.drop_ref.used_pp) }} de {{ pp(detail.drop_ref.tolerance_pp) }}
              · não desce abaixo de {{ pct(detail.drop_ref.floor_pct) }}
            </p>
          </div>
          <a v-if="detail.permalink" :href="detail.permalink" target="_blank" rel="noopener" class="nbtn-ghost nbtn-sm">Ver no Mercado Livre ↗</a>
        </div>

        <div v-if="today" class="mt-4 grid items-stretch gap-3" :class="cols.length === 2 ? 'lg:grid-cols-[1fr_auto_1fr_1fr]' : cols.length === 1 ? 'md:grid-cols-[1fr_auto_1fr]' : ''">
          <div class="rounded-[12px] border border-line bg-surface-2 p-4">
            <p class="eyebrow">{{ today.title }}</p>
            <p class="truncate text-[13px] text-ink-2" :title="today.sub">{{ today.sub }}</p>
            <p class="mt-2 text-[24px] font-bold leading-none text-ink" data-numeric>{{ brl(today.price) }}</p>
            <p class="mt-1.5 text-[15px] font-bold" :class="(today.profit ?? 0) < 0 ? 'text-danger' : 'text-success'" data-numeric>{{ brl(today.profit) }} <span class="text-[13px] font-semibold">· {{ pct(today.margin) }}</span></p>
            <p class="text-[12px] text-ink-3">lucro real por unidade (pós Ads)</p>
            <p v-if="today.validity" class="mt-1 text-[12px] text-ink-3" data-test="validade-hoje">Validade: {{ today.validity }}</p>
          </div>
          <div v-if="cols.length" class="hidden items-center justify-center text-ink-3 md:flex" aria-hidden="true"><ArrowLongRightIcon class="h-7 w-7" /></div>
          <div v-for="c in cols" :key="c.title" class="relative rounded-[12px] border-2 bg-surface p-4" :class="COLUMN_STYLE[c.tone]" :data-test="c.tone === 'fit' ? 'coluna-cabivel' : undefined">
            <p class="eyebrow" :class="c.tone === 'blocked' ? '!text-danger' : c.tone === 'fit' ? '!text-success' : '!text-primary'">{{ c.title }}</p>
            <p class="truncate text-[13px] text-ink-2" :title="c.sub">{{ c.sub }}</p>
            <p class="mt-2 text-[24px] font-bold leading-none text-ink" data-numeric>{{ brl(c.price) }}</p>
            <p class="mt-1.5 text-[15px] font-bold" :class="(c.profit ?? 0) < 0 ? 'text-danger' : 'text-success'" data-numeric>{{ brl(c.profit) }} <span class="text-[13px] font-semibold">· {{ pct(c.margin) }}</span></p>
            <p class="text-[12px] text-ink-3">lucro real por unidade (pós Ads)</p>
            <p v-if="c.validity" class="mt-1 text-[12px] text-ink-3" data-test="validade-melhor">Validade: {{ c.validity }}</p>
            <span v-if="c.tone === 'ok' && detail.gain" class="absolute -top-3 right-3 rounded-full px-2.5 py-0.5 text-[13px] font-bold shadow-card" :class="detail.gain > 0 ? 'bg-success text-white' : 'bg-surface-2 text-ink-2'" data-numeric>
              {{ detail.gain > 0 ? '+' : '' }}{{ brl(detail.gain) }}/un.{{ detail.gain < 0 ? ' para vender mais barato' : '' }}
            </span>
          </div>
        </div>

        <p v-if="!blocked && fitting" class="mt-3 text-[13px] text-ink-2" data-test="cabivel">
          <strong class="text-success">Oferta cabível:</strong> {{ name(fitting) }} a {{ brl(fitting.price) }} cabe nos limites (margem {{ pct(fitting.margin_pct) }})<template v-if="fitting.soft_reason">, mas {{ fitting.soft_reason }}</template>.
        </p>

        <!-- ações -->
        <div v-if="isAdmin" class="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button v-if="primary === 'best' && lowering" type="button" class="nbtn-secondary nbtn-lg" :disabled="acting" data-test="aplicar-melhor" @click="askBest">
            Baixar o preço até o alvo ({{ brl(detail.gain) }}/un.)
          </button>
          <button v-else-if="primary === 'best'" type="button" class="nbtn-primary nbtn-lg" :disabled="acting" data-test="aplicar-melhor" @click="askBest">
            <SparklesIcon class="h-5 w-5" aria-hidden="true" /> Aplicar a melhor oferta
          </button>
          <button v-if="fitting && (primary === 'fitting' || blocked)" type="button" :class="primary === 'fitting' ? 'nbtn-success nbtn-lg' : 'nbtn-secondary'" :disabled="acting" data-test="aplicar-cabivel"
            :title="fitting.soft_reason ?? 'cabe nas regras'" @click="askFitting">
            Aplicar a cabível ({{ brl(fitting.price) }})
          </button>
          <button v-if="blocked && !blocked.hard" type="button" class="nbtn-warning" :disabled="acting" data-test="aplicar-mesmo-assim" @click="askForce">
            Aplicar mesmo assim ({{ brl(blocked.short.price) }})
          </button>
          <button v-if="detail.current" type="button" class="nbtn-ghost" :disabled="acting" @click="askLeave">Sair da promoção</button>
          <button v-if="detail.status.key === 'para_revisar' && !detail.manual" type="button" class="nbtn-secondary" :disabled="acting || reviewBusy"
            :data-test="detail.review_dismissed ? 'voltar-revisar' : 'ciente'"
            :title="detail.review_dismissed ? 'Volta o anúncio para a guia Para revisar' : 'Tira o anúncio de Para revisar sem mudar nada nele (ele volta se sair da revisão e entrar de novo)'"
            @click="emit('review', !detail.review_dismissed)">
            {{ detail.review_dismissed ? 'Voltar para revisar' : 'Ciente, nada a ser feito' }}
          </button>
          <button v-if="hasNext" type="button" class="nbtn-ghost ml-auto" :disabled="acting" data-test="proximo" title="Abre o próximo anúncio da lista sem mudar nada neste" @click="emit('next')">
            Próximo anúncio <ArrowLongRightIcon class="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <!-- confirmação -->
        <div v-if="pending" ref="dialogEl" class="pop-in mt-4 rounded-[12px] border-2 border-warning bg-warning-soft p-4" role="alertdialog" aria-label="Confirmar ação no Mercado Livre">
          <div class="flex gap-3">
            <ExclamationTriangleIcon class="h-6 w-6 shrink-0 text-warning" aria-hidden="true" />
            <div class="min-w-0 flex-1">
              <p class="text-[15px] font-semibold text-ink">Confirme antes de mudar no Mercado Livre</p>
              <p class="mt-1 text-ink">{{ pending.text }}</p>
              <div v-if="pending.spreadable && (detail.sku_items.length || detail.variation_items.length)" class="mt-3 space-y-2 text-ink-2">
                <label v-if="detail.variation_items.length" class="flex items-start gap-2">
                  <input v-model="spread.alsoVariations" type="checkbox" class="mt-1 h-4 w-4" data-test="tambem-variacoes" />
                  <span>
                    Aplicar a mesma promoção às outras {{ detail.variation_items.length }} {{ detail.variation_items.length === 1 ? 'variação' : 'variações' }} do produto
                    <span class="block text-[13px] text-ink-3">O anúncio equivalente a este em cada variação<template v-if="detail.sku_items.length">; com o SKU marcado abaixo, todos os {{ detail.variation_total }} anúncios das variações</template>.</span>
                  </span>
                </label>
                <label v-if="detail.sku_items.length" class="flex items-start gap-2">
                  <input v-model="spread.alsoSku" type="checkbox" class="mt-1 h-4 w-4" data-test="tambem-sku" />
                  <span>Aplicar a mesma promoção aos outros {{ detail.sku_items.length }} {{ detail.sku_items.length === 1 ? 'anúncio' : 'anúncios' }} do SKU {{ detail.sku }}</span>
                </label>
                <p class="text-[13px] text-ink-3">Cada um entra pelo próprio preço de venda e pelos próprios limites; o que não couber fica no Histórico com o motivo.</p>
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <button type="button" class="nbtn-primary" :disabled="acting" data-test="confirmar" @click="confirm(false)"><CheckCircleIcon class="h-5 w-5" aria-hidden="true" /> Confirmar</button>
                <button v-if="hasNext" type="button" class="nbtn-secondary" :disabled="acting" data-test="confirmar-proximo" @click="confirm(true)">Confirmar e ir para o próximo</button>
                <button type="button" class="nbtn-ghost" @click="cancel">Cancelar</button>
              </div>
            </div>
          </div>
        </div>

        <!-- andamento e resultado -->
        <div v-if="acting" class="mt-4 flex items-center gap-3 rounded-[12px] bg-primary-soft px-4 py-3 font-medium text-primary" role="status">
          <span class="nbtn-spin" aria-hidden="true" /> Falando com o Mercado Livre…
        </div>
        <div v-else-if="actionResult" class="pop-in mt-4 flex gap-3 rounded-[12px] px-4 py-3" :class="actionResult.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'" role="status" data-test="resultado-acao">
          <CheckCircleIcon v-if="actionResult.ok" class="h-6 w-6 shrink-0" aria-hidden="true" /><XCircleIcon v-else class="h-6 w-6 shrink-0" aria-hidden="true" />
          <div class="min-w-0">
            <p class="font-semibold">{{ actionResult.ok ? 'Feito no Mercado Livre' : 'O Mercado Livre não aceitou' }}</p>
            <p class="text-ink">{{ actionResult.message }}</p>
          </div>
        </div>
        <div v-if="retry" class="mt-3 rounded-[12px] border border-line bg-surface-2 px-4 py-3" data-test="nova-tentativa">
          <p class="flex items-center gap-2 font-semibold text-ink"><ArrowPathIcon class="h-5 w-5 text-primary" :class="retry.done ? '' : 'animate-spin [animation-duration:3s]'" aria-hidden="true" />
            {{ retry.done ? 'As tentativas rápidas terminaram' : `Nova tentativa automática em ~${retry.next}` }}
          </p>
          <p class="mt-0.5 text-[13px] text-ink-2">O Lunna tenta de novo sozinho a cada 2 minutos por 20 minutos e, depois, de hora em hora. Cada tentativa aparece no Histórico.</p>
          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${retry.pct}%` }" /></div>
        </div>
      </div>

      <!-- fora das regras -->
      <div v-if="!detail.review && blockedOffers.length" class="panel p-5" data-test="barradas-resumo">
        <p class="panel-title">Ofertas barradas pelas suas regras ({{ blockedOffers.length }})</p>
        <p class="panel-sub">O anúncio está na melhor oferta dentro das regras. Estas ficaram de fora; na tabela de ofertas, cada uma tem "Aplicar mesmo assim".</p>
        <ul class="mt-2 space-y-1">
          <li v-for="(o, i) in blockedOffers" :key="i">
            <span class="font-semibold text-ink">{{ name(o) }}</span> · {{ o.price ? brl(o.price) : '—' }}<template v-if="o.margin_pct !== null"> · margem {{ pct(o.margin_pct) }}</template><template v-if="o.profit !== null"> · lucro {{ brl(o.profit) }}</template>
            · <span class="text-danger">{{ o.reason }}</span>
          </li>
        </ul>
      </div>
      <div v-if="isAdmin && blocked" class="panel border-danger p-5" data-test="forcar">
        <p class="panel-title">Aplicar fora das regras</p>
        <p class="mt-1 text-ink-2">
          A melhor oferta está barrada por: <span class="font-semibold text-danger">{{ blocked.short.reason }}</span>. Você pode aplicá-la mesmo assim (botão acima) ou escolher outro valor;
          o Lunna registra no Histórico a regra que foi ferida.
        </p>
        <p v-if="blocked.hard" class="mt-1 font-medium text-danger">Esta não dá para aplicar: o Mercado Livre recusaria ({{ blocked.short.reason }}).</p>
        <template v-else-if="customRange">
          <div class="mt-3 flex flex-wrap items-end gap-2">
            <label class="block">
              <span class="field-label">Outro valor</span>
              <select v-model="custom.mode" class="input h-10 w-[210px] text-[14px]" aria-label="Tipo de valor">
                <option value="price">Preço final (R$)</option>
                <option value="pct">Desconto (%) sobre o cheio</option>
              </select>
            </label>
            <input v-model="custom.value" type="number" step="0.01" min="0" class="input h-10 w-[130px]" :placeholder="custom.mode === 'price' ? 'ex.: 89,90' : 'ex.: 15'"
              :aria-label="custom.mode === 'price' ? 'Preço final em reais' : 'Desconto em porcentagem'" data-test="outro-valor" />
            <button type="button" class="nbtn-secondary" :disabled="acting || !customPreview || !!customError" data-test="aplicar-outro-valor" @click="askCustom">Aplicar este valor</button>
          </div>
          <p class="mt-2 text-[13px] text-ink-2">
            Faixa aceita pelo Mercado Livre: {{ brl(customRange.min) }} a {{ brl(customRange.max) }}.
            <template v-if="customPreview && !customError">
              Fica {{ brl(customPrice) }} ({{ pct(customPreview.discount) }} de desconto) · margem real aprox.
              <span class="font-semibold" :class="customPreview.profit < 0 ? 'text-danger' : 'text-ink'">{{ pct(customPreview.margin) }}</span>, lucro aprox. {{ brl(customPreview.profit) }}.
            </template>
            <span v-if="customError" class="font-medium text-danger">{{ customError }}</span>
          </p>
        </template>
        <p v-else class="mt-2 text-[13px] text-ink-3">Esta oferta tem preço fixo dado pelo Mercado Livre: não dá para escolher outro valor.</p>
      </div>

      <!-- custos por unidade -->
      <details v-if="today" class="panel group overflow-hidden" data-test="custos">
        <summary class="flex cursor-pointer list-none items-center justify-between px-5 py-4">
          <span class="panel-title">Custos por unidade</span>
          <span class="text-[13px] font-semibold text-primary group-open:hidden">Mostrar</span><span class="hidden text-[13px] font-semibold text-primary group-open:inline">Esconder</span>
        </summary>
        <div class="overflow-x-auto border-t border-line">
          <table class="ntable">
            <thead>
              <tr>
                <th scope="col">Por unidade</th>
                <th scope="col" class="!text-right">{{ today.title }}<span class="block text-[11px] font-normal normal-case tracking-normal text-ink-3">{{ today.sub }}</span></th>
                <th v-for="c in cols" :key="c.title" scope="col" class="!text-right">{{ c.title }}<span class="block text-[11px] font-normal normal-case tracking-normal text-ink-3">{{ c.sub }}</span></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="!py-2">Preço de venda</td>
                <td class="!py-2 text-right" data-numeric>{{ brl(today.price) }}</td>
                <td v-for="c in cols" :key="c.title" class="!py-2 text-right" data-numeric>{{ brl(c.price) }}</td>
              </tr>
              <tr v-if="today.costs.meli_amount || cols.some((c) => c.costs.meli_amount)">
                <td class="!py-2">Parte paga pelo ML</td>
                <td class="!py-2 text-right" data-numeric>+ {{ brl(today.costs.meli_amount) }}</td>
                <td v-for="c in cols" :key="c.title" class="!py-2 text-right" data-numeric>+ {{ brl(c.costs.meli_amount) }}</td>
              </tr>
              <tr v-for="r in COST_ROWS" :key="r.key" class="text-ink-2">
                <td class="!py-2">{{ r.label }}</td>
                <td class="!py-2 text-right" data-numeric>− {{ brl(today.costs[r.key]) }}</td>
                <td v-for="c in cols" :key="c.title" class="!py-2 text-right" data-numeric>− {{ brl(c.costs[r.key]) }}</td>
              </tr>
              <tr class="font-bold">
                <td class="!py-2.5">Lucro real (pós Ads)</td>
                <td class="!py-2.5 text-right" data-numeric :class="(today.profit ?? 0) < 0 ? 'text-danger' : 'text-success'">{{ brl(today.profit) }} · {{ pct(today.margin) }}</td>
                <td v-for="c in cols" :key="c.title" class="!py-2.5 text-right" data-numeric :class="(c.profit ?? 0) < 0 ? 'text-danger' : 'text-success'">{{ brl(c.profit) }} · {{ pct(c.margin) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <!-- todas as ofertas -->
      <div class="panel overflow-hidden">
        <div class="panel-head pb-3"><p class="panel-title">Todas as ofertas deste anúncio ({{ detail.offers.length }})</p></div>
        <div class="overflow-x-auto">
          <table class="ntable">
            <thead>
              <tr>
                <th scope="col">Promoção</th>
                <th scope="col">Situação</th>
                <th scope="col" class="!text-right">Preço</th>
                <th scope="col" class="!text-right">Parte do ML</th>
                <th scope="col" class="!text-right">Tarifa</th>
                <th scope="col" class="!text-right">Margem real</th>
                <th scope="col">Validade</th>
                <th v-if="isAdmin" scope="col"><span class="sr-only">Ação</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(o, i) in detail.offers" :key="i" :class="[isBest(o) ? 'bg-success-soft' : '', o.valid ? '' : 'text-ink-3']">
                <td class="!py-2.5">
                  <span class="font-semibold" :class="o.valid ? 'text-ink' : ''">{{ name(o) }}</span>
                  <span class="block text-[12px] text-ink-3">{{ o.label }}<template v-if="o.flexible"> · faixa {{ range(o) }}</template><template v-if="o.stock_reserved"> · reserva {{ o.stock_reserved }} un.</template></span>
                  <span v-if="isBest(o)" class="badge-success mt-1">★ Melhor margem</span>
                </td>
                <td class="!py-2.5">
                  {{ ACTION[o.action] }}
                  <span v-if="forceable(o)" class="mt-0.5 block text-[12px] font-semibold text-danger" data-test="oferta-barrada">Barrada pela regra: {{ o.reason }}</span>
                  <span v-else-if="o.reason" class="block text-[12px]">{{ o.reason }}</span>
                </td>
                <td class="!py-2.5 text-right font-semibold" data-numeric>{{ o.price ? brl(o.price) : '—' }}</td>
                <td class="!py-2.5 text-right" data-numeric>{{ o.meli_amount ? brl(o.meli_amount) : '—' }}</td>
                <td class="!py-2.5 text-right" data-numeric>{{ o.fee === null ? '—' : brl(o.fee) }}</td>
                <td class="!py-2.5 text-right font-bold" data-numeric :class="!o.valid && o.margin_pct !== null ? 'text-danger' : o.margin_pct !== null && o.margin_pct >= 0 ? 'text-success' : ''">
                  {{ o.margin_pct === null ? '—' : pct(o.margin_pct) }}
                  <span v-if="o.profit !== null" class="block text-[12px] font-normal text-ink-3">{{ brl(o.profit) }}</span>
                </td>
                <td class="!py-2.5 text-[13px]">{{ promotionValidity(o, true) }}</td>
                <td v-if="isAdmin" class="!py-2.5 text-right">
                  <button v-if="o.valid && o.action !== 'manter' && JOINABLE.includes(o.type)" type="button" class="nbtn-secondary nbtn-sm" :disabled="acting" @click="askOffer(o)">
                    {{ o.action === 'editar_preco' ? 'Ajustar' : 'Entrar' }}
                  </button>
                  <button v-else-if="forceable(o)" type="button" class="nbtn-warning nbtn-sm" :disabled="acting" data-test="aplicar-mesmo-assim-oferta" @click="askForceOffer(o)">Aplicar mesmo assim</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- coluna da direita: automação e limites -->
    <div class="space-y-4">
      <div class="panel space-y-3 p-5" :class="manual.on ? '!border-warning' : ''" data-test="nao-automatizar">
        <label class="flex items-start gap-3">
          <input v-model="manual.on" type="checkbox" class="mt-1 h-4 w-4" :disabled="!isAdmin" @change="manual.dirty = true" />
          <span>
            <span class="font-semibold text-ink">Não automatizar promoções {{ groupMode ? 'neste produto' : 'neste anúncio' }}</span>
            <span class="block text-[13px] text-ink-3">A rotina automática e o lote não mexem; só muda pela tela. A melhor oferta continua sugerida.</span>
          </span>
        </label>
        <template v-if="manual.dirty || manual.on !== detail.manual">
          <label v-if="detail.variation_items.length && !groupMode" class="ml-7 flex items-start gap-2 text-[13px] text-ink-2">
            <input v-model="manual.variations" type="checkbox" class="mt-0.5" :disabled="!isAdmin" />
            <span>Aplicar também às outras variações do produto ({{ detail.variation_total }} anúncios)</span>
          </label>
          <label v-if="detail.sku_items.length" class="ml-7 flex items-start gap-2 text-[13px] text-ink-2">
            <input v-model="manual.sku" type="checkbox" class="mt-0.5" :disabled="!isAdmin" />
            <span>Aplicar também aos outros {{ detail.sku_items.length }} anúncios do mesmo SKU</span>
          </label>
          <button v-if="isAdmin" type="button" class="nbtn-secondary w-full" :disabled="saving" @click="saveManual">
            {{ manual.on ? 'Marcar como não automatizado' : 'Voltar a automatizar' }}
          </button>
        </template>
      </div>

      <form class="panel space-y-3 p-5" @submit.prevent="submitLimits">
        <p class="panel-title">{{ groupMode ? 'Limites do produto (todas as variações)' : 'Limites deste anúncio' }}</p>
        <div v-if="detail.review && !groupMode" class="space-y-1 rounded-[10px] border border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger" data-test="review-reason">
          <p><span class="font-semibold">Para revisar:</span> {{ detail.review.label }}</p>
          <p v-if="detail.review.blocked_best">Melhor oferta barrada: {{ detail.review.blocked_best.label }}<template v-if="detail.review.blocked_best.name"> “{{ detail.review.blocked_best.name }}”</template> a {{ brl(detail.review.blocked_best.price) }} · {{ detail.review.blocked_best.shortfall }}</p>
          <p v-if="detail.review.suggestion" class="text-ink">
            <span class="font-semibold">Para caber:</span> {{ detail.review.suggestion }}
            <button v-if="isAdmin && detail.review.suggested" type="button" class="btn-link ml-1" data-test="usar-sugestao" @click="useSuggestion">Usar a sugestão</button>
          </p>
          <p v-if="detail.review.reasons.length > 1" class="text-ink-3">Outras regras: {{ detail.review.reasons.slice(1).map((r) => `${r.reason} (${r.offers})`).join('; ') }}</p>
        </div>
        <div class="seg w-full" role="radiogroup" aria-label="Limitar a promoção por">
          <button type="button" role="radio" :aria-checked="form.limit_mode === 'margin'" class="flex-1" :class="form.limit_mode === 'margin' ? 'seg-btn-active' : 'seg-btn'" :disabled="!isAdmin" @click="form.limit_mode = 'margin'">Por margem (%)</button>
          <button type="button" role="radio" :aria-checked="form.limit_mode === 'price'" class="flex-1" :class="form.limit_mode === 'price' ? 'seg-btn-active' : 'seg-btn'" :disabled="!isAdmin" @click="form.limit_mode = 'price'">Por valor (R$)</button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="field-label">Margem mínima (%)</span>
            <input v-model="form.min_margin_pct" type="number" step="0.1" class="input" :placeholder="`Geral: ${detail.settings.effective_min_pct}`" :disabled="!isAdmin || form.limit_mode !== 'margin'" />
          </label>
          <label class="block">
            <span class="field-label">Margem máxima (%)</span>
            <input v-model="form.max_margin_pct" type="number" step="0.1" class="input" :placeholder="detail.settings.effective_max_pct === null ? 'Sem teto' : `Geral: ${detail.settings.effective_max_pct}`" :disabled="!isAdmin || form.limit_mode !== 'margin'" />
          </label>
          <label class="block">
            <span class="field-label">Valor mínimo (R$)</span>
            <input v-model="form.min_price" type="number" step="0.01" class="input" placeholder="Sem piso" :disabled="!isAdmin || form.limit_mode !== 'price'" />
          </label>
          <label class="block">
            <span class="field-label">Valor máximo (R$)</span>
            <input v-model="form.max_price" type="number" step="0.01" class="input" placeholder="Sem teto" :disabled="!isAdmin || form.limit_mode !== 'price'" />
          </label>
        </div>
        <p class="text-[13px] text-ink-3">
          <template v-if="form.limit_mode === 'margin'">Margem real, pós Ads. Acima da máxima o Lunna aplica um desconto maior, para o preço não subir demais.</template>
          <template v-else>Preço da promoção. Oferta abaixo do valor mínimo não entra; nas de faixa, o preço fica até o valor máximo.</template>
        </p>
        <label class="block">
          <span class="field-label">Regras específicas deste anúncio{{ groupMode ? ' (todas as variações)' : '' }} · texto livre</span>
          <textarea v-model="form.rules_note" rows="3" class="input h-auto py-2 text-[14px]" maxlength="2000" :disabled="!isAdmin"
            placeholder="Ex.: nunca entrar em oferta relâmpago; manter abaixo de um preço na Black Friday" />
          <span class="mt-1 block text-[12px] text-ink-3">Fica guardado com o anúncio e aparece na lista; a rotina automática não mexe em anúncio com regra própria.</span>
        </label>
        <label v-if="detail.sku_items.length" class="flex items-start gap-2">
          <input v-model="form.apply_to_sku" type="checkbox" class="mt-1" :disabled="!isAdmin || groupMode" />
          <span class="text-[13px] text-ink-2">
            Aplicar aos outros {{ detail.sku_items.length }} {{ detail.sku_items.length === 1 ? 'anúncio' : 'anúncios' }} do SKU {{ detail.sku }}
            <span class="block text-[12px] text-ink-3">{{ detail.sku_items.map((s) => s.item_id).join(', ') }}</span>
          </span>
        </label>
        <label v-if="detail.variation_items.length" class="flex items-start gap-2">
          <input v-model="form.apply_to_variations" type="checkbox" class="mt-1" :disabled="!isAdmin || groupMode" />
          <span class="text-[13px] text-ink-2">
            Aplicar às outras variações do produto ({{ detail.variation_total }} {{ detail.variation_total === 1 ? 'anúncio' : 'anúncios' }})
            <span class="block text-[12px] text-ink-3">{{ [...new Set(detail.variation_items.map((v) => v.sku))].slice(0, 6).join(', ') }}<template v-if="new Set(detail.variation_items.map((v) => v.sku)).size > 6">…</template></span>
          </span>
        </label>
        <p v-if="saveError" class="text-[13px] text-danger" role="alert">{{ saveError }}</p>
        <p v-else-if="savedNote" class="pop-in flex items-center gap-1.5 text-[13px] font-semibold text-success" role="status" data-test="limites-salvos"><CheckCircleIcon class="h-5 w-5" aria-hidden="true" />{{ savedNote }}</p>
        <button v-if="isAdmin" type="submit" class="nbtn-secondary w-full" :disabled="saving">
          <span v-if="saving" class="nbtn-spin" aria-hidden="true" />{{ saving ? 'Salvando…' : 'Salvar limites' }}
        </button>
        <p v-else class="text-[13px] text-ink-3">Só administradores mudam os limites.</p>
      </form>
    </div>
  </div>
</template>
