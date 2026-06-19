/**
 * Single source of truth for the `bolao-token` cookie. Scopes it to the parent
 * domain (`.cravei.app`) in production so it's sent to the API subdomain
 * (api.cravei.app) too — that lets the SSE stream authenticate via cookie, since
 * EventSource can't set an Authorization header. On localhost/preview it stays
 * host-only (a `.cravei.app` domain there would be rejected by the browser).
 */
export function useAuthToken() {
  const host = import.meta.client
    ? window.location.hostname
    : useRequestURL().hostname;
  const domain = host.endsWith('cravei.app') ? '.cravei.app' : undefined;
  return useCookie<string | null>('bolao-token', {
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    domain,
  });
}
