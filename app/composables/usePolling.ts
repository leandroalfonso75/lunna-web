import { ref } from 'vue'

/**
 * Releitura periódica (SPEC §7.1/§10 "Atualização"): chama `fetcher` a cada
 * `intervalMs` (padrão 3 min) só com a aba visível, relê na hora ao voltar
 * para a aba, e nunca sobrepõe duas leituras (uma chamada em andamento
 * ignora novos disparos, do timer ou de `refreshNow`).
 *
 * Sem `onMounted`/`onBeforeUnmount` própria: quem usa (página ou outro
 * composable) chama `start()`/`stop()` no lifecycle do componente. Isso
 * também é o que deixa `start()`/`stop()` testáveis direto, sem montar
 * componente Vue nenhum (mesmo padrão de `useTheme.ts`).
 */
export interface UsePollingOptions {
  intervalMs?: number
}

export function usePolling(fetcher: () => Promise<void>, options: UsePollingOptions = {}) {
  const intervalMs = options.intervalMs ?? 3 * 60 * 1000
  const refreshing = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  async function run() {
    if (refreshing.value) return
    refreshing.value = true
    try {
      await fetcher()
    } finally {
      refreshing.value = false
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') run()
  }

  function start() {
    run()
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') run()
    }, intervalMs)
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }

  return { start, stop, refreshNow: run, refreshing }
}
