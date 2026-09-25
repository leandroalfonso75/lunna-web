/**
 * Parser puro de SSE (`POST /api/items/:id/ai-plan`, SPEC §9): linhas
 * `data: "<texto json-string>"` (chunk de texto do plano), `event: done`
 * (fim) e `event: error` + `data: {"message": "..."}` (erro). Implementa o
 * suficiente do formato SSE (campos `event:`/`data:`, evento despachado na
 * linha em branco) para não depender de `EventSource` — que não faz POST
 * nem manda `Authorization` (ver `lib/aiPlanStream.ts`).
 *
 * `push()` aceita chunks arbitrários do `ReadableStream` do fetch, que podem
 * cortar uma linha ao meio; o texto incompleto fica em buffer até completar.
 */

export interface SseCallbacks {
  onData: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
}

export interface SseParser {
  push(chunk: string): void
  /** Despacha qualquer evento pendente ao fim do stream (sem linha em branco final). */
  end(): void
}

export function createSseParser(callbacks: SseCallbacks): SseParser {
  let buffer = ''
  let eventType = 'message'
  let dataLines: string[] = []

  function dispatch() {
    const raw = dataLines.join('\n')
    const type = eventType
    dataLines = []
    eventType = 'message'

    if (type === 'done') {
      callbacks.onDone()
      return
    }

    if (type === 'error') {
      try {
        const parsed = JSON.parse(raw) as { message?: string }
        callbacks.onError(parsed.message ?? 'Erro desconhecido.')
      } catch {
        callbacks.onError('Erro desconhecido.')
      }
      return
    }

    if (!raw) return
    try {
      callbacks.onData(JSON.parse(raw) as string)
    } catch {
      // Linha malformada — ignora em vez de quebrar o stream inteiro.
    }
  }

  function processLine(line: string) {
    if (line === '') {
      dispatch()
      return
    }
    if (line.startsWith(':')) return

    const idx = line.indexOf(':')
    const field = idx === -1 ? line : line.slice(0, idx)
    let value = idx === -1 ? '' : line.slice(idx + 1)
    if (value.startsWith(' ')) value = value.slice(1)

    if (field === 'event') eventType = value
    else if (field === 'data') dataLines.push(value)
  }

  return {
    push(chunk: string) {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) processLine(line.replace(/\r$/, ''))
    },
    end() {
      if (buffer) {
        processLine(buffer)
        buffer = ''
      }
      if (dataLines.length || eventType !== 'message') dispatch()
    }
  }
}
