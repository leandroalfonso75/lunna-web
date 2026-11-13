<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import AbcPhotoGenerator from './AbcPhotoGenerator.vue'
import AbcPriceScenarios from './AbcPriceScenarios.vue'
import AbcSpecsEditor from './AbcSpecsEditor.vue'
import AbcTitleEditor from './AbcTitleEditor.vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import { useSessionStore } from '../../stores/session'
import AiPlanPanel from './AiPlanPanel.vue'
import { brl, dateShort, int, pct } from '../../lib/format'
import { SUGGESTION_PRIORITY_CLASS, SUGGESTION_PRIORITY_LABEL } from '../../lib/suggestionPriority'
import type { AbcItemDetail, AbcRow, AbcSuggestion, ThreeState } from '../../types/painel'

const props = defineProps<{
  row: AbcRow
  detail: AbcItemDetail | undefined
  loading: boolean
  loadError: boolean
}>()

const emit = defineEmits<{ retry: []; changed: [] }>()

const { $api } = useNuxtApp()
const session = useSessionStore()
const toast = useToast()

/** Janelas de "Alterar título AGORA" e "Alterar ficha técnica AGORA" (pedido do usuário em 07/11/2026). */
const editing = ref<'titulo' | 'ficha' | null>(null)
const acking = ref<string | null>(null)

/**
 * Outras variações do mesmo anúncio pai (pedido do usuário em 13/11/2026): cada variação é um anúncio próprio no ML,
 * da mesma família. Outro anúncio do mesmo produto (catálogo, outro tipo) não entra. Lidas uma vez por anúncio aberto.
 */
const variations = ref(0)
async function loadVariations() {
  try {
    const res = await $api<{ count: number }>(`/api/items/${props.row.id}/variations`, { query: { account_id: session.selectedAccountId } })
    variations.value = res.count
  } catch {
    variations.value = 0
  }
}
onMounted(loadVariations)
watch(() => props.row.id, loadVariations)

/** Ciente com variações: pergunta antes se vale também para as outras variações do anúncio. */
const askAck = ref<{ s: AbcSuggestion; kind: 'aplicada' | 'aguardar' } | null>(null)
function requestAck(s: AbcSuggestion, kind: 'aplicada' | 'aguardar') {
  if (variations.value > 0) askAck.value = { s, kind }
  else void ack(s, kind, false)
}

/** "Ciente" em Vídeo, Tipo de anúncio e Qualidade: aplicada no ML ou aguardar (some e volta em 15 dias se nada mudar). */
async function ack(s: AbcSuggestion, kind: 'aplicada' | 'aguardar', all = false) {
  askAck.value = null
  acking.value = s.key
  try {
    const res = await $api<{ message: string }>(`/api/items/${props.row.id}/suggestion_acks`, {
      method: 'POST', query: { account_id: session.selectedAccountId }, body: { key: s.key, kind, apply_to_variations: all }
    })
    toast.success(res.message)
    emit('changed')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível registrar agora.'))
  } finally {
    acking.value = null
  }
}

/** Curva ABC > Fotos: janela de geração de imagens (aberta pela ação "Gerar fotos" da sugestão de fotos). */
const photoCount = ref<number | null>(null)

/** Classe de cor para as linhas de lucro/margem — só reflete `margin_state` e
 * `profit_state` (já decididos pela API); o front não decide se a margem está ruim. */
function marginClass(state: ThreeState | null, profitState: ThreeState | null = null): string {
  if (state === 'bad' || profitState === 'bad') return 'text-danger'
  if (state === 'warn') return 'text-warning'
  return 'text-ink'
}
</script>

