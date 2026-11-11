<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import { brl, pct } from '../../lib/format'
import { useSessionStore } from '../../stores/session'
import type { AbcPriceCalculator, AbcPriceOption } from '../../types/painel'

/**
 * Curva ABC > cenários de preço e frete (pedido do usuário em 07/11/2026): cada cenário (menos o de hoje) tem
 * "Aplicar novo preço sugerido", que muda o preço no Mercado Livre; e um campo de preço livre mostra tarifa, frete
 * (a partir de R$ 79 o frete grátis é obrigatório e segue a tabela do ML por faixa), imposto, custo e margem.
 */
const props = defineProps<{ itemId: string; options: AbcPriceOption[]; calculator?: AbcPriceCalculator | null }>()
const emit = defineEmits<{ changed: [] }>()

const { $api } = useNuxtApp()
const session = useSessionStore()
const toast = useToast()

const custom = ref('')
const pending = ref<number | null>(null) // linha aguardando confirmação
const applying = ref(false)

const BANDS = ['200', '150', '120', '100', '79']

/** A mesma conta da API (Abc::SuggestionEngine#price_option) para o preço digitado. */
const customOption = computed<AbcPriceOption | null>(() => {
  const c = props.calculator
  const price = Number(custom.value.replace(/\./g, '').replace(',', '.'))
  if (!c || !Number.isFinite(price) || price <= 0) return null
  let shipping = c.ship_below
  if (price >= c.free_shipping_min) {
    const band = BANDS.find((b) => price >= Number(b) && c.ship_tiers[b] !== undefined)
    shipping = band ? (c.ship_tiers[band] ?? shipping) : (c.ship_free_below ?? c.ship_below)
  }
  const fee = price * c.fee_pct
  const tax = (price * c.tax_pct) / 100
  const profit = price - fee - shipping - tax - (c.cost ?? 0)
  const margin = (profit / price) * 100
  const freeNote = price >= c.free_shipping_min && c.current_price < c.free_shipping_min ? ' (frete grátis obrigatório a partir de R$ 79)' : ''
  return {
    label: `Preço definido por você${freeNote}`, price: Math.round(price * 100) / 100, fee, shipping, tax, cost: c.cost,
    profit, margin_pct: Math.round(margin * 10) / 10, low: c.cost !== null ? margin < c.min_margin_pct : false, today: false
  }
})

// todo cenário menos o de hoje; no "com frete grátis" do mesmo preço, aplicar = ligar o frete grátis
const canApply = (o: AbcPriceOption) => !o.today && session.isAdmin

async function apply(o: AbcPriceOption) {
  applying.value = true
  try {
    const res = await $api<{ message: string }>(`/api/items/${props.itemId}/price`, {
      method: 'POST', query: { account_id: session.selectedAccountId }, body: { price: o.price, free_shipping: !!o.free_shipping, confirm: true }
    })
    toast.success(res.message)
    pending.value = null
    custom.value = ''
    emit('changed')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'O Mercado Livre não aceitou o novo preço.'))
  } finally {
    applying.value = false
  }
}
</script>

<template>
  <div class="mt-2 overflow-x-auto" data-test="sugestao-opcoes">
    <table class="w-full min-w-[640px] text-[12px]">
      <thead class="text-ink-3">
        <tr>
          <th class="py-1 pr-2 text-left font-medium">Cenário</th>
          <th class="px-2 py-1 text-right font-medium">Preço</th>
          <th class="px-2 py-1 text-right font-medium">Tarifa</th>
          <th class="px-2 py-1 text-right font-medium">Frete</th>
          <th class="px-2 py-1 text-right font-medium">Imposto</th>
          <th class="px-2 py-1 text-right font-medium">Custo</th>
          <th class="px-2 py-1 text-right font-medium">Lucro</th>
          <th class="px-2 py-1 text-right font-medium">Margem</th>
          <th class="py-1 pl-2" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="(o, k) in [...options, ...(customOption ? [customOption] : [])]" :key="k" class="border-t border-line" :class="o === customOption ? 'bg-surface-2' : ''">
          <td class="py-1 pr-2 text-ink">{{ o.label }}</td>
          <td class="px-2 py-1 text-right font-semibold text-ink" data-numeric>{{ brl(o.price) }}</td>
          <td class="px-2 py-1 text-right" data-numeric>− {{ brl(o.fee) }}</td>
          <td class="px-2 py-1 text-right" data-numeric>− {{ brl(o.shipping) }}</td>
          <td class="px-2 py-1 text-right" data-numeric>− {{ brl(o.tax) }}</td>
          <td class="px-2 py-1 text-right" data-numeric>{{ o.cost !== null ? `− ${brl(o.cost)}` : '—' }}</td>
          <td class="px-2 py-1 text-right" :class="o.profit < 0 ? 'text-danger' : 'text-ink'" data-numeric>{{ brl(o.profit) }}</td>
          <td class="px-2 py-1 text-right font-semibold" :class="o.low ? 'text-danger' : 'text-success'" data-numeric>{{ pct(o.margin_pct) }}</td>
          <td class="whitespace-nowrap py-1 pl-2 text-right">
            <template v-if="canApply(o)">
              <span v-if="pending === k" class="inline-flex items-center gap-1">
                <button type="button" class="btn-primary h-7 px-2 text-[11px]" :disabled="applying" data-test="preco-confirmar" @click="apply(o)">{{ applying ? 'Aplicando…' : 'Confirmar no ML' }}</button>
                <button type="button" class="btn-secondary h-7 px-2 text-[11px]" :disabled="applying" @click="pending = null">Cancelar</button>
              </span>
              <button
                v-else type="button" class="btn-secondary h-7 px-2 text-[11px]" data-test="preco-aplicar"
                :title="o.same_price ? 'Mantém o preço e liga o frete grátis no Mercado Livre' : ''"
                @click="pending = k"
              >Aplicar novo preço sugerido</button>
            </template>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="calculator" class="mt-2 flex flex-wrap items-center gap-2" data-test="preco-livre">
      <label class="text-[12px] text-ink-2" :for="`preco-livre-${itemId}`">Simular outro preço:</label>
      <input :id="`preco-livre-${itemId}`" v-model="custom" type="text" inputmode="decimal" class="input h-8 w-32 text-[12px]" placeholder="ex.: 84,90">
      <span v-if="customOption" class="text-[12px] text-ink-3">a conta aparece na última linha da tabela</span>
    </div>

    <p class="mt-1 text-[11px] text-ink-3">
      Tarifa na mesma % de hoje; imposto da empresa; frete: abaixo de R$ 79 o de hoje, a partir de R$ 79 o frete grátis (obrigatório) pela tabela do Mercado Livre por faixa.
      Vermelho = abaixo da margem mínima. "Aplicar" muda o preço no Mercado Livre na hora (só administradores).
      <template v-if="options.some((o) => o.cost === null)"> Sem custo cadastrado para este anúncio: lucro e margem estão <strong>antes do custo</strong>.</template>
    </p>
  </div>
</template>
