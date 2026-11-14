<script setup lang="ts">
/**
 * Pergunta antes de publicar (pedido do usuário em 14/11/2026): quando há outros anúncios do mesmo produto (mesmo SKU,
 * ex.: Clássico e Premium), o usuário escolhe se a alteração vale também para eles. Nenhum vem marcado.
 */
export interface SameSkuItem { item_id: string; sku: string | null; title: string | null; status: string | null; listing_type_id: string | null }

defineProps<{ items: SameSkuItem[] }>()
const selected = defineModel<string[]>({ required: true })

const typeLabel = (t: string | null) => (t === 'gold_pro' ? 'Premium' : t === 'gold_special' ? 'Clássico' : t ?? '')
function toggle(id: string, on: boolean) {
  selected.value = on ? [...new Set([...selected.value, id])] : selected.value.filter((x) => x !== id)
}
</script>

<template>
  <div v-if="items.length" class="w-full rounded-card border border-warning bg-warning-soft p-3 text-[12px]" data-test="mesmo-sku">
    <p class="font-semibold text-ink">Este produto tem mais {{ items.length }} anúncio(s) com o mesmo SKU. Deseja alterar também neles?</p>
    <div class="mt-1 flex flex-wrap gap-3">
      <button type="button" class="btn-link text-[12px]" @click="selected = items.map((i) => i.item_id)">Marcar todos</button>
      <button type="button" class="btn-link text-[12px]" @click="selected = []">Só neste anúncio</button>
    </div>
    <label v-for="i in items" :key="i.item_id" class="mt-1 flex items-start gap-2 text-ink-2">
      <input type="checkbox" class="mt-0.5" :checked="selected.includes(i.item_id)" @change="toggle(i.item_id, ($event.target as HTMLInputElement).checked)">
      <span>{{ i.item_id }} · {{ typeLabel(i.listing_type_id) }}<template v-if="i.status && i.status !== 'active'"> · {{ i.status === 'paused' ? 'pausado' : i.status }}</template> · {{ i.title }}</span>
    </label>
  </div>
</template>
