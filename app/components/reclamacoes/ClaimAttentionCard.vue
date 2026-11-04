<script setup lang="ts">
import { ArrowUturnLeftIcon, BanknotesIcon, ChatBubbleLeftEllipsisIcon, ClockIcon, ExclamationTriangleIcon, ScaleIcon } from '@heroicons/vue/24/outline'
import { computed, ref } from 'vue'
import { apiErrorMessage } from '../../lib/apiErrors'
import { brl, dateTimeShort } from '../../lib/format'
import { useSessionStore } from '../../stores/session'
import type { ClaimRow } from '../../types/claims'

/**
 * Cartão de uma reclamação aberta na visão "A atender": prazo (com contagem regressiva), o que o ML pede, o que o
 * comprador quer, reputação, custos (reembolso, frete da devolução), última mensagem, ações liberadas pelo ML e a
 * resposta, que vai para a reclamação no Mercado Livre (com confirmação: não se desfaz).
 */
const props = defineProps<{ claim: ClaimRow; canReply: boolean; sending: boolean }>()
const emit = defineEmits<{ reply: [claimId: number, receiver: string, text: string]; resolve: [claimId: number, action: string, percentage: number | null] }>()

// "Responder" abre as opções (como no ML): mensagem, oferecer devolução, reembolsar, reembolso parcial, mediação.
// Cada uma pede confirmação; nada vai ao ML sem o segundo clique (pedido do usuário em 04/11/2026).
const menu = ref(false)
const pending = ref<string | null>(null)
const percentage = ref<number | null>(null)
const offers = ref<{ amount: number; percentage: number }[]>([])
const offersError = ref('')
// "Oferecer devolução": o custo do frete da devolução para o vendedor (aviso antes de confirmar, como no ML)
const returnCost = ref<{ amount: number; free: boolean } | null>(null)
const returnCostError = ref('')
const loadingCost = ref(false)
const RESOLVE: Record<string, { label: string; text: string; danger: boolean }> = {
  allow_return: { label: 'Oferecer devolução', danger: true, text: 'O Mercado Livre gera a etiqueta para o comprador devolver o produto; o dinheiro é devolvido quando a devolução for postada.' },
  refund: { label: 'Reembolsar o dinheiro', danger: true, text: 'O Mercado Livre devolve todo o dinheiro ao comprador e encerra a reclamação. O produto fica com o comprador.' },
  partial_refund: { label: 'Oferecer reembolso parcial', danger: true, text: 'O comprador recebe a oferta; se aceitar, recebe esse valor e a reclamação é encerrada.' },
  open_dispute: { label: 'Falar com o Mercado Livre', danger: false, text: 'Pede a mediação do Mercado Livre. Depois disso, as mensagens vão para o mediador, não mais para o comprador.' }
}
const { $api } = useNuxtApp()
const session = useSessionStore()
const resolveActions = computed(() => (props.claim.resolve_actions ?? []).filter((a) => RESOLVE[a]))
const hasOptions = computed(() => !!props.claim.reply_targets?.length || resolveActions.value.length > 0)

async function choose(action: string) {
  pending.value = action
  confirming.value = false
  open.value = false
  if (action === 'allow_return' && !returnCost.value) {
    returnCostError.value = ''
    loadingCost.value = true
    try {
      returnCost.value = await $api<{ amount: number; free: boolean }>(`/api/claims/${props.claim.claim_id}/return_cost`, { query: { account_id: session.selectedAccountId } })
    } catch (err) {
      returnCostError.value = apiErrorMessage(err, 'O Mercado Livre não informou o custo do frete de devolução.')
    } finally {
      loadingCost.value = false
    }
  }
  if (action === 'partial_refund' && !offers.value.length) {
    offersError.value = ''
    try {
      const res = await $api<{ available_offers: { amount: number; percentage: number }[] }>(`/api/claims/${props.claim.claim_id}/partial_refund_offers`, { query: { account_id: session.selectedAccountId } })
      offers.value = res.available_offers ?? []
    } catch (err) {
      offersError.value = apiErrorMessage(err, 'O Mercado Livre não informou os valores de reembolso parcial.')
    }
  }
}
function runResolve() {
  if (!pending.value) return
  if (pending.value === 'partial_refund' && !percentage.value) return
  if (!confirming.value) {
    confirming.value = true
    return
  }
  emit('resolve', props.claim.claim_id, pending.value, pending.value === 'partial_refund' ? percentage.value : null)
}

