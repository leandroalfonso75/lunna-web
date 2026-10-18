<script setup lang="ts">
import { computed } from 'vue'
import { brl, dateTimeShort, int, pct } from '../../lib/format'
import type { SaleDetail } from '../../types/sales'

const props = defineProps<{ sale: SaleDetail | 'loading' | 'error' | undefined }>()

const detail = computed(() => (props.sale && typeof props.sale === 'object' ? props.sale : null))

const DATE_LABELS: Record<string, string> = {
  handling: 'Em preparação', ready_to_ship: 'Pronto para enviar', shipped: 'Enviado',
  delivered: 'Entregue', cancelled: 'Cancelado', returned: 'Devolvido'
}

const dates = computed(() =>
  Object.entries(detail.value?.shipping.dates ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => ({ label: DATE_LABELS[k] ?? k, value: v as string }))
    .sort((a, b) => a.value.localeCompare(b.value))
)

const PAYMENT_TYPE: Record<string, string> = { credit_card: 'Cartão de crédito', debit_card: 'Cartão de débito', account_money: 'Saldo Mercado Pago', ticket: 'Boleto', bank_transfer: 'Pix / transferência' }

const mlLink = computed(() => (detail.value ? `https://www.mercadolivre.com.br/vendas/${detail.value.order_id}/detalhe` : '#'))
const money = (v: number | null | undefined) => brl(v)
</script>

