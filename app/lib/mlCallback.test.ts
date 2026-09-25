import { describe, expect, it } from 'vitest'
import { ML_CALLBACK_CODES, mlCallbackMessage } from './mlCallback'

describe('mlCallbackMessage', () => {
  it('mapeia todos os 9 códigos de DECISOES.md §5', () => {
    expect(ML_CALLBACK_CODES).toHaveLength(9)
    for (const code of ML_CALLBACK_CODES) {
      expect(mlCallbackMessage(code)).not.toBeNull()
    }
  })

  it('conectada é o único código de sucesso', () => {
    expect(mlCallbackMessage('conectada')).toEqual({ kind: 'success', text: expect.any(String) })
    const errorCodes = ML_CALLBACK_CODES.filter((c) => c !== 'conectada')
    for (const code of errorCodes) {
      expect(mlCallbackMessage(code)!.kind).toBe('error')
    }
  })

  it('erro_config repete a mesma frase que a API usa para "integração não configurada"', () => {
    expect(mlCallbackMessage('erro_config')!.text).toBe('Integração com o Mercado Livre não configurada.')
  })

  it('devolve null para um valor desconhecido ou ausente', () => {
    expect(mlCallbackMessage('qualquer-coisa')).toBeNull()
    expect(mlCallbackMessage(undefined)).toBeNull()
    expect(mlCallbackMessage(null)).toBeNull()
    expect(mlCallbackMessage('')).toBeNull()
  })
})
