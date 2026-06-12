/**
 * A reactive clock that ticks every `intervalMs`, so time-based computeds (e.g.
 * "is the prediction window still open?") re-evaluate as time passes instead of
 * freezing at first render. Client-only; SSR keeps the initial value.
 */
export function useNow(intervalMs = 15000) {
  const now = ref(Date.now());
  if (import.meta.client) {
    const t = setInterval(() => {
      now.value = Date.now();
    }, intervalMs);
    onScopeDispose(() => clearInterval(t));
  }
  return now;
}