<template>
  <p v-if="sale === 'loading' || !sale" class="text-[13px] text-ink-3">Carregando detalhes…</p>
  <p v-else-if="sale === 'error'" class="text-[13px] text-danger" role="alert">Não foi possível carregar os detalhes desta venda.</p>

  <div v-else-if="detail" class="grid grid-cols-1 gap-4 text-[13px] md:grid-cols-2 xl:grid-cols-4" data-test="sale-detail">
    <div class="card p-4">
      <p class="mb-2 font-semibold text-ink">Resultado da venda</p>
      <dl v-if="detail.economics">
        <div class="def-row"><dt>Receita dos itens</dt><dd data-numeric>{{ money(detail.economics.revenue) }}</dd></div>
        <div class="def-row"><dt>Custo dos produtos</dt><dd data-numeric>{{ detail.economics.cost === null ? 'sem custo' : `− ${money(detail.economics.cost)}` }}</dd></div>
        <div class="def-row"><dt>Tarifa de venda</dt><dd data-numeric>− {{ money(detail.economics.fee) }}</dd></div>
        <div class="def-row">
          <dt>Frete do vendedor<template v-if="detail.shipping.shared_with?.length"> (dividido)</template></dt>
          <dd data-numeric>{{ detail.economics.shipping_known ? `− ${money(detail.economics.shipping_cost)}` : 'ainda não lido' }}</dd>
        </div>
        <div class="def-row"><dt>Despesas fixas</dt><dd data-numeric>− {{ money(detail.economics.fixed_expenses) }}</dd></div>
        <div class="def-row"><dt>Imposto</dt><dd data-numeric>− {{ money(detail.economics.tax) }}</dd></div>
        <div class="def-row border-t border-line pt-1 font-semibold">
          <dt>Lucro líquido</dt>
          <dd data-numeric :class="(detail.economics.net_profit ?? 0) < 0 ? 'text-danger' : 'text-success'">
            {{ detail.economics.net_profit === null ? '—' : `${money(detail.economics.net_profit)} (${pct(detail.economics.net_profit_pct)})` }}
          </dd>
        </div>
        <div class="def-row" data-test="detalhe-ads">
          <dt>Custo com Ads<template v-if="detail.economics.ads_state === 'pendente'"> (pendente)</template></dt>
          <dd data-numeric>{{ detail.economics.ads_state === 'sem_ads' ? 'sem Ads' : `− ${money(detail.economics.ads_cost)}` }}</dd>
        </div>
        <div class="def-row border-t border-line pt-1 font-semibold">
          <dt>Lucro líquido pós Ads</dt>
          <dd data-numeric :class="(detail.economics.net_profit_after_ads ?? 0) < 0 ? 'text-danger' : 'text-success'">
            {{ detail.economics.net_profit_after_ads === null ? '—' : `${money(detail.economics.net_profit_after_ads)} (${pct(detail.economics.net_profit_after_ads_pct)})` }}
          </dd>
        </div>
        <p v-for="line in detail.economics.ads_lines" :key="line.item_id" class="mt-1 text-[11px] text-ink-3">
          Ads de {{ line.item_id }} no dia: {{ money(line.day_cost) }} ÷ {{ line.units_day }} {{ line.units_day === 1 ? 'unidade vendida' : 'unidades vendidas' }}
        </p>
        <p v-if="detail.economics.ads_state === 'pendente'" class="mt-1 text-[11px] text-warning">
          O dia desta venda ainda não fechou na leitura de Ads; o valor é refeito a cada atualização.
        </p>
      </dl>
      <p v-else class="text-ink-3">Venda cancelada: não entra nos totais.</p>
      <a :href="mlLink" target="_blank" rel="noopener" class="btn-link mt-3 inline-block">Abrir no Mercado Livre</a>
    </div>

    <div class="card p-4">
      <p class="mb-2 font-semibold text-ink">Produtos</p>
      <ul class="space-y-3">
        <li v-for="line in detail.items_detail" :key="line.item_id + String(line.variation_id)">
          <p class="font-medium text-ink">{{ line.title }}</p>
          <p class="text-[12px] text-ink-3">
            {{ line.item_id }} · SKU {{ line.sku ?? '—' }} · {{ int(line.quantity) }} × {{ money(line.unit_price) }}
            <template v-if="line.full_unit_price && line.full_unit_price !== line.unit_price"> (de {{ money(line.full_unit_price) }})</template>
          </p>
          <p class="text-[12px] text-ink-3">Tarifa {{ money(line.sale_fee) }}/un · {{ line.listing_type ?? '—' }}<template v-if="line.condition"> · {{ line.condition === 'new' ? 'novo' : line.condition }}</template></p>
          <p v-if="line.variation.length" class="text-[12px] text-ink-3">{{ line.variation.join(' · ') }}</p>
        </li>
      </ul>
    </div>

    <div class="card p-4">
      <p class="mb-2 font-semibold text-ink">Pagamento</p>
      <dl v-if="detail.payments.length">
        <template v-for="p in detail.payments" :key="p.id">
          <div class="def-row"><dt>Forma</dt><dd>{{ PAYMENT_TYPE[p.type] ?? p.type }}<template v-if="p.installments > 1"> em {{ p.installments }}x</template></dd></div>
          <div class="def-row"><dt>Valor</dt><dd data-numeric>{{ money(p.transaction_amount) }}</dd></div>
          <div class="def-row"><dt>Total pago</dt><dd data-numeric>{{ money(p.total_paid) }}</dd></div>
          <div v-if="p.refunded" class="def-row"><dt>Reembolsado</dt><dd data-numeric>{{ money(p.refunded) }}</dd></div>
          <div v-if="p.coupon" class="def-row"><dt>Cupom</dt><dd data-numeric>{{ money(p.coupon) }}</dd></div>
          <div class="def-row"><dt>Situação</dt><dd>{{ p.status === 'approved' ? 'Aprovado' : p.status }}</dd></div>
          <div class="def-row"><dt>Aprovado em</dt><dd>{{ dateTimeShort(p.date_approved) }}</dd></div>
        </template>
      </dl>
      <p v-else class="text-ink-3">Sem dados de pagamento.</p>
      <p v-if="detail.pack_id" class="mt-2 text-[12px] text-ink-3">Carrinho (pack): {{ detail.pack_id }}</p>
      <p v-if="detail.buyer_nickname" class="text-[12px] text-ink-3">Comprador: {{ detail.buyer_nickname }}</p>
    </div>

    <div class="card p-4">
      <p class="mb-2 font-semibold text-ink">Envio</p>
      <dl v-if="detail.shipping.loaded">
        <div class="def-row"><dt>Situação</dt><dd>{{ detail.shipping.label }}</dd></div>
        <div class="def-row"><dt>Logística</dt><dd>{{ detail.shipping.logistic_label ?? '—' }}</dd></div>
        <div v-if="detail.shipping.method_name" class="def-row"><dt>Serviço</dt><dd>{{ detail.shipping.method_name }}</dd></div>
        <div v-if="detail.shipping.destination" class="def-row"><dt>Destino</dt><dd>{{ detail.shipping.destination }}</dd></div>
        <div v-if="detail.shipping.tracking_number" class="def-row"><dt>Rastreio</dt><dd class="break-all" data-numeric>{{ detail.shipping.tracking_number }}</dd></div>
        <div class="def-row"><dt>Frete do envio (vendedor)</dt><dd data-numeric>{{ money(detail.shipping.seller_cost) }}</dd></div>
        <div v-if="detail.shipping.shared_with?.length" class="def-row" data-test="frete-dividido">
          <dt>Parte desta venda</dt><dd data-numeric>{{ money(detail.shipping.seller_cost_share) }}</dd>
        </div>
        <div class="def-row"><dt>Frete pago pelo comprador<template v-if="detail.shipping.shared_with?.length"> (envio todo)</template></dt><dd data-numeric>{{ money(detail.shipping.buyer_cost) }}</dd></div>
        <div v-if="detail.shipping.estimated_delivery" class="def-row"><dt>Previsão de entrega</dt><dd>{{ dateTimeShort(detail.shipping.estimated_delivery) }}</dd></div>
      </dl>
      <p v-else class="text-ink-3">{{ detail.shipping.label }}</p>
      <p v-if="detail.shipping.shared_with?.length" class="mt-2 text-[12px] text-ink-3" data-test="carrinho-aviso">
        Carrinho: este envio levou também {{ detail.shipping.shared_with.length === 1 ? 'a venda' : 'as vendas' }}
        {{ detail.shipping.shared_with.join(', ') }}. O frete foi dividido entre as vendas, proporcional às unidades.
      </p>
      <ol v-if="dates.length" class="mt-3 space-y-1 border-l-2 border-line pl-3 text-[12px]">
        <li v-for="d in dates" :key="d.label"><span class="font-medium text-ink">{{ d.label }}</span> <span class="text-ink-3">{{ dateTimeShort(d.value) }}</span></li>
      </ol>
    </div>
  </div>
</template>
