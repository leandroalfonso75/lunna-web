/**
 * Mapeamento dos códigos `?ml=` que `GET /auth/ml/callback` devolve no
 * redirect (DECISOES.md §5) para a mensagem em português mostrada no banner
 * de Configurações › Contas do Mercado Livre. Desde a mudança de segurança
 * do fluxo, o callback só resolve `cancelada`/`link_invalido` sozinho; os
 * demais (inclusive o sucesso, `conectada`) vêm da resposta de
 * `POST /api/ml_accounts/connect` — ver `connectErrorMessage` abaixo.
 */
import { apiErrorCode, apiErrorMessage } from './apiErrors'

export const ML_CALLBACK_CODES = [
  'conectada',
  'cancelada',
  'link_invalido',
  'expirada',
  'sem_permissao',
  'erro_config',
  'erro',
  'sem_offline_access',
  'outra_empresa'
] as const

export type MlCallbackCode = (typeof ML_CALLBACK_CODES)[number]

export type MlCallbackKind = 'success' | 'error'

export interface MlCallbackMessage {
  kind: MlCallbackKind
  text: string
}

const MESSAGES: Record<MlCallbackCode, MlCallbackMessage> = {
  conectada: { kind: 'success', text: 'Conta do Mercado Livre conectada.' },
  cancelada: { kind: 'error', text: 'Conexão cancelada.' },
  link_invalido: { kind: 'error', text: 'Link de autorização inválido.' },
  expirada: { kind: 'error', text: 'O link de autorização expirou. Tente conectar de novo.' },
  sem_permissao: { kind: 'error', text: 'Você não tem mais permissão de administrador para concluir esta conexão.' },
  erro_config: { kind: 'error', text: 'Integração com o Mercado Livre não configurada.' },
  erro: { kind: 'error', text: 'Não foi possível concluir a conexão com o Mercado Livre. Tente de novo.' },
  sem_offline_access: { kind: 'error', text: 'A autorização não incluiu acesso offline. Tente conectar de novo.' },
  outra_empresa: { kind: 'error', text: 'Esta conta do Mercado Livre já está conectada a outra empresa.' }
}

export function isMlCallbackCode(value: unknown): value is MlCallbackCode {
  return typeof value === 'string' && (ML_CALLBACK_CODES as readonly string[]).includes(value)
}

/** `null` quando `value` não é um código reconhecido (ou o parâmetro `ml` não veio). */
export function mlCallbackMessage(value: unknown): MlCallbackMessage | null {
  return isMlCallbackCode(value) ? MESSAGES[value] : null
}

/**
 * Banner de erro de `POST /api/ml_accounts/connect` — o corpo vem
 * `{ errors: [...], code: "..." }`; `code` conhecido usa o texto padrão
 * daqui, código desconhecido cai no `errors[0]` da API.
 */
export function connectErrorMessage(err: unknown): MlCallbackMessage {
  const known = mlCallbackMessage(apiErrorCode(err))
  if (known) return known
  return { kind: 'error', text: apiErrorMessage(err, 'Não foi possível conectar a conta agora. Tente de novo.') }
}