<template>
  <div v-if="loading" class="space-y-2">
    <div class="h-4 w-1/2 animate-pulse rounded bg-surface-2" />
    <div class="h-24 animate-pulse rounded bg-surface-2" />
  </div>

  <div v-else-if="loadError" class="text-center">
    <p class="text-[14px] text-danger">Não foi possível carregar o detalhe deste anúncio.</p>
    <button type="button" class="btn-link mt-2" @click="$emit('retry')">Tentar de novo</button>
  </div>

  <div v-else-if="detail" class="space-y-5 text-[13px]">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="card p-4">
        <p class="mb-2 font-semibold text-ink">Indicadores 30d</p>

        <div class="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1">
          <span />
          <span class="text-right text-[11px] font-medium uppercase tracking-wide text-ink-3">Atual</span>
          <span class="text-right text-[11px] font-medium uppercase tracking-wide text-ink-3">Anterior</span>

          <span class="text-ink-2">Visitas</span>
          <span class="text-right text-ink" data-numeric>{{ int(detail.indicators.visits) }}</span>
          <span class="text-right text-ink-3" data-numeric>{{ int(detail.indicators.prev_visits) }}</span>

          <span class="text-ink-2">Vendas</span>
          <span class="text-right text-ink" data-numeric>{{ int(detail.indicators.units) }}</span>
          <span class="text-right text-ink-3" data-numeric>{{ int(detail.indicators.prev_units) }}</span>
        </div>

        <dl class="mt-2 border-t border-line pt-1">
          <div class="def-row"><dt>Conversão</dt><dd data-numeric>{{ pct(detail.indicators.conversion) }}</dd></div>
          <div class="def-row"><dt>Participação</dt><dd data-numeric>{{ pct(detail.indicators.share_pct) }}</dd></div>
          <div class="def-row"><dt>Acumulado</dt><dd data-numeric>{{ pct(detail.indicators.cum_pct) }}</dd></div>
        </dl>
      </div>

      <div class="card p-4">
        <p class="mb-2 font-semibold text-ink">Resultado do mês</p>
        <dl>
          <div class="def-row"><dt>Faturamento</dt><dd data-numeric>{{ brl(detail.month.revenue) }}</dd></div>
          <div class="def-row"><dt>Tarifas</dt><dd data-numeric>{{ brl(detail.month.fees) }}</dd></div>
          <div class="def-row"><dt>Frete</dt><dd data-numeric>{{ brl(detail.month.shipping) }}</dd></div>
          <div class="def-row"><dt>Imposto</dt><dd data-numeric>{{ brl(detail.month.tax) }}</dd></div>
          <div class="def-row"><dt>Custo</dt><dd data-numeric>{{ detail.month.cost !== null ? brl(detail.month.cost) : '—' }}</dd></div>
          <div class="def-row mt-1 border-t border-line pt-2 text-[14px] font-semibold" :class="marginClass(detail.month.margin_state, detail.month.profit_state)">
            <dt>{{ detail.month.profit_is_before_cost ? 'Lucro antes do custo' : 'Lucro antes Ads do mês' }}</dt>
            <dd data-numeric>{{ brl(detail.month.profit) }} <span class="font-normal">({{ detail.month.margin_pct !== null ? pct(detail.month.margin_pct) : '—' }})</span></dd>
          </div>
        </dl>
      </div>

      <div class="card p-4">
        <p class="mb-2 font-semibold text-ink">Por unidade</p>
        <dl>
          <div class="def-row">
            <dt>Preço</dt>
            <dd data-numeric>
              <span v-if="detail.unit.full_price" class="mr-1 font-normal text-ink-3 line-through">{{ brl(detail.unit.full_price) }}</span>
              {{ brl(detail.unit.price) }}
            </dd>
          </div>
          <div class="def-row"><dt>Tarifa</dt><dd data-numeric>{{ brl(detail.unit.fee) }}</dd></div>
          <div class="def-row"><dt>Frete</dt><dd data-numeric>{{ brl(detail.unit.shipping) }}</dd></div>
          <div class="def-row"><dt>Imposto</dt><dd data-numeric>{{ brl(detail.unit.tax) }}</dd></div>
          <div class="def-row"><dt>Custo</dt><dd data-numeric>{{ detail.unit.cost !== null ? brl(detail.unit.cost) : '—' }}</dd></div>
          <div class="def-row mt-1 border-t border-line pt-2 text-[14px] font-semibold" :class="marginClass(detail.unit.margin_state, detail.unit.profit_state)">
            <dt>{{ detail.month.profit_is_before_cost ? 'Lucro antes do custo' : 'Lucro' }}</dt>
            <dd data-numeric>{{ brl(detail.unit.profit) }} <span class="font-normal">({{ detail.unit.margin_pct !== null ? pct(detail.unit.margin_pct) : '—' }})</span></dd>
          </div>
        </dl>
      </div>

      <div class="card p-4">
        <p class="mb-2 font-semibold text-ink">Cadastro</p>
        <dl>
          <div class="def-row"><dt>Estoque</dt><dd data-numeric>{{ int(detail.listing.stock) }}</dd></div>
          <div class="def-row"><dt>Tipo</dt><dd>{{ detail.listing.listing_type_label ?? '—' }}</dd></div>
          <div class="def-row"><dt>Fotos</dt><dd data-numeric>{{ detail.listing.pictures }}</dd></div>
          <div class="def-row"><dt>Vídeo</dt><dd>{{ detail.listing.has_video ? 'Sim' : 'Não' }}</dd></div>
          <div class="def-row"><dt>Descrição</dt><dd data-numeric>{{ detail.listing.description_len }} caract.</dd></div>
          <div class="def-row"><dt>Título</dt><dd data-numeric>{{ detail.listing.title_len }}/60</dd></div>
          <div class="def-row"><dt>Qualidade</dt><dd>{{ detail.listing.quality_score !== null ? `${detail.listing.quality_score}/100` : 'não calculada' }}</dd></div>
        </dl>
      </div>
    </div>

    <div>
      <p class="mb-2 font-semibold text-ink">O que fazer para vender mais</p>
      <p v-if="detail.price_hold" class="mb-2 rounded-card border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink-2" data-test="preco-em-maturacao">
        {{ detail.price_hold.kind === 'aplicada' ? 'Preço sugerido aplicado' : 'Você escolheu não aplicar nenhum preço sugerido' }}:
        sem novas sugestões de preço até {{ dateShort(detail.price_hold.until) }} (tempo de maturação de 15 dias).
      </p>
      <p v-if="!detail.suggestions.length" class="text-ink-3">Nada pendente para este anúncio.</p>
      <ul v-else class="space-y-2">
        <li v-for="(s, i) in detail.suggestions" :key="i" class="flex items-start gap-3 rounded-card border border-line p-3">
          <span class="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="SUGGESTION_PRIORITY_CLASS[s.priority]">
            {{ SUGGESTION_PRIORITY_LABEL[s.priority] }}
          </span>
          <div class="min-w-0">
            <p class="text-[11px] font-medium uppercase tracking-wide text-ink-3">{{ s.area }}</p>
            <p class="font-medium text-ink">{{ s.title }}</p>
            <p class="text-ink-2">{{ s.why }}</p>
            <ul v-if="s.steps?.length" class="mt-1 list-disc space-y-0.5 pl-4 text-[13px] text-ink-2" data-test="sugestao-medidas">
              <li v-for="(m, k) in s.steps" :key="k">{{ m }}</li>
            </ul>
            <AbcPriceScenarios v-if="s.options?.length" :item-id="row.id" :options="s.options" :calculator="s.calculator" :variations="variations" @changed="emit('changed')" />
            <button
              v-if="s.options?.length && ['preço', 'frete'].includes(s.area)" type="button" class="btn-secondary mt-2 h-8 text-[12px]"
              :disabled="acking === 'preço:*'" data-test="preco-nao-aplicar"
              title="As sugestões de preço deixam de aparecer por 15 dias"
              @click="requestAck({ ...s, key: 'preço:*' }, 'aguardar')"
            >Não aplicar nenhum preço sugerido</button>
            <button
              v-if="s.action?.kind === 'gerar_fotos'"
              type="button"
              class="btn-secondary mt-2 h-8 text-[12px]"
              data-test="sugestao-gerar-fotos"
              @click="photoCount = s.action.suggested_count"
            >Gerar fotos com IA</button>
            <button
              v-else-if="s.action?.kind === 'alterar_titulo'"
              type="button" class="btn-primary mt-2 h-8 text-[12px]" data-test="sugestao-alterar-titulo"
              @click="editing = 'titulo'"
            >Alterar título AGORA</button>
            <button
              v-else-if="s.action?.kind === 'alterar_ficha'"
              type="button" class="btn-primary mt-2 h-8 text-[12px]" data-test="sugestao-alterar-ficha"
              @click="editing = 'ficha'"
            >Alterar ficha técnica AGORA</button>
            <div v-else-if="s.action?.kind === 'ciente'" class="mt-2 flex flex-wrap gap-2" data-test="sugestao-ciente">
              <button type="button" class="btn-secondary h-8 text-[12px]" :disabled="acking === s.key" @click="requestAck(s, 'aplicada')">Ciente, sugestão aplicada no Mercado Livre</button>
              <button
                type="button" class="btn-secondary h-8 text-[12px]" :disabled="acking === s.key"
                title="A sugestão deixa de aparecer; se nada mudar em 15 dias, ela volta"
                @click="requestAck(s, 'aguardar')"
              >Ciente, aguardar</button>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <div class="card p-4" :class="detail.price.low ? 'border-danger bg-danger-soft' : ''">
      <p class="mb-2 font-semibold text-ink">Referência de preço do Mercado Livre</p>

      <p v-if="detail.price.kind === 'loading'" class="text-ink-3">Calculando referência de preço…</p>
      <p v-else-if="detail.price.kind === 'none'" class="text-ink-3">Sem referência de preço para este anúncio.</p>

      <template v-else>
        <p class="text-ink-2">{{ detail.price.status_text }}</p>

        <template v-if="detail.price.kind === 'suggestion'">
          <div class="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span class="text-[24px] font-semibold text-ink" data-numeric>{{ brl(detail.price.suggested) }}</span>
            <span
              v-if="detail.price.diff_pct !== null"
              class="text-[13px] font-medium"
              :class="(detail.price.diff_pct ?? 0) < 0 ? 'text-danger' : 'text-success'"
              data-numeric
            >
              {{ detail.price.diff_pct > 0 ? '+' : '' }}{{ pct(detail.price.diff_pct) }}
            </span>
            <span v-if="detail.price.lowest !== null" class="text-[13px] text-ink-3">menor visto: {{ brl(detail.price.lowest) }}</span>
          </div>

          <dl v-if="detail.price.fee !== null" class="mt-2">
            <div class="def-row"><dt>Tarifa no sugerido</dt><dd data-numeric>{{ brl(detail.price.fee) }}</dd></div>
            <div class="def-row"><dt>Frete no sugerido</dt><dd data-numeric>{{ brl(detail.price.shipping) }}</dd></div>
            <div class="def-row"><dt>Imposto no sugerido</dt><dd data-numeric>{{ brl(detail.price.tax) }}</dd></div>
            <div v-if="detail.price.profit !== null" class="def-row">
              <dt>Lucro no sugerido</dt>
              <dd data-numeric>{{ brl(detail.price.profit) }} ({{ detail.price.margin_pct !== null ? pct(detail.price.margin_pct) : '—' }})</dd>
            </div>
            <div v-else-if="detail.price.max_cost !== null" class="def-row">
              <dt>Custo máximo p/ margem mínima</dt>
              <dd data-numeric>{{ brl(detail.price.max_cost) }}</dd>
            </div>
          </dl>

          <p v-if="detail.price.message" class="mt-2 text-[13px] font-semibold text-danger">{{ detail.price.message }}</p>
        </template>

        <div v-if="detail.price.competitors.length" class="mt-3">
          <p class="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-3">Concorrentes comparados</p>
          <table class="w-full text-[13px]">
            <tbody>
              <tr v-for="(c, i) in detail.price.competitors" :key="i" class="border-t border-line first:border-t-0">
                <td class="whitespace-nowrap py-1 pr-3 font-medium text-ink" data-numeric>{{ brl(c.price) }}</td>
                <td class="py-1 text-ink-2">{{ c.title }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <div class="flex flex-wrap gap-4">
      <a :href="detail.links.public" target="_blank" rel="noopener" class="btn-link">Ver anúncio publicado</a>
      <a :href="detail.links.seller_panel" target="_blank" rel="noopener" class="btn-link">Ver no painel do vendedor</a>
    </div>

    <AiPlanPanel :item-id="row.id" />
  </div>
  <AbcTitleEditor v-if="editing === 'titulo'" :item-id="row.id" @close="editing = null" @changed="emit('changed')" />
  <AbcSpecsEditor v-if="editing === 'ficha'" :item-id="row.id" :variations="variations" @close="editing = null" @changed="emit('changed')" />
  <div v-if="askAck" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" data-test="ciente-variacoes" @click.self="askAck = null">
    <div class="card w-full max-w-md space-y-3 p-5 text-[13px]">
      <p class="text-[15px] font-semibold text-ink">Aplicar às outras variações?</p>
      <p class="text-ink-2">
        Este anúncio tem mais {{ variations }} {{ variations === 1 ? 'variação' : 'variações' }} no mesmo anúncio pai.
        Quer marcar "{{ askAck.kind === 'aplicada' ? 'Ciente, sugestão aplicada' : 'Ciente, aguardar' }}" também nelas?
      </p>
      <p class="text-[12px] text-ink-3">Outros anúncios do mesmo produto (catálogo ou outro tipo de anúncio) não entram.</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-primary h-9" data-test="ciente-todas" @click="ack(askAck.s, askAck.kind, true)">Sim, em todas as variações</button>
        <button type="button" class="btn-secondary h-9" data-test="ciente-so-este" @click="ack(askAck.s, askAck.kind, false)">Só neste anúncio</button>
        <button type="button" class="btn-link" @click="askAck = null">Cancelar</button>
      </div>
    </div>
  </div>
  <AbcPhotoGenerator v-if="photoCount !== null && detail" :item-id="row.id" :title="row.title" :suggested-count="photoCount" @close="photoCount = null" />
</template>
