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
  total: number
  page: number
  per_page: number
  import: { total: number; detailed: number; open: number; listed_at: string | null; full_listed_at: string | null }
}
