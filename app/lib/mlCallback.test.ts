import { describe, expect, it } from 'vitest'
import { connectErrorMessage, ML_CALLBACK_CODES, mlCallbackMessage } from './mlCallback'

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

describe('connectErrorMessage (POST /api/ml_accounts/connect, DECISOES.md §5)', () => {
  it('usa o texto padrão quando o erro vem com um code conhecido', () => {
    const err = { data: { errors: ['ignorado'], code: 'outra_empresa' } }
    expect(connectErrorMessage(err)).toEqual({
      kind: 'error',
      text: 'Esta conta do Mercado Livre já está conectada a outra empresa.'
    })
  })

  it('cai no errors[0] da API quando o code não é reconhecido', () => {
    const err = { data: { errors: ['Mensagem específica da API.'], code: 'algo_novo' } }
    expect(connectErrorMessage(err)).toEqual({ kind: 'error', text: 'Mensagem específica da API.' })
  })

  it('cai na mensagem genérica quando não há code nem errors', () => {
    expect(connectErrorMessage(new Error('network'))).toEqual({
      kind: 'error',
      text: 'Não foi possível conectar a conta agora. Tente de novo.'
    })
  })
})
