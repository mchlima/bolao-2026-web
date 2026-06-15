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

/** The wall-clock parts of a UTC instant as seen in `tz`. */
function partsIn(date: Date, tz: string): Record<string, string> {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((a, p) => ((a[p.type] = p.value), a), {});
}

/** UTC ISO → "YYYY-MM-DDTHH:mm" wall-clock in `tz`, for a datetime-local input. */
export function utcToZonedInput(iso: string, tz: string = DEFAULT_TZ): string {
  const p = partsIn(new Date(iso), tz);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "YYYY-MM-DDTHH:mm" wall-clock in `tz` → UTC ISO. Inverse of utcToZonedInput. */
export function zonedInputToUtc(local: string, tz: string = DEFAULT_TZ): string {
  const [d, t] = local.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, da, h, mi); // the parts read as if they were UTC
  const p = partsIn(new Date(guess), tz); // ...seen in tz
  const back = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const offset = back - guess; // how far tz is ahead of UTC at that instant
  return new Date(guess - offset).toISOString();
}

const TIER_LABEL: Record<string, string> = {
  EXACT: 'Cravou',
  WINNER_GOALS: 'Gols do vencedor',
  GOAL_DIFF: 'Acertou o saldo',
  LOSER_GOALS: 'Gols do perdedor',
  OUTCOME: 'Acertou o vencedor',
  NONE: 'Não pontuou',
};

export function tierLabel(tier?: string | null, isDraw = false): string {
  if (!tier) return '';
  // A draw has no winner — the OUTCOME tier means "got the draw right".
  if (tier === 'OUTCOME' && isDraw) return 'Acertou o empate';
  return TIER_LABEL[tier] ?? tier;
}

// Single source of truth for tier accent colors — shared by the match cards,
// the live board and the generated share image (so they never drift apart).
export const TIER_COLOR: Record<string, string> = {
  EXACT: 'var(--emerald)',
  WINNER_GOALS: 'var(--azure)',
  GOAL_DIFF: 'var(--gold)',
  OUTCOME: 'var(--magenta)',
  LOSER_GOALS: 'var(--scarlet)',
  NONE: 'var(--muted)',
};

/** Accent color for a tier, falling back to muted for unknown/absent tiers. */
export function tierColor(tier?: string | null): string {
  return (tier && TIER_COLOR[tier]) || 'var(--muted)';
}
