// Slug público de URL da competição — ESPELHA o backend (competitionUrlSlug):
// sem acento, minúsculo, dropando "FIFA". Ex.: "Copa do Mundo FIFA" → "copa-do-mundo",
// "Brasileirão Série A" → "brasileirao-serie-a". Prefira o urlSlug persistido quando
// vier no payload; isto é o fallback derivado do nome.
export function competitionUrlSlug(name: string): string {
  return (
    name
      .replace(/\bFIFA\b/gi, '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'campeonato'
  );
}

// URL do hub do campeonato a partir da COMPETIÇÃO (prefere o urlSlug persistido,
// senão deriva do nome). Retorna null quando não há competição — o chamador decide
// o fallback. `suffix` opcional p/ sub-rota (ex.: '/jogos', '/tabela').
export function competitionHref(
  competition?: { name?: string | null; urlSlug?: string | null } | null,
  suffix = '',
): string | null {
  if (!competition) return null;
  const slug = competition.urlSlug || (competition.name ? competitionUrlSlug(competition.name) : '');
  return slug ? `/futebol/campeonato/${slug}${suffix}` : null;
}
