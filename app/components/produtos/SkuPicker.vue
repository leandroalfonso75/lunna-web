<script setup lang="ts">
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { ref, watch } from 'vue'
import { brl } from '../../lib/format'
import { catalogClient, type Component, type ComponentInfo, type SkuHit } from '../../lib/catalogProducts'

/**
 * Escolha de SKUs com quantidade para compor um kit (produtos do ERP sincronizados no Lunna). Usado no Kit, na variação
 * que é kit e nos itens que vão em todas as variações-kit.
 */
const props = withDefaults(defineProps<{ modelValue: Component[]; info: Record<string, ComponentInfo | SkuHit>; disabled?: boolean; placeholder?: string; testId?: string }>(),
  { disabled: false, placeholder: 'Buscar SKU, nome ou EAN', testId: 'sku' })
const emit = defineEmits<{ 'update:modelValue': [Component[]]; found: [SkuHit] }>()

const { $api } = useNuxtApp()
const client = catalogClient($api as never)
const q = ref('')
const hits = ref<SkuHit[]>([])
const searching = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

watch(q, (value) => {
  clearTimeout(timer)
  if (value.trim().length < 2) { hits.value = []; return }
  timer = setTimeout(async () => {
    searching.value = true
    hits.value = (await client.skuSearch(value.trim()).catch(() => ({ items: [] }))).items
    searching.value = false
  }, 250)
})

function add(hit: SkuHit) {
  emit('found', hit)
  if (!props.modelValue.some((c) => c.sku === hit.sku)) emit('update:modelValue', [...props.modelValue, { sku: hit.sku, quantity: 1 }])
  q.value = ''
  hits.value = []
}
function setQty(sku: string, value: string) {
  const qty = Number(value.replace(',', '.'))
  emit('update:modelValue', props.modelValue.map((c) => (c.sku === sku ? { ...c, quantity: qty > 0 ? qty : 1 } : c)))
}
function remove(sku: string) {
  emit('update:modelValue', props.modelValue.filter((c) => c.sku !== sku))
}
</script>

<template>
  <div class="space-y-2" :data-test="`${testId}-picker`">
    <ul v-if="modelValue.length" class="space-y-1">
      <li v-for="c in modelValue" :key="c.sku" class="flex items-center gap-2 rounded border border-line bg-surface-2 px-2 py-1 text-[13px]" :data-test="`${testId}-item`">
        <span class="font-mono text-[12px] text-ink">{{ c.sku }}</span>
        <span class="min-w-0 flex-1 truncate text-ink-2">{{ info[c.sku]?.name ?? 'SKU não encontrado nos produtos' }}</span>
        <span v-if="info[c.sku]?.cost" class="text-[12px] text-ink-3">custo {{ brl(info[c.sku]!.cost) }}</span>
        <label class="flex items-center gap-1 text-[12px] text-ink-3">
          qtd
          <input :value="c.quantity" type="number" min="1" step="1" class="input h-7 w-16 px-1 text-right" :disabled="disabled" :aria-label="`Quantidade de ${c.sku}`" @change="setQty(c.sku, ($event.target as HTMLInputElement).value)" />
        </label>
        <button v-if="!disabled" type="button" class="btn-link p-0.5" :aria-label="`Tirar ${c.sku}`" @click="remove(c.sku)"><XMarkIcon class="h-4 w-4" /></button>
      </li>
    </ul>
    <div v-if="!disabled" class="relative">
      <input v-model="q" type="search" class="input h-9" :placeholder="placeholder" :data-test="`${testId}-busca`" />
      <ul v-if="hits.length" class="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-card border border-line bg-surface shadow-lg">
        <li v-for="h in hits" :key="h.sku">
          <button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-surface-2" :data-test="`${testId}-resultado`" @click="add(h)">
            <span class="font-mono text-[12px]">{{ h.sku }}</span>
            <span class="min-w-0 flex-1 truncate text-ink-2">{{ h.name }}</span>
            <span v-if="h.kit" class="rounded-full bg-surface-2 px-1.5 text-[10px] font-bold text-ink-3">KIT</span>
            <span v-if="h.cost" class="text-[12px] text-ink-3">{{ brl(h.cost) }}</span>
          </button>
        </li>
      </ul>
      <p v-else-if="searching" class="mt-1 text-[12px] text-ink-3">Buscando…</p>
    </div>
  </div>
</template>
