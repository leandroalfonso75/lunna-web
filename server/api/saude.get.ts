// Rota pública de health check (Nitro server route, fora do middleware
// client/page-level `app/middleware/auth.global.ts`, então não exige sessão).
export default defineEventHandler(() => {
  return { ok: true }
})
