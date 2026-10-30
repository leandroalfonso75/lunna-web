<script setup lang="ts">
import { ChevronDownIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
import { ref } from 'vue'
import { brl, dateTimeShort } from '../../lib/format'
import { KIND_LABEL, STATUS_LABEL, VARIATION_LABEL, formatQty, toNumber, type OlistProduct } from '../../lib/olistClient'

/**
 * Linha de um produto do Olist. Produto pai com variações mostra, ao lado do
 * nome, uma seta: só ao clicar nela as variações aparecem (como linhas
 * recuadas logo abaixo). Clicar na linha abre/fecha os detalhes do produto.
 */
const props = defineProps<{ product: OlistProduct; level?: number }>()

const showDetail = ref(false)
const showVariations = ref(false)

const STATUS_PILL: Record<string, string> = { A: 'pill-success', I: 'pill-neutral', E: 'pill-danger' }
const money = (v: OlistProduct['price']) => brl(toNumber(v))
const hasValue = (v: OlistProduct['price']) => (toNumber(v) ?? 0) > 0
const isNegative = (v: OlistProduct['price']) => (toNumber(v) ?? 0) < 0
const hasVariations = () => (props.product.variations?.length ?? 0) > 0

const warningText = () => {
  const cost = props.product.cost
  if (props.product.kit) return `Atenção: componente(s) do kit sem custo: ${(cost.warning_skus ?? []).join(', ')}.`
  return `Atenção: ${formatQty(cost.warning_units)} unidade(s) em estoque sem valor de custo informado na entrada.`
}
const costText = () => {
  const cost = props.product.cost
  if (cost.range) return cost.range[0] === cost.range[1] ? brl(cost.range[0]) : `${brl(cost.range[0])} a ${brl(cost.range[1])}`
  return toNumber(cost.fifo_unit) === null ? '—' : money(cost.fifo_unit)
}
</script>

<template>
  <tr
    class="cursor-pointer border-b border-line align-top hover:bg-surface-2"
    :class="level ? 'bg-surface-2/60' : ''"
    data-test="produto-linha"
    :data-nivel="level ?? 0"
    @click="showDetail = !showDetail"
  >
    <td class="whitespace-nowrap px-3 py-2 font-mono text-[12px]" :class="level ? 'pl-8' : ''">{{ product.sku || '—' }}</td>
    <td class="max-w-[460px] px-3 py-2">
      <div class="flex items-start gap-2">
        <img v-if="product.thumbnail" :src="product.thumbnail" alt="" class="h-12 w-12 shrink-0 rounded object-cover" loading="lazy" data-test="produto-foto" />
        <div v-else class="h-12 w-12 shrink-0 rounded bg-surface-2" aria-hidden="true" />
        <span class="min-w-0 flex-1" :class="level ? 'font-medium text-ink-2' : 'font-semibold text-ink'">{{ product.description }}</span>
        <button
          v-if="hasVariations()"
          type="button"
          class="inline-flex shrink-0 items-center gap-1 rounded-card border border-line bg-surface px-2 py-0.5 text-[12px] text-ink-2 hover:bg-surface-2"
          :aria-expanded="showVariations"
          :aria-label="`${showVariations ? 'Esconder' : 'Mostrar'} as ${product.variations.length} variações`"
          data-test="variacoes-seta"
          @click.stop="showVariations = !showVariations"
        >
          {{ product.variations.length }} variações
          <ChevronDownIcon class="h-4 w-4 transition-transform" :class="showVariations ? 'rotate-180' : ''" aria-hidden="true" />
        </button>
      </div>
    </td>
    <td class="px-3 py-2">
      <span :class="STATUS_PILL[product.status ?? ''] ?? 'pill-neutral'">{{ STATUS_LABEL[product.status ?? ''] ?? '—' }}</span>
    </td>
    <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums">{{ money(product.price) }}</td>
    <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums">{{ hasValue(product.promo_price) ? money(product.promo_price) : '—' }}</td>
    <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums" data-test="custo-peps">
      <span class="inline-flex items-center justify-end gap-1">
        <span v-if="product.cost.warning" class="inline-flex" :title="warningText()" role="img" :aria-label="warningText()" data-test="custo-aviso">
          <ExclamationTriangleIcon class="h-4 w-4 text-warning" aria-hidden="true" />
        </span>
        <span :title="product.kit ? 'Kit: soma do custo dos componentes' : product.cost.available ? 'Custo PEPS: da entrada mais antiga que ainda tem saldo' : 'Custo ainda não calculado'">{{ costText() }}</span>
      </span>
    </td>
    <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums" :class="isNegative(product.stock.available) ? 'font-semibold text-danger' : ''" data-test="estoque-olist">
      {{ formatQty(product.stock.available) }}
    </td>
    <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums" data-test="estoque-full">
      <template v-if="product.stock.full.linked">{{ formatQty(product.stock.full.available) }}</template>
      <span v-else class="text-ink-3" title="Sem anúncio Full no Mercado Livre com este SKU">—</span>
    </td>
    <td class="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums" :class="isNegative(product.stock.total_available) ? 'text-danger' : 'text-ink'" data-test="estoque-total">
      {{ formatQty(product.stock.total_available) }}
    </td>
  </tr>

  <tr v-if="showDetail" class="border-b border-line bg-surface-2" data-test="produto-detalhe">
    <td colspan="9" class="px-6 py-4">
      <dl class="grid gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
        <div><dt class="text-ink-3">ID no Olist</dt><dd class="font-mono">{{ product.id }}</dd></div>
        <div><dt class="text-ink-3">GTIN / EAN</dt><dd>{{ product.gtin || '—' }}</dd></div>
        <div><dt class="text-ink-3">Tipo</dt><dd>{{ KIND_LABEL[product.kind ?? ''] ?? '—' }}</dd></div>
        <div><dt class="text-ink-3">Variação</dt><dd>{{ VARIATION_LABEL[product.variation_kind ?? ''] ?? '—' }}</dd></div>
        <div><dt class="text-ink-3">Unidade</dt><dd>{{ product.unit || '—' }}</dd></div>
        <div><dt class="text-ink-3">Localização no estoque</dt><dd>{{ product.stock.location || '—' }}</dd></div>
        <div>
          <dt class="text-ink-3">Saldo no Olist</dt>
          <dd>{{ formatQty(product.stock.balance) }}</dd>
        </div>
        <div>
          <dt class="text-ink-3">Reservado no Olist</dt>
          <dd>{{ formatQty(product.stock.reserved) }}</dd>
        </div>
        <div>
          <dt class="text-ink-3">Full: indisponível / total</dt>
          <dd>
            <template v-if="product.stock.full.linked">
              {{ formatQty(product.stock.full.not_available) }} / {{ formatQty(product.stock.full.total) }}
              <span class="text-[12px] text-ink-3">({{ product.stock.full.listings }} anúncio{{ product.stock.full.listings === 1 ? '' : 's' }}, lido às {{ dateTimeShort(product.stock.full.synced_at) }})</span>
            </template>
            <template v-else>sem anúncio Full com este SKU</template>
          </dd>
        </div>
        <div><dt class="text-ink-3">{{ product.kit ? 'Custo do kit (soma dos componentes)' : 'Custo PEPS (próxima saída)' }}</dt><dd>{{ costText() }}</dd></div>
        <div><dt class="text-ink-3">Valor do estoque (PEPS)</dt><dd>{{ product.cost.available ? money(product.cost.stock_value) : '—' }}</dd></div>
        <div><dt class="text-ink-3">Custo cadastrado no Olist</dt><dd>{{ hasValue(product.cost.registered) ? money(product.cost.registered) : '—' }}</dd></div>
        <div><dt class="text-ink-3">Cadastrado no Olist</dt><dd>{{ dateTimeShort(product.olist_created_at) }}</dd></div>
        <div><dt class="text-ink-3">Alterado no Olist</dt><dd>{{ dateTimeShort(product.olist_updated_at) }}</dd></div>
        <div><dt class="text-ink-3">Lido pelo Lunna</dt><dd>{{ dateTimeShort(product.synced_at) }}</dd></div>
      </dl>
      <p v-if="hasVariations()" class="mt-3 text-[12px] text-ink-3">
        Produto com variações: o estoque mostrado é a soma das {{ product.variations.length }} variações.
      </p>
      <div v-if="product.kit" class="mt-4" data-test="composicao-kit">
        <p class="mb-1 text-[12px] font-semibold text-ink-2">Composição do kit</p>
        <table class="w-full max-w-3xl border-collapse text-[12px]">
          <thead>
            <tr class="border-b border-line text-left text-ink-3">
              <th class="py-1 pr-3 font-medium">Componente</th>
              <th class="px-3 py-1 text-right font-medium">Qtd. no kit</th>
              <th class="px-3 py-1 text-right font-medium">Custo unit.</th>
              <th class="px-3 py-1 text-right font-medium">Subtotal</th>
              <th class="px-3 py-1 text-right font-medium">Estoque</th>
              <th class="py-1 pl-3 text-right font-medium">Kits possíveis</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in product.kit.components" :key="c.id" class="border-b border-line" data-test="componente-kit">
              <td class="py-1 pr-3">
                <span class="font-mono">{{ c.sku }}</span>
                <span v-if="c.description" class="block max-w-[320px] truncate text-ink-3" :title="c.description">{{ c.description }}</span>
              </td>
              <td class="px-3 py-1 text-right tabular-nums">{{ formatQty(c.quantity) }}</td>
              <td class="px-3 py-1 text-right tabular-nums">
                <span v-if="c.unit_cost === null" class="text-warning">sem custo</span>
                <template v-else>{{ brl(c.unit_cost) }}</template>
              </td>
              <td class="px-3 py-1 text-right tabular-nums">{{ c.subtotal === null ? '—' : brl(c.subtotal) }}</td>
              <td class="px-3 py-1 text-right tabular-nums">{{ formatQty(c.available) }}</td>
              <td class="py-1 pl-3 text-right tabular-nums">{{ formatQty(c.kits_possible) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="mt-1 text-[12px] text-ink-3">O estoque do kit é o menor número de kits que os componentes permitem montar.</p>
      </div>
      <p v-if="product.cost.warning" class="mt-3 flex items-start gap-2 rounded-card border border-warning bg-warning-soft px-3 py-2 text-[13px] text-warning" role="alert" data-test="custo-aviso-detalhe">
        <ExclamationTriangleIcon class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          {{ warningText() }} {{ product.kit ? 'Informe o custo dos componentes no Olist para o kit ter custo.' : 'Informe o custo da entrada no Olist (Suprimentos &gt; Controle de Estoque) para o PEPS ficar completo.' }}
        </span>
      </p>
      <p v-if="product.cost.balance_gap" class="mt-3 text-[12px] text-ink-3" data-test="custo-diferenca">
        O histórico de movimentações do Olist explica {{ formatQty(Math.abs(product.cost.balance_gap)) }} unidade(s)
        {{ product.cost.balance_gap > 0 ? 'a mais' : 'a menos' }} do que o estoque de hoje; o custo PEPS considera só o que o histórico mostra.
      </p>
      <div v-if="!product.kit && product.cost.layers.length" class="mt-4">
        <p class="mb-1 text-[12px] font-semibold text-ink-2">Entradas com saldo (PEPS: a mais antiga sai primeiro)</p>
        <table class="w-full max-w-xl border-collapse text-[12px]">
          <thead>
            <tr class="border-b border-line text-left text-ink-3">
              <th class="py-1 pr-3 font-medium">Entrada</th>
              <th class="px-3 py-1 text-right font-medium">Qtd. entrada</th>
              <th class="px-3 py-1 text-right font-medium">Saldo</th>
              <th class="px-3 py-1 text-right font-medium">Custo unit.</th>
              <th class="py-1 pl-3 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(layer, i) in product.cost.layers" :key="i" class="border-b border-line" data-test="camada-peps">
              <td class="py-1 pr-3">{{ dateTimeShort(layer.moved_at) }}</td>
              <td class="px-3 py-1 text-right tabular-nums">{{ formatQty(layer.quantity) }}</td>
              <td class="px-3 py-1 text-right tabular-nums">{{ formatQty(layer.remaining) }}</td>
              <td class="px-3 py-1 text-right tabular-nums">
                <span v-if="layer.unit_cost === null" class="text-warning">sem custo</span>
                <template v-else>{{ brl(layer.unit_cost) }}</template>
              </td>
              <td class="py-1 pl-3 text-right tabular-nums">{{ layer.unit_cost === null ? '—' : brl(layer.unit_cost * layer.remaining) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="product.stock.deposits.length" class="mt-4">
        <p class="mb-1 text-[12px] font-semibold text-ink-2">Estoque por depósito</p>
        <table class="w-full max-w-xl border-collapse text-[12px]">
          <thead>
            <tr class="border-b border-line text-left text-ink-3">
              <th class="py-1 pr-3 font-medium">Depósito</th>
              <th class="px-3 py-1 text-right font-medium">Saldo</th>
              <th class="px-3 py-1 text-right font-medium">Reservado</th>
              <th class="py-1 pl-3 text-right font-medium">Disponível</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in product.stock.deposits" :key="d.id" class="border-b border-line">
              <td class="py-1 pr-3">
                {{ d.nome }}
                <span v-if="d.desconsiderar" class="pill-neutral ml-1" title="Este depósito não entra no saldo total">fora do saldo</span>
              </td>
              <td class="px-3 py-1 text-right tabular-nums">{{ formatQty(d.saldo) }}</td>
              <td class="px-3 py-1 text-right tabular-nums">{{ formatQty(d.reservado) }}</td>
              <td class="py-1 pl-3 text-right tabular-nums">{{ formatQty(d.disponivel) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </td>
  </tr>

  <template v-if="showVariations">
    <OlistProductRow v-for="variation in product.variations" :key="variation.id" :product="variation" :level="(level ?? 0) + 1" />
  </template>
</template>