const open = ref(false)
const confirming = ref(false)
const receiver = ref(props.claim.reply_targets?.[0] ?? 'complainant')
const text = ref('')
const RECEIVER_LABEL: Record<string, string> = { complainant: 'Comprador', mediator: 'Mediador do Mercado Livre' }

const hoursLeft = computed(() => (props.claim.deadline ? (new Date(props.claim.deadline).getTime() - Date.now()) / 36e5 : null))
const deadlineText = computed(() => {
  const h = hoursLeft.value
  if (h === null) return 'sem prazo informado'
  if (h < 0) return 'prazo vencido'
  if (h < 24) return `vence em ${Math.max(1, Math.round(h))} h`
  return `vence em ${Math.round(h / 24)} dia${Math.round(h / 24) === 1 ? '' : 's'}`
})
// vermelho/amarelo só quando o prazo é seu (a reclamação aguarda você); prazo do comprador fica neutro
const urgency = computed(() => {
  const h = hoursLeft.value
  if (h === null || !props.claim.to_attend) return 'border-line bg-surface-2 text-ink-2'
  if (h < 24) return 'border-danger bg-danger-soft text-danger'
  if (h < 72) return 'border-warning bg-warning-soft text-warning'
  return 'border-line bg-surface-2 text-ink-2'
})

function send() {
  if (!text.value.trim()) return
  if (!confirming.value) {
    confirming.value = true
    return
  }
  emit('reply', props.claim.claim_id, receiver.value, text.value.trim())
}
function reset() {
  confirming.value = false
  text.value = ''
  open.value = false
  menu.value = false
  pending.value = null
  percentage.value = null
}
defineExpose({ reset })
</script>

