import { reactive } from 'vue'

export type ToastKind = 'success' | 'error' | 'info'

/** Botão opcional no aviso (ex.: "Desfazer"); clicar roda a ação e fecha o aviso. */
export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: number
  kind: ToastKind
  text: string
  action?: ToastAction
}

/**
 * Notificações rápidas (canto da tela, somem sozinhas em 5s). Estado
 * module-scope (singleton) para que qualquer componente enxergue a mesma
 * lista, sem precisar de Pinia/Nuxt.
 */
const DEFAULT_DURATION_MS = 5000

let nextId = 1
const toasts = reactive<Toast[]>([])
const timers = new Map<number, ReturnType<typeof setTimeout>>()

function clearTimer(id: number) {
  const timer = timers.get(id)
  if (!timer) return
  clearTimeout(timer)
  timers.delete(id)
}

function dismiss(id: number) {
  clearTimer(id)
  const index = toasts.findIndex((toast) => toast.id === id)
  if (index !== -1) toasts.splice(index, 1)
}

function show(kind: ToastKind, text: string, durationMs = DEFAULT_DURATION_MS, action?: ToastAction): number {
  // No SSR esta lista é module-scope do processo Node inteiro (não por
  // requisição): um toast criado ali entra no HTML de outra pessoa, e o
  // `setTimeout` que o remove nunca roda no servidor. `-1` (e não `0`)
  // porque `0` é um id que `dismiss(0)` trataria como real.
  if (import.meta.server) return -1

  const id = nextId++
  toasts.push(action ? { id, kind, text, action } : { id, kind, text })
  if (durationMs > 0) {
    timers.set(
      id,
      setTimeout(() => dismiss(id), durationMs)
    )
  }
  return id
}

export function useToast() {
  return {
    toasts,
    show,
    success: (text: string) => show('success', text),
    error: (text: string) => show('error', text),
    info: (text: string) => show('info', text),
    dismiss,
    /** Roda a ação do aviso e o fecha. */
    act: (t: Toast) => {
      dismiss(t.id)
      t.action?.run()
    }
  }
}
