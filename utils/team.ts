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

/** The crest URL, preferring the dark variant on dark themes when available. */
export function teamLogo(team?: Team | null, dark = false): string | null {
  if (!team) return null;
  return (dark && team.logoDarkUrl) || team.logoUrl || null;
}

const HEX = /^#?[0-9a-fA-F]{6}$/;

/** Emblem color: the team's real brand color when known, else deterministic. */
export function teamColor(team?: Team | null): string {
  if (team?.color && HEX.test(team.color)) {
    return team.color.startsWith('#') ? team.color : `#${team.color}`;
  }
  const key = team?.countryCode || team?.shortName || team?.name || 'X';
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 40%)`;
}
