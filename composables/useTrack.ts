/**
 * Dispara eventos do GA4 (gtag) de forma segura.
 *
 * - Em DEV o gtag nem é carregado (só em produção, ver nuxt.config) → vira no-op.
 * - NÃO decide tráfego interno: isso é gerenciado direto no GA4 (regra de
 *   "Tráfego interno" por IP + filtro "Internal Traffic"), que marca page_views
 *   E eventos do IP como internos. Assim o controle fica todo no painel do GA4.
 *
 * Uso: `const { track } = useTrack(); track('palpite', { match_id })`.
 */
export function useTrack() {
  function track(name: string, params: Record<string, unknown> = {}): void {
    if (import.meta.server) return;
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (!w.gtag) return;
    w.gtag('event', name, params);
  }
  return { track };
}
