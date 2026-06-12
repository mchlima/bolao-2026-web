// App-wide access gate. Logged-out visitors may only see the public landing
// (/inicio) and the auth pages; everything else redirects them to /inicio.
// Logged-in users default to the app home, but may still open the landing on
// purpose (the account menu links to it) — only the auth pages bounce them off.
// Runs SSR + client (token lives in a cookie, available on both).
const PUBLIC = new Set(['/inicio', '/login', '/register']);

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  const isPublic = PUBLIC.has(to.path);

  if (!auth.token && !isPublic) {
    return navigateTo('/inicio');
  }
  if (auth.token && (to.path === '/login' || to.path === '/register')) {
    return navigateTo('/');
  }
});
