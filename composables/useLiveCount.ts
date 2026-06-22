import type { Match } from '~/types/api';

// Contagem global de jogos AO VIVO agora. Alimenta o indicador do header (dot
// vermelho pulsando). Compartilhada via useState (uma busca por app) e atualizada
// por polling no cliente enquanto a aba estiver visível.
export function useLiveCount() {
  const count = useState<number>('live-count', () => 0);

  async function fetchCount() {
    try {
      const res = await useApi()<{ days: { matches: Match[] }[] }>('/agenda?scope=live&limit=200');
      count.value = (res.days ?? []).reduce((n, d) => n + d.matches.length, 0);
    } catch {
      // falha silenciosa — mantém o último valor conhecido
    }
  }

  // Liga o polling só uma vez no cliente (o flag mora no mesmo state global).
  const started = useState<boolean>('live-count-started', () => false);
  if (import.meta.client && !started.value) {
    started.value = true;
    fetchCount();
    const tick = () => {
      if (document.visibilityState === 'visible') fetchCount();
    };
    const timer = setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    if (getCurrentInstance()) {
      onScopeDispose(() => {
        clearInterval(timer);
        document.removeEventListener('visibilitychange', tick);
        started.value = false;
      });
    }
  }

  return { count, refresh: fetchCount };
}
