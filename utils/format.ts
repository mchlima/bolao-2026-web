// UTC is stored; times are rendered in the account timezone (default Brasília).
export const DEFAULT_TZ = 'America/Sao_Paulo';

export function formatDate(iso?: string | null, tz: string = DEFAULT_TZ): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: tz,
  }).format(new Date(iso));
}

export function formatKickoff(iso: string, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  }).format(new Date(iso));
}

const TIER_LABEL: Record<string, string> = {
  EXACT: 'Cravou',
  ONE_TEAM_SCORE: 'Acertou um placar',
  GOAL_DIFF: 'Acertou o saldo',
  OUTCOME: 'Acertou o vencedor',
  NONE: 'Não pontuou',
};

export function tierLabel(tier?: string | null): string {
  return tier ? (TIER_LABEL[tier] ?? tier) : '';
}
