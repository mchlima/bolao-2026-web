// Status labels/tones for the content pipeline (mirrors the API state machine).
export const NEWS_STATUS: Record<
  string,
  { label: string; tone: 'neutral' | 'azure' | 'emerald' | 'gold' | 'scarlet' }
> = {
  DISCOVERED: { label: 'Descoberto', tone: 'neutral' },
  FILTERED: { label: 'Filtrado', tone: 'neutral' },
  PROCESSING: { label: 'Processando', tone: 'azure' },
  PENDING_REVIEW: { label: 'Em revisão', tone: 'gold' },
  APPROVED: { label: 'Aprovado', tone: 'emerald' },
  REJECTED: { label: 'Rejeitado', tone: 'scarlet' },
  FAILED: { label: 'Falhou', tone: 'scarlet' },
};

export function newsStatus(s: string) {
  return NEWS_STATUS[s] ?? { label: s, tone: 'neutral' as const };
}
