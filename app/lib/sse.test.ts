import { describe, expect, it, vi } from 'vitest'
import { createSseParser } from './sse'

function buildParser() {
  const onData = vi.fn()
  const onDone = vi.fn()
  const onError = vi.fn()
  const parser = createSseParser({ onData, onDone, onError })
  return { parser, onData, onDone, onError }
}

describe('createSseParser', () => {
  it('decodifica uma linha data: "<texto>" completa', () => {
    const { parser, onData } = buildParser()
    parser.push('data: "Olá, mundo"\n\n')
    expect(onData).toHaveBeenCalledWith('Olá, mundo')
  })

  it('reconstrói uma linha partida no meio por chunks separados', () => {
    const { parser, onData } = buildParser()
    parser.push('data: "Ol')
    expect(onData).not.toHaveBeenCalled()
    parser.push('á, mun')
    parser.push('do"\n\n')
    expect(onData).toHaveBeenCalledTimes(1)
    expect(onData).toHaveBeenCalledWith('Olá, mundo')
  })

  it('junta vários chunks de texto em eventos separados, na ordem', () => {
    const { parser, onData } = buildParser()
    parser.push('data: "um"\n\n')
    parser.push('data: "dois"\n\n')
    parser.push('data: "três"\n\n')
    expect(onData.mock.calls.map((c) => c[0])).toEqual(['um', 'dois', 'três'])
  })

  it('event: done dispara onDone', () => {
    const { parser, onDone, onData } = buildParser()
    parser.push('data: "parte final"\n\n')
    parser.push('event: done\ndata: ""\n\n')
    expect(onData).toHaveBeenCalledWith('parte final')
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('event: done sem data também dispara onDone', () => {
    const { parser, onDone } = buildParser()
    parser.push('event: done\n\n')
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('event: error com data: {"message": "..."} dispara onError com a mensagem', () => {
    const { parser, onError } = buildParser()
    parser.push('event: error\ndata: {"message": "limite atingido"}\n\n')
    expect(onError).toHaveBeenCalledWith('limite atingido')
  })

  it('event: error com data inválido cai numa mensagem genérica, sem quebrar', () => {
    const { parser, onError } = buildParser()
    expect(() => parser.push('event: error\ndata: não é json\n\n')).not.toThrow()
    expect(onError).toHaveBeenCalledWith('Erro desconhecido.')
  })

  it('um chunk com vários eventos completos de uma vez processa todos', () => {
    const { parser, onData, onDone } = buildParser()
    parser.push('data: "a"\n\ndata: "b"\n\nevent: done\n\n')
    expect(onData.mock.calls.map((c) => c[0])).toEqual(['a', 'b'])
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('end() despacha um evento pendente sem a linha em branco final', () => {
    const { parser, onData } = buildParser()
    parser.push('data: "sem blank line no fim"')
    expect(onData).not.toHaveBeenCalled()
    parser.end()
    expect(onData).toHaveBeenCalledWith('sem blank line no fim')
  })

  it('end() sem nada pendente não dispara nada', () => {
    const { parser, onData, onDone, onError } = buildParser()
    parser.push('data: "x"\n\n')
    parser.end()
    expect(onData).toHaveBeenCalledTimes(1)
    expect(onDone).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('ignora linhas de comentário (iniciadas com ":")', () => {
    const { parser, onData } = buildParser()
    parser.push(': keep-alive\ndata: "oi"\n\n')
    expect(onData).toHaveBeenCalledWith('oi')
  })
})
