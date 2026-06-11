import * as flags from 'country-flag-icons/string/3x2';
import type { Team } from '~/types/api';

export function teamFlag(team?: Team | null): string | null {
  const cc = team?.countryCode;
  if (!cc) return null;
  return (flags as unknown as Record<string, string>)[cc] ?? null;
}

export function teamAbbr(team?: Team | null, fallback?: string | null): string {
  const base = team?.shortName || team?.name || fallback || '?';
  return base.toUpperCase().slice(0, 3);
}

/** Deterministic emblem color from the team identity (clubs/flags fallback). */
export function teamColor(team?: Team | null): string {
  const key = team?.countryCode || team?.shortName || team?.name || 'X';
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 40%)`;
}
