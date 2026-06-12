// App-wide access gate. Logged-out visitors may only see the public landing
// (/inicio) and the auth pages; everything else redirects them to /inicio.
// Logged-in users never see the landing — they're sent to the app home.
// Runs SSR + client (token lives in a cookie, available on both).
const PUBLIC = new Set(['/inicio', '/login', '/register']);

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  const isPublic = PUBLIC.has(to.path);

  if (!auth.token && !isPublic) {
    return navigateTo('/inicio');
  }
  if (auth.token && to.path === '/inicio') {
    return navigateTo('/');
  }
});
