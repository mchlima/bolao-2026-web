/**
 * Dispara eventos do GA4 (gtag) de forma segura.
 *
 * - Em DEV o gtag nem é carregado (só em produção, ver nuxt.config) → vira no-op.
 * - Marca `traffic_type: 'internal'` quando o usuário é ADMIN, para o filtro
 *   "Internal Traffic" do GA4 excluir essas conversões dos relatórios públicos
 *   (assim a sua própria navegação no site não infla as métricas).
 *
 * Uso: `const { track } = useTrack(); track('palpite', { match_id })`.
 */
export function useTrack() {
  const auth = useAuthStore();
  function track(name: string, params: Record<string, unknown> = {}): void {
    if (import.meta.server) return;
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (!w.gtag) return;
    w.gtag('event', name, auth.isAdmin ? { ...params, traffic_type: 'internal' } : params);
  }
  return { track };
}
