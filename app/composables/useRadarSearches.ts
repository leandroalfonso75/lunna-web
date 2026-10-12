import { ref } from 'vue'
import { apiErrorMessage } from '../lib/apiErrors'
import { createRadarSearchesClient, type NewRadarSearch, type RadarSearch } from '../lib/radarSearchesClient'
import { useToast } from './useToast'

/** Histórico de consultas do Radar (últimos 3 meses), salvo no banco. */
export function useRadarSearches() {
  const { $api } = useNuxtApp()
  const client = createRadarSearchesClient($api)
  const toast = useToast()

  const searches = ref<RadarSearch[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      searches.value = (await client.list()).searches
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não foi possível carregar as consultas anteriores.'))
    } finally {
      loading.value = false
    }
  }

  /** Salva em segundo plano: falhar aqui não pode atrapalhar o resultado da pesquisa. */
  async function save(search: NewRadarSearch) {
    try {
      await client.create(search)
    } catch {
      toast.error('A pesquisa foi feita, mas não foi possível salvá-la no histórico.')
    }
  }

  return { searches, loading, load, save }
}
