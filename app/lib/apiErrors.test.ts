import { describe, expect, it } from 'vitest'
import { apiErrorMessage, apiErrorMessages, apiErrorStatus } from './apiErrors'

describe('apiErrorStatus', () => {
  it('reads the status wherever ofetch happens to put it', () => {
    expect(apiErrorStatus({ status: 402 })).toBe(402)
    expect(apiErrorStatus({ response: { status: 422 } })).toBe(422)
    expect(apiErrorStatus({ statusCode: 500 })).toBe(500)
  })

  it('prefers the top-level status when both are present', () => {
    expect(apiErrorStatus({ status: 402, response: { status: 500 } })).toBe(402)
  })

  it('is undefined for anything that is not an HTTP failure', () => {
    expect(apiErrorStatus(new Error('network'))).toBeUndefined()
    expect(apiErrorStatus(null)).toBeUndefined()
    expect(apiErrorStatus(undefined)).toBeUndefined()
    expect(apiErrorStatus({ status: '402' })).toBeUndefined()
  })
})

describe('apiErrorMessage', () => {
  it('returns the first message the API sent', () => {
    expect(apiErrorMessage({ data: { errors: ['E-mail ou senha inválidos.'] } }, 'padrão')).toBe(
      'E-mail ou senha inválidos.'
    )
  })

  it('falls back when there is nothing usable', () => {
    expect(apiErrorMessage({ data: { errors: [] } }, 'padrão')).toBe('padrão')
    expect(apiErrorMessage({ data: { errors: ['   '] } }, 'padrão')).toBe('padrão')
    expect(apiErrorMessage({ data: {} }, 'padrão')).toBe('padrão')
    expect(apiErrorMessage(new Error('network'), 'padrão')).toBe('padrão')
    expect(apiErrorMessage(null, 'padrão')).toBe('padrão')
  })

  it('ignores non-string entries instead of printing [object Object]', () => {
    expect(apiErrorMessage({ data: { errors: [{ campo: 'email' }, 'Use outro e-mail.'] } }, 'padrão')).toBe(
      'Use outro e-mail.'
    )
  })
})

describe('apiErrorMessages', () => {
  it('keeps every message for forms that list one per line', () => {
    expect(apiErrorMessages({ data: { errors: ['Nome obrigatório.', 'E-mail inválido.'] } }, 'padrão')).toEqual([
      'Nome obrigatório.',
      'E-mail inválido.'
    ])
  })

  it('falls back to a single default line', () => {
    expect(apiErrorMessages(new Error('network'), 'padrão')).toEqual(['padrão'])
  })
})
