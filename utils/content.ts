// Status labels/tones for the content pipeline (mirrors the API state machine).
export const NEWS_STATUS: Record<
  string,
  { label: string; tone: 'neutral' | 'azure' | 'emerald' | 'gold' | 'scarlet' }
> = {
  DISCOVERED: { label: 'Descoberto', tone: 'neutral' },
  FILTERED: { label: 'Filtrado', tone: 'neutral' },
  PROCESSING: { label: 'Processando', tone: 'azure' },
  PENDING_REVIEW: { label: 'Em revisão', tone: 'gold' },
  PROMOTED: { label: 'Enviado ao CMS', tone: 'emerald' },
  REJECTED: { label: 'Rejeitado', tone: 'scarlet' },
  FAILED: { label: 'Falhou', tone: 'scarlet' },
  DUPLICATE: { label: 'Duplicada', tone: 'neutral' },
};

export function newsStatus(s: string) {
  return NEWS_STATUS[s] ?? { label: s, tone: 'neutral' as const };
}

// Status do CMS (Post): rascunho/publicado/arquivado.
export const POST_STATUS: Record<
  string,
  { label: string; tone: 'neutral' | 'azure' | 'emerald' | 'gold' | 'scarlet' }
> = {
  DRAFT: { label: 'Rascunho', tone: 'gold' },
  PUBLISHED: { label: 'Publicado', tone: 'emerald' },
  ARCHIVED: { label: 'Arquivado', tone: 'neutral' },
};

export function postStatus(s: string) {
  return POST_STATUS[s] ?? { label: s, tone: 'neutral' as const };
}
