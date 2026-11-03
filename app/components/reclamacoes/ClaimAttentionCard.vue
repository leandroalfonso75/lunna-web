<script setup lang="ts">
import { ChatBubbleLeftEllipsisIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
import { computed, ref } from 'vue'
import { brl, dateTimeShort } from '../../lib/format'
import type { ClaimRow } from '../../types/claims'

/**
 * Cartão de uma reclamação aberta na visão "A atender": prazo (com contagem regressiva), o que o ML pede, o que o
 * comprador quer, reputação, custos (reembolso, frete da devolução), última mensagem, ações liberadas pelo ML e a
 * resposta, que vai para a reclamação no Mercado Livre (com confirmação: não se desfaz).
 */
const props = defineProps<{ claim: ClaimRow; canReply: boolean; sending: boolean }>()
const emit = defineEmits<{ reply: [claimId: number, receiver: string, text: string] }>()

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
        v-if="canReply && claim.reply_targets?.length"
        type="button"
        class="btn-primary h-9"
        data-test="atender-responder"
        @click="open = !open; confirming = false"
      >
        <ChatBubbleLeftEllipsisIcon class="h-4 w-4" aria-hidden="true" /> Responder
      </button>
      <span v-else-if="!claim.reply_targets?.length" class="text-[12px] text-ink-3">O Mercado Livre não libera mensagem nesta etapa.</span>
      <span v-else class="text-[12px] text-ink-3">Só administradores respondem.</span>
      <a v-if="claim.link" :href="claim.link" target="_blank" rel="noopener" class="btn-link ml-auto text-[12px]">Abrir a venda no Mercado Livre</a>
    </footer>

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
