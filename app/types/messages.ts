/** Seção Mensagens (`GET /api/messages`): conversas de pós-venda do Mercado Livre. */
export interface ConversationMessage {
  id: string
  mine: boolean
  /** quem escreveu: você, o comprador ou o Mercado Livre (assistente/mediação) */
  from?: 'voce' | 'comprador' | 'mercado_livre'
  text: string
  date: string | null
  read: string | null
  moderation: string | null
  attachments: { filename?: string; original_filename?: string; type?: string }[] | null
}

export interface Conversation {
  pack_id: number
  buyer_id: number | null
  status: string | null
  status_label: string | null
  block_reason: string | null
  can_send: boolean
  awaiting: boolean
  claim_ids: number[]
  unread: number
  last_message_at: string | null
  max_length: number
  buyer: { nickname: string | null; name: string | null } | null
  order: { order_id: number; date: string; status: string; total: number; items: { item_id: string; title: string; quantity: number }[] } | null
  messages: ConversationMessage[]
}

export interface MessagesResponse {
  view: 'aguardando' | 'todas'
  total: number
  page: number
  per_page: number
  counts: { aguardando: number; todas: number }
  conversations: Conversation[]
}