<template>
  <article class="card overflow-hidden" :class="claim.to_attend ? 'border-2 border-warning' : ''" data-test="atender-cartao">
    <header class="flex flex-wrap items-start gap-3 border-b border-line p-3">
      <img v-if="claim.order?.item?.thumbnail" :src="claim.order.item.thumbnail" alt="" class="h-14 w-14 shrink-0 rounded object-cover" loading="lazy" />
      <div class="min-w-0 flex-1">
        <p class="flex flex-wrap items-center gap-2">
          <span v-if="claim.to_attend" class="rounded-full bg-warning px-2 py-0.5 text-[11px] font-bold uppercase text-white">Aguardando você</span>
          <span class="text-[15px] font-semibold text-ink">{{ claim.type_label }}<template v-if="claim.stage_label && claim.stage_label !== '—'"> · {{ claim.stage_label }}</template></span>
          <span class="text-[12px] text-ink-3">#{{ claim.claim_id }} · aberta em {{ dateTimeShort(claim.date_created) }}</span>
        </p>
        <p class="truncate text-[13px] text-ink" :title="claim.order?.item?.title ?? ''">{{ claim.order?.item?.title ?? 'Venda fora do Lunna' }}</p>
        <p class="text-[12px] text-ink-3">
          <template v-if="claim.order">Venda #{{ claim.order.order_id }} · {{ claim.order.item?.sku ?? 'sem SKU' }} · {{ brl(claim.order.total) }} · {{ claim.order.buyer_name ?? claim.order.buyer_nickname ?? '' }}</template>
        </p>
      </div>
      <div class="rounded-card border px-3 py-1.5 text-right" :class="urgency" data-test="atender-prazo">
        <p class="flex items-center justify-end gap-1 text-[13px] font-bold"><ClockIcon class="h-4 w-4" aria-hidden="true" />{{ claim.to_attend ? 'Seu prazo: ' : 'Prazo: ' }}{{ deadlineText }}</p>
        <p class="text-[11px]">{{ claim.deadline ? `até ${dateTimeShort(claim.deadline)}` : '' }}<template v-if="claim.action_responsible_label"> · quem age: {{ claim.action_responsible_label }}</template></p>
      </div>
    </header>

    <div class="grid grid-cols-2 gap-3 p-3 text-[12px] md:grid-cols-4">
      <div>
        <p class="text-ink-3">Motivo</p>
        <p class="font-medium text-ink">{{ claim.reason ?? '—' }}</p>
      </div>
      <div>
        <p class="text-ink-3">O comprador quer</p>
        <p class="font-medium text-ink">{{ claim.buyer_wants?.length ? claim.buyer_wants.join(', ') : '—' }}</p>
      </div>
      <div>
        <p class="text-ink-3">Reputação</p>
        <p class="font-semibold" :class="claim.affects_reputation ? 'text-danger' : 'text-ink'">
          <ExclamationTriangleIcon v-if="claim.affects_reputation" class="mr-0.5 inline h-4 w-4" aria-hidden="true" />{{ claim.affects_reputation === true ? 'Afeta' : claim.affects_reputation === false ? 'Não afeta' : '—' }}
        </p>
      </div>
      <div>
        <p class="text-ink-3">Custos</p>
        <p class="font-medium text-ink">
          {{ claim.refund?.label ?? '—' }}<template v-if="claim.refund?.amount"> ({{ brl(claim.refund.amount) }})</template>
        </p>
        <p class="text-ink-2">Frete da devolução: {{ claim.freight?.label ?? '—' }}<template v-if="claim.freight?.amount"> · {{ brl(claim.freight.amount) }}</template><template v-if="claim.freight?.covered"> · cobertura do ML</template></p>
      </div>
      <div class="col-span-2">
        <p class="text-ink-3">Devolução</p>
        <p class="font-medium text-ink">{{ claim.devolution_status?.enabled ? claim.devolution_status.label : claim.devolution_status?.enabled === false ? 'Não habilitada' : '—' }}</p>
      </div>
      <div class="col-span-2">
        <p class="text-ink-3">Ações liberadas para você</p>
        <p class="font-medium text-ink">{{ claim.seller_actions?.length ? claim.seller_actions.map((a) => a.label + (a.mandatory ? ' (obrigatória)' : '')).join(' · ') : 'nenhuma agora' }}</p>
      </div>
    </div>

    <div v-if="claim.what_to_do?.title || claim.what_to_do?.description" class="mx-3 mb-3 rounded-card bg-primary-soft p-2 text-[12px] text-ink">
      <p class="font-semibold">{{ claim.what_to_do.title }}</p>
      <p v-if="claim.what_to_do.description" class="whitespace-pre-line text-ink-2">{{ claim.what_to_do.description }}</p>
    </div>

    <div v-if="claim.last_message" class="mx-3 mb-3 rounded-card border border-line p-2 text-[12px]">
      <p class="text-ink-3">Última mensagem · {{ claim.last_message.sender_label }} · {{ dateTimeShort(claim.last_message.date) }}</p>
      <p class="line-clamp-3 whitespace-pre-line text-ink">{{ claim.last_message.text }}</p>
    </div>

    <footer class="flex flex-wrap items-center gap-2 border-t border-line p-3">
      <button
        v-if="canReply && hasOptions"
        type="button"
        :class="claim.to_attend ? 'btn-primary h-9' : 'btn-secondary h-9'"
        :title="claim.to_attend ? 'O Mercado Livre aguarda uma ação sua nesta reclamação' : 'Não há obrigação de responder agora'"
        data-test="atender-responder"
        @click="menu = !menu; open = false; pending = null; confirming = false"
      >
        <ChatBubbleLeftEllipsisIcon class="h-4 w-4" aria-hidden="true" /> {{ claim.to_attend ? 'Responder' : 'Responder (opcional)' }}
      </button>
      <a v-else-if="claim.link && !hasOptions" :href="claim.link" target="_blank" rel="noopener" class="btn-secondary h-9 text-[12px]">Resolver no Mercado Livre</a>
      <span v-else-if="!canReply" class="text-[12px] text-ink-3">Só administradores respondem.</span>
      <a v-if="claim.link" :href="claim.link" target="_blank" rel="noopener" class="btn-link ml-auto text-[12px]">Abrir a venda no Mercado Livre</a>
    </footer>

    <div v-if="menu" class="flex flex-wrap gap-2 border-t border-line bg-surface-2 p-3" data-test="atender-opcoes">
      <button v-if="claim.reply_targets?.length" type="button" class="btn-secondary h-9" :class="open ? 'border-primary' : ''" data-test="opcao-mensagem" @click="open = true; pending = null; confirming = false">
        <ChatBubbleLeftEllipsisIcon class="h-4 w-4" aria-hidden="true" /> {{ claim.reply_targets.includes('mediator') && !claim.reply_targets.includes('complainant') ? 'Mensagem ao mediador' : 'Enviar mensagem ao comprador' }}
      </button>
      <button v-for="a in resolveActions" :key="a" type="button" class="btn-secondary h-9" :class="pending === a ? 'border-primary' : ''" :data-test="`opcao-${a}`" @click="choose(a)">
        <ArrowUturnLeftIcon v-if="a === 'allow_return'" class="h-4 w-4" aria-hidden="true" />
        <BanknotesIcon v-else-if="a === 'refund' || a === 'partial_refund'" class="h-4 w-4" aria-hidden="true" />
        <ScaleIcon v-else class="h-4 w-4" aria-hidden="true" />
        {{ RESOLVE[a]?.label }}
      </button>
      <a v-if="claim.link" :href="claim.link" target="_blank" rel="noopener" class="btn-link self-center text-[12px]">Ver no Mercado Livre</a>
    </div>

    <div v-if="pending && RESOLVE[pending]" class="space-y-2 border-t border-line bg-surface-2 p-3 text-[13px]" data-test="atender-acao">
      <p class="font-semibold text-ink">{{ RESOLVE[pending]?.label }}</p>
      <p class="text-ink-2">{{ RESOLVE[pending]?.text }}</p>
      <template v-if="pending === 'allow_return'">
        <p v-if="loadingCost" class="text-ink-3">Consultando o custo do frete de devolução…</p>
        <p v-else-if="returnCost?.free" class="rounded-card bg-success-soft p-2 font-semibold text-success" data-test="frete-devolucao">Frete da devolução: grátis para você.</p>
        <p v-else-if="returnCost" class="rounded-card bg-warning-soft p-2 font-semibold text-warning" data-test="frete-devolucao">
          Frete da devolução: será cobrado {{ brl(returnCost.amount) }} de você.
        </p>
        <p v-else-if="returnCostError" class="text-danger">{{ returnCostError }} Confira no Mercado Livre antes de confirmar.</p>
      </template>
      <label v-if="pending === 'partial_refund'" class="flex flex-wrap items-center gap-2">
        <span class="text-ink-2">Valor</span>
        <select v-model.number="percentage" class="input h-9 w-auto" :disabled="sending" data-test="acao-percentual" @change="confirming = false">
          <option :value="null" disabled>Escolha</option>
          <option v-for="o in offers" :key="o.percentage" :value="o.percentage">{{ o.percentage }}% · {{ brl(o.amount) }}</option>
        </select>
        <span v-if="offersError" class="text-danger">{{ offersError }}</span>
      </label>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          :class="confirming ? 'btn-danger' : 'btn-primary'"
          class="h-9"
          :disabled="sending || (pending === 'partial_refund' && !percentage)"
          data-test="acao-confirmar"
          @click="runResolve"
        >{{ sending ? 'Enviando…' : confirming ? 'Confirmar no Mercado Livre' : RESOLVE[pending]?.label }}</button>
        <button type="button" class="btn-link" :disabled="sending" @click="pending = null; confirming = false">Cancelar</button>
        <span v-if="confirming" class="text-[12px] text-danger">Isso vai para o Mercado Livre na hora e não pode ser desfeito. Clique de novo para confirmar.</span>
      </div>
    </div>

    <form v-if="open" class="space-y-2 border-t border-line bg-surface-2 p-3 text-[13px]" data-test="atender-resposta" @submit.prevent="send">
      <label class="flex items-center gap-2">
        <span class="text-ink-2">Para</span>
        <select v-model="receiver" class="input w-auto" :disabled="sending">
          <option v-for="r in claim.reply_targets" :key="r" :value="r">{{ RECEIVER_LABEL[r] ?? r }}</option>
        </select>
      </label>
      <textarea v-model="text" rows="4" maxlength="3500" class="input w-full" placeholder="Escreva a resposta. Ela aparece na reclamação no Mercado Livre." :disabled="sending" @input="confirming = false" />
      <div class="flex flex-wrap items-center gap-2">
        <button type="submit" :class="confirming ? 'btn-danger' : 'btn-primary'" :disabled="sending || !text.trim()" data-test="atender-enviar">
          {{ sending ? 'Enviando…' : confirming ? 'Confirmar envio ao Mercado Livre' : 'Enviar resposta' }}
        </button>
        <button type="button" class="btn-link" :disabled="sending" @click="reset">Cancelar</button>
        <span v-if="confirming" class="text-[12px] text-danger">A mensagem vai para a reclamação no Mercado Livre e não pode ser apagada depois. Clique de novo para confirmar.</span>
        <span v-else class="ml-auto text-[11px] text-ink-3">{{ text.length }}/3500</span>
      </div>
    </form>
  </article>
</template>
