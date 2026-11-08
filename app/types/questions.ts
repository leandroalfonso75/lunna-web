/** Seção Perguntas (`GET /api/questions`). */
export interface Question {
  id: number
  item_id: string
  text: string
  date_created: string
  from_id: number | null
  status: string
  status_label: string
  status_tone: 'success' | 'warn' | 'danger' | 'neutral'
  answerable: boolean
  hold: boolean
  answer: { text: string; date: string | null; status: string | null } | null
  item: { title: string; thumbnail: string | null; permalink: string | null; price: number | null; stock: number | null; status: string | null } | null
}

export interface QuestionsResponse {
  view: 'sem_resposta' | 'respondidas' | 'todas'
  total: number
  page: number
  per_page: number
  counts: { sem_resposta: number; respondidas: number; todas: number }
  synced_at: string | null
  questions: Question[]
}

/** Resposta padrão (`/api/question_templates`). */
export interface QuestionTemplate {
  id: number
  title: string
  body: string
  position: number
}
