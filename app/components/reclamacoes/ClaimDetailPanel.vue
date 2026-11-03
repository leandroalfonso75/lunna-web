<script setup lang="ts">
import { brl, dateTimeShort } from '../../lib/format'
import type { ClaimDetail } from '../../types/claims'

/**
 * Detalhe de uma reclamação: o que o Mercado Livre informou (situação, o que fazer e prazo, mensagens, histórico,
 * ações, resolução esperada, evidências, reputação, devolução) e, no fim, os dados completos como vieram da API.
 */
defineProps<{ claim: ClaimDetail | null; loading: boolean }>()

const yesNo = (v: unknown) => (v === true ? 'Sim' : v === false ? 'Não' : '—')
const json = (v: unknown) => JSON.stringify(v, null, 2)
</script>

<template>
  <p v-if="loading && !claim" class="text-[13px] text-ink-3" role="status">Carregando a reclamação…</p>
  <div v-else-if="claim" class="space-y-4 text-[13px]" data-test="reclamacao-detalhe">
    <p v-if="!claim.detailed" class="rounded-card border border-line bg-surface px-3 py-2 text-ink-2">
      Os detalhes desta reclamação (mensagens, histórico, devolução) ainda estão sendo importados do Mercado Livre e aparecem sozinhos.
    </p>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div class="space-y-1">
        <p class="font-semibold text-ink">Reclamação #{{ claim.claim_id }}</p>
        <p>{{ claim.type_label }} · {{ claim.stage_label }} · <strong>{{ claim.status_label }}</strong></p>
        <p>Motivo: {{ claim.reason ?? '—' }} <span class="text-ink-3">({{ claim.reason_id ?? '—' }})</span></p>
        <p>Aberta em {{ dateTimeShort(claim.date_created) }} · última alteração {{ dateTimeShort(claim.last_updated) }}</p>
        <p>Afeta a reputação: <strong>{{ yesNo(claim.affects_reputation) }}</strong><template v-if="claim.has_incentive"> · com incentivo</template></p>
        <p v-if="claim.resolution">Resolução: {{ claim.resolution.reason ?? '—' }} · a favor de {{ claim.resolution.benefited.join(', ') || '—' }} · encerrada por {{ claim.resolution.closed_by ?? '—' }} em {{ dateTimeShort(claim.resolution.date) }}</p>
      </div>
      <div class="space-y-1">
        <p class="font-semibold text-ink">O que fazer</p>
        <p v-if="claim.title" class="font-medium">{{ claim.title }}</p>
        <p v-if="claim.detail?.description" class="whitespace-pre-line text-ink-2">{{ claim.detail.description }}</p>
        <p>Quem deve agir: {{ claim.action_responsible_label ?? '—' }} · prazo {{ claim.due_date ? dateTimeShort(claim.due_date) : '—' }}</p>
        <p v-if="!claim.title && !claim.detail?.description" class="text-ink-3">Nada pendente informado pelo Mercado Livre.</p>
      </div>
      <div class="space-y-1">
        <p class="font-semibold text-ink">Venda</p>
        <template v-if="claim.order">
          <p>#{{ claim.order.order_id }} · {{ brl(claim.order.total) }} · {{ dateTimeShort(claim.order.date_created) }}</p>
          <p>{{ claim.order.item?.title ?? '—' }} <span class="text-ink-3">{{ claim.order.item?.sku ?? '' }}</span></p>
          <p>Comprador: {{ claim.order.buyer_name ?? '—' }} <span class="text-ink-3">({{ claim.order.buyer_nickname ?? '—' }})</span></p>
          <a v-if="claim.link" :href="claim.link" target="_blank" rel="noopener" class="btn-link">Abrir a venda no Mercado Livre</a>
        </template>
        <p v-else class="text-ink-3">Venda fora dos 3 meses guardados no Lunna ({{ claim.resource }} {{ claim.resource_id }}).</p>
      </div>
    </div>

    <section>
      <p class="mb-1 font-semibold text-ink">Mensagens ({{ claim.messages.length }})</p>
      <ul v-if="claim.messages.length" class="space-y-2">
        <li v-for="(m, i) in claim.messages" :key="i" class="rounded-card border border-line bg-surface p-2">
          <p class="text-[12px] text-ink-3">{{ m.sender_label }} → {{ m.receiver_label ?? m.receiver ?? '—' }} · {{ dateTimeShort(m.date) }}<template v-if="m.read_at"> · lida</template></p>
          <p class="whitespace-pre-line text-ink">{{ m.text }}</p>
          <p v-if="m.attachments.length" class="text-[12px] text-ink-3">Anexos: {{ m.attachments.map((a) => a.original_filename ?? a.filename).join(', ') }}</p>
        </li>
      </ul>
      <p v-else class="text-ink-3">Sem mensagens.</p>
    </section>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section>
        <p class="mb-1 font-semibold text-ink">Histórico da situação</p>
        <ul class="space-y-0.5">
          <li v-for="(h, i) in claim.status_history" :key="i">{{ dateTimeShort(h.date) }} · {{ h.stage }} / {{ h.status }} <span class="text-ink-3">por {{ h.change_by }}</span></li>
          <li v-if="!claim.status_history.length" class="text-ink-3">—</li>
        </ul>
      </section>
      <section>
        <p class="mb-1 font-semibold text-ink">Ações</p>
        <ul class="space-y-0.5">
          <li v-for="(a, i) in claim.actions_history" :key="i">{{ dateTimeShort(a.date_created) }} · {{ a.action_name }} <span class="text-ink-3">por {{ a.player_role }} ({{ a.claim_stage }}/{{ a.claim_status }})</span></li>
          <li v-if="!claim.actions_history.length" class="text-ink-3">—</li>
        </ul>
      </section>
      <section>
        <p class="mb-1 font-semibold text-ink">Resolução esperada</p>
        <ul class="space-y-0.5">
          <li v-for="(e, i) in claim.expected_resolutions" :key="i">{{ e.label }} <span class="text-ink-3">· pedida por {{ e.player_role }} · {{ e.status }} · {{ dateTimeShort(e.date_created) }}</span></li>
          <li v-if="!claim.expected_resolutions.length" class="text-ink-3">—</li>
        </ul>
      </section>
      <section>
        <p class="mb-1 font-semibold text-ink">Evidências</p>
        <p v-if="!claim.evidences.length" class="text-ink-3">—</p>
        <pre v-else class="max-h-48 overflow-auto rounded-card bg-surface p-2 text-[11px]">{{ json(claim.evidences) }}</pre>
      </section>
    </div>

    <section v-if="claim.devolution">
      <p class="mb-1 font-semibold text-ink">Devolução</p>
      <pre class="max-h-64 overflow-auto rounded-card bg-surface p-2 text-[11px]">{{ json(claim.devolution) }}</pre>
    </section>

    <p v-if="Object.keys(claim.detail_errors ?? {}).length" class="text-[12px] text-warning">
      Partes que o Mercado Livre não devolveu na última leitura: {{ Object.keys(claim.detail_errors).join(', ') }}.
    </p>

    <details class="rounded-card border border-line bg-surface p-2">
      <summary class="cursor-pointer text-[12px] font-semibold text-ink-2">Dados completos do Mercado Livre</summary>
      <pre class="mt-2 max-h-80 overflow-auto text-[11px]">{{ json({ reclamacao: claim.raw, detalhe: claim.detail, reputacao: claim.reputation, motivo: claim.reason_info, resolucao: claim.resolution_raw, participantes: claim.players, alteracoes: claim.changes, entidades: claim.related_entities }) }}</pre>
    </details>
  </div>
</template>
