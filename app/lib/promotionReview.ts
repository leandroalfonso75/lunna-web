import type { PromotionItemRow, PromotionListRow, PromotionsResponse } from '../types/promotions'

/**
 * "Ciente, nada a ser feito" (e qualquer ação que deu certo) num anúncio de "Para revisar": acerta a lista já carregada
 * na hora, sem esperar recarregar. Com `dismissed`, o anúncio sai da guia "Para revisar" (e do card) e entra em
 * "Ciente"; sem, o contrário ("Voltar para revisar"). Na guia de onde ele saiu, a linha some (também de dentro do produto
 * com variações; o produto que fica vazio some). `stillInReview = false`: a ação já tirou o anúncio da revisão (ex.:
 * aplicou uma oferta que cabe), então ele também não vai para "Ciente".
 * Devolve uma cópia da resposta e se a linha saiu da lista; anúncio que não está na lista (ou não está em revisão) não muda nada.
 */
export function markReviewDismissed(
  res: PromotionsResponse, itemId: string, dismissed: boolean, view: string, stillInReview = true
): { response: PromotionsResponse; removed: boolean } {
  const found = findItem(res.items, itemId)
  if (!found || found.status.key !== 'para_revisar' || found.manual || !!found.review_dismissed === dismissed) return { response: res, removed: false }

  const remove = (view === 'para_revisar' && dismissed) || (view === 'revisar_ciente' && !dismissed)
  const step = dismissed ? -1 : 1
  const counts: Record<string, number> = { ...res.counts, para_revisar: Math.max(0, (res.counts.para_revisar ?? 0) + step) }
  const ciente = (res.counts.revisar_ciente ?? 0) - step
  counts.revisar_ciente = Math.max(0, dismissed && !stillInReview ? (res.counts.revisar_ciente ?? 0) : ciente)
  const summary = { ...res.summary, to_review: Math.max(0, res.summary.to_review + step) }

  let total = res.total
  const items: PromotionListRow[] = []
  for (const row of res.items) {
    if (!('group' in row)) {
      if (row.item_id !== itemId) items.push(row)
      else if (remove) total -= 1
      else items.push({ ...row, review_dismissed: dismissed })
      continue
    }
    if (!row.children.some((c) => c.item_id === itemId)) {
      items.push(row)
      continue
    }
    const children = remove ? row.children.filter((c) => c.item_id !== itemId) : row.children.map((c) => (c.item_id === itemId ? { ...c, review_dismissed: dismissed } : c))
    if (!children.length) {
      total -= 1
      continue
    }
    items.push({ ...row, children, ...(remove && row.matched !== undefined ? { matched: row.matched - 1 } : {}) })
  }
  return { response: { ...res, counts, summary, items, total: Math.max(0, total) }, removed: remove }
}

function findItem(rows: PromotionListRow[], itemId: string): PromotionItemRow | undefined {
  for (const row of rows) {
    if ('group' in row) {
      const child = row.children.find((c) => c.item_id === itemId)
      if (child) return child
    } else if (row.item_id === itemId) return row
  }
  return undefined
}
