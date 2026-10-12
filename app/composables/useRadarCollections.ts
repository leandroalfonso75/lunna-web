import { computed, ref } from 'vue'
import { apiErrorMessage } from '../lib/apiErrors'
import { createRadarCollectionsClient, isActiveCollection, type RadarCollection } from '../lib/radarCollectionsClient'
import { useToast } from './useToast'

/**
 * Pedidos de coleta do Radar. A coleta nunca é agendada nem automática: o
 * usuário pede, o pedido entra na fila e só é atendido sob comando do dono.
 */
export function useRadarCollections() {
  const { $api } = useNuxtApp()
  const client = createRadarCollectionsClient($api)
  const toast = useToast()

  const collections = ref<RadarCollection[]>([])
  const loading = ref(false)
  const busy = ref(false)

  const activeByPath = computed(() => {
    const map = new Map<string, RadarCollection>()
    for (const c of collections.value) if (isActiveCollection(c)) map.set(c.category_path, c)
    return map
  })

  async function load() {
    loading.value = true
    try {
      collections.value = (await client.list()).collections
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não foi possível carregar os pedidos de coleta.'))
    } finally {
      loading.value = false
    }
  }

  async function request(categoryPath: string) {
    busy.value = true
    try {
      await client.request(categoryPath)
      toast.success('Pedido de coleta registrado. Ele será atendido quando a coleta for executada.')
      await load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não foi possível registrar o pedido.'))
    } finally {
      busy.value = false
    }
  }

  async function cancel(id: string) {
    busy.value = true
    try {
      await client.cancel(id)
      await load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não foi possível cancelar o pedido.'))
    } finally {
      busy.value = false
    }
  }

  return { collections, loading, busy, activeByPath, load, request, cancel }
}
