/** Seção Reclamações (`GET /api/claims`, `GET /api/claims/:id`): tudo importado do Mercado Livre. */
export interface ClaimOrder {
  order_id: number
  buyer_nickname: string | null
  buyer_name: string | null
  total: number | null
  date_created: string | null
  status: string | null
  item: { item_id: string; title: string | null; sku: string | null; quantity: number | null; thumbnail: string | null } | null
}

export interface ClaimRow {
  claim_id: number
  type: string
  type_label: string
  stage: string | null
  stage_label: string | null
  status: string
  status_label: string
  tone: 'warn' | 'neutral' | 'ok' | 'bad'
  reason_id: string | null
  reason: string | null
  reason_name: string | null
  date_created: string | null
  last_updated: string | null
  resource: string | null
  resource_id: number | null
  title: string | null
  action_responsible: string | null
  action_responsible_label: string | null
  due_date: string | null
  affects_reputation: boolean | null
  has_incentive: boolean | null
  resolution: { reason: string | null; benefited: string[]; closed_by: string | null; date: string | null } | null
  order: ClaimOrder | null
  detailed: boolean
  link: string | null
  /** Devolução: habilitada (null = detalhes ainda não importados) e o que aconteceu com ela */
  /** Reembolso ao comprador: integral, parcial ou sem (pelos pagamentos da venda ou pelo que a reclamação diz) */
  refund?: { key: 'integral' | 'parcial' | 'sem' | null; label: string | null; amount?: number | null; paid?: number | null; source?: string | null }
  /** Custo com frete na devolução: Sim / Sim (previsto) / Não, com o valor e se o ML aplicou cobertura */
  freight?: { key: 'sim' | 'previsto' | 'nao' | null; label?: string | null; amount?: number | null; source?: string | null; covered?: boolean; note?: string | null }
  /** A atender: aberta e o ML aguarda o vendedor */
  to_attend?: boolean
  /** prazo da próxima ação (detalhe da reclamação no ML) */
  deadline?: string | null
  seller_actions?: { action: string; label: string; due_date: string | null; mandatory: boolean | null }[]
  /** para quem o vendedor pode mandar mensagem agora: complainant, mediator */
  reply_targets?: string[]
  buyer_wants?: string[]
  what_to_do?: { title: string | null; description: string | null } | null
  last_message?: ClaimMessage | null
  devolution_status?: { enabled: boolean | null; key?: string; label?: string; tone?: string; status?: string | null; shipment_status?: string | null; tracking?: string | null; refund_at?: string | null; money?: string | null; date?: string | null }
}

export interface ClaimMessage {
  sender: string
  sender_label: string
  receiver: string | null
  receiver_label?: string | null
  date: string | null
  text: string
  stage: string | null
  status: string | null
  read_at: string | null
  moderation: Record<string, unknown> | null
  attachments: { filename?: string; original_filename?: string; type?: string; size?: number; date_created?: string }[]
}

export interface ClaimDetail extends ClaimRow {
  detail: Record<string, unknown>
  players: { role: string; role_label: string; type: string; user_id: number }[]
  messages: ClaimMessage[]
  status_history: { date: string; stage: string; status: string; change_by: string }[]
  actions_history: { action_name: string; player_role: string; claim_stage: string; claim_status: string; date_created: string; action_reason_id: string | null }[]
  expected_resolutions: { player_role: string; expected_resolution: string; label: string; status: string; date_created: string; details: unknown[] }[]
  evidences: Record<string, unknown>[]
  changes: Record<string, unknown>[]
  reputation: Record<string, unknown>
  devolution: Record<string, unknown> | null
  reason_info: Record<string, unknown>
  resolution_raw: Record<string, unknown> | null
  related_entities: string[]
  detail_errors: Record<string, string>
  raw: Record<string, unknown>
}

export interface ClaimsResponse {
  claims: ClaimRow[]
  sort?: string
  dir?: 'asc' | 'desc'
  period?: { preset: string; month: string | null; from: string | null; to: string | null }
  /** meses com reclamação, do mais novo para o mais antigo (o atual primeiro) */
  months?: { value: string; label: string; current: boolean }[]
  view?: 'atender' | 'abertas' | null
  /** contadores do botão "A atender" (todas as abertas, sem filtro de período) */
  attention?: { to_attend: number; open: number; can_reply: number }
  total: number
  page: number
  per_page: number
  import: { total: number; detailed: number; open: number; listed_at: string | null; full_listed_at: string | null }
}

/** Assistente de contestação: reclamações que afetam a reputação e ainda podem ser contestadas (60 dias). */
export type ContestStatus = 'pendente' | 'contestada' | 'aceita' | 'negada'

export interface ContestClaim {
  claim_id: number
  status: string
  opened_at: string
  deadline: string
  days_left: number
  group: string
  group_label: string
  strength: string
  reason: string
  reason_code: string | null
  order_id: number | null
  sku: string | null
  title: string | null
  logistic: string | null
  open_with_mediator: boolean
  evidence: string[]
  draft: string
  /** texto adaptado de uma contestação aceita pelo ML (mesmo grupo e motivo, ou mesmo motivo) */
  model?: { claim_id: number; same_group: boolean }
  /** o texto padrão do grupo, quando o sugerido veio de uma contestação aceita */
  generic_draft?: string
  contest: { status: ContestStatus; text: string | null; contested_at: string | null; user: string | null }
  link: string | null
}

export interface ContestsResponse {
  claims: ContestClaim[]
  summary: { total: number; pending?: number; contested?: number; by_group: Record<string, number>; due_7d: number; by_status: Partial<Record<ContestStatus, number>> }
}
