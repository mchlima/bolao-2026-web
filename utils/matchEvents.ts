// Central type→label map for match timeline / narração events. Single source of
// truth for the pt-BR strings, so a future i18n layer can swap this per locale
// (keys are stable language-free codes coming from the backend).
export const EVENT_LABEL: Record<string, string> = {
  GOAL: 'Gol',
  OWN_GOAL: 'Gol contra',
  PENALTY_GOAL: 'Gol de pênalti',
  PENALTY_MISSED: 'Pênalti perdido',
  PENALTY_AWARDED: 'Pênalti',
  YELLOW: 'Cartão amarelo',
  RED: 'Cartão vermelho',
  SECOND_YELLOW: 'Segundo amarelo',
  SUBSTITUTION: 'Substituição',
  VAR: 'VAR',
  FOUL: 'Falta',
  OFFSIDE: 'Impedimento',
  CORNER: 'Escanteio',
  SHOT_ON_TARGET: 'Finalização no alvo',
  SHOT_OFF_TARGET: 'Finalização para fora',
  SHOT_BLOCKED: 'Finalização bloqueada',
  DELAY: 'Paralisação',
};

export const eventLabel = (type: string): string => EVENT_LABEL[type] ?? type;

// The running play-by-play events — shown in a lighter style than the headline
// events (goals/cards/subs/VAR), which keep their own rich rows.
const MINOR = new Set([
  'FOUL',
  'OFFSIDE',
  'CORNER',
  'SHOT_ON_TARGET',
  'SHOT_OFF_TARGET',
  'SHOT_BLOCKED',
  'PENALTY_AWARDED',
]);
export const isMinorEvent = (type: string): boolean => MINOR.has(type);

// Colour category for a minor event's marker dot (quick visual cue beside the label).
export function minorCategory(type: string): 'shot' | 'foul' | 'offside' | 'corner' | 'pen' | '' {
  if (type.startsWith('SHOT_')) return 'shot';
  if (type === 'FOUL') return 'foul';
  if (type === 'OFFSIDE') return 'offside';
  if (type === 'CORNER') return 'corner';
  if (type === 'PENALTY_AWARDED') return 'pen';
  return '';
}
