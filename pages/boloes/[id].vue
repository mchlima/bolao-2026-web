<script setup lang="ts">
// Pool shell: a slim header (back + badge + name) with the section tabs as pill
// tags, then <NuxtPage> — mirrors the tournament shell. The pool home/overview
// (member standing, meta, manage/leave actions) is the base route (index.vue);
// each tab is its own nested route, so switching swaps only the content.
const route = useRoute();
const id = route.params.id as string;

const { data: pool, pending, error } = await usePoolDetail(id);

const canManage = computed(
  () => pool.value?.myRole === 'OWNER' || pool.value?.myRole === 'ADMIN',
);

// Active section from the URL. The base path is the overview (no tab lit); a
// match-detail page keeps the Jogos tab lit.
const section = computed<string>(() => {
  const p = route.path;
  if (p.endsWith('/ranking')) return 'ranking';
  if (p.endsWith('/temporadas')) return 'temporadas';
  if (p.endsWith('/membros')) return 'membros';
  if (p.endsWith('/convites')) return 'convites';
  if (p.endsWith('/configuracoes')) return 'config';
  if (p.includes(`/boloes/${id}/jogos`)) return 'jogos';
  return 'overview';
});
// Tabs are peers now (Resumo included), so back just leaves the pool.
const backTo = '/boloes';

// The match-detail route renders the full-bleed board, so it opts out of the
// standardized page gutter (mirrors the tournament shell).
const isMatchDetail = computed(() => !!route.params.matchId);

const tabs = computed(() => {
  const t = [
    { key: 'overview', label: 'Resumo', to: `/boloes/${id}` },
    { key: 'ranking', label: 'Ranking', to: `/boloes/${id}/ranking` },
    { key: 'jogos', label: 'Resultados', to: `/boloes/${id}/jogos` },
    { key: 'temporadas', label: 'Temporadas', to: `/boloes/${id}/temporadas` },
    { key: 'membros', label: 'Membros', to: `/boloes/${id}/membros` },
  ];
  if (canManage.value) {
    t.push({ key: 'convites', label: 'Convites', to: `/boloes/${id}/convites` });
    t.push({ key: 'config', label: 'Configurações', to: `/boloes/${id}/configuracoes` });
  }
  return t;
});

const unavailable = computed(() => {
  const status = (error.value as { statusCode?: number } | null)?.statusCode;
  if (status === 403) {
    return {
      title: 'Você não faz parte deste bolão',
      msg: 'Talvez você tenha saído ou sido removido. Peça um novo convite para voltar.',
    };
  }
  return {
    title: 'Bolão não encontrado',
    msg: 'Este bolão não existe mais ou o link está incorreto. Ele pode ter sido excluído pelo dono.',
  };
});
</script>

<template>
  <div class="page" :class="{ 'page--flush': isMatchDetail }">
    <SkeletonList v-if="pending && !pool" variant="row" :count="6" />

    <div v-else-if="error || !pool" class="unavail">
      <div class="ic"><AppIcon name="search" :size="28" :stroke="1.8" /></div>
      <h1 class="font-display u-title">{{ unavailable.title }}</h1>
      <p class="muted u-msg">{{ unavailable.msg }}</p>
      <NuxtLink to="/boloes" class="btn btn-gold">Ver meus bolões</NuxtLink>
    </div>

    <template v-else>
      <!-- Match-detail opens outside the pool shell: the full-bleed board owns the
           screen (and its own back to Resultados), so hide the shell chrome here. -->
      <header v-if="!isMatchDetail" class="thead">
        <div class="trow">
          <NuxtLink :to="backTo" class="back" aria-label="Voltar">
            <AppIcon name="arrowLeft" :size="18" :stroke="2.4" />
          </NuxtLink>
          <div class="htitle">
            <span class="ht-main font-display">{{ pool.name }}</span>
          </div>
        </div>

        <!-- Section tabs: route-based pill tags; clicking swaps only <NuxtPage>. -->
        <nav class="tabs" aria-label="Seções do bolão">
          <NuxtLink
            v-for="t in tabs"
            :key="t.key"
            :to="t.to"
            class="tab"
            :class="{ on: section === t.key }"
            :aria-current="section === t.key ? 'page' : undefined"
          >
            {{ t.label }}
          </NuxtLink>
        </nav>
      </header>

      <NuxtPage />
    </template>
  </div>
</template>

<style scoped>
.page {
  padding: 10px;
}
/* The match screen is full-bleed (the board paints edge-to-edge), so it opts out
   of the standardized page gutter. */
.page--flush {
  padding: 0;
}
.unavail {
  max-width: 420px;
  margin: 8vh auto 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.unavail .ic {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  font-size: 28px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
}
.u-title {
  font-weight: 700;
  font-size: clamp(20px, 5vw, 26px);
  text-transform: uppercase;
  line-height: 1.1;
}
.u-msg {
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 6px;
}

/* Slim header (matches the tournament shell). */
.thead {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 6px 0 16px;
}
.trow {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}
.back {
  flex: none;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  margin-left: -8px;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.13s;
}
.back:hover {
  color: var(--text);
}
.htitle {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ht-main {
  font-weight: 700;
  font-size: clamp(17px, 4.4vw, 24px);
  text-transform: uppercase;
  line-height: 1.05;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Section tabs — small pill tags. Single row that scrolls sideways (full-bleed
   to the screen edges) when it overflows the container, instead of wrapping. */
.tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  /* Side gutter comes from .page; tags scroll within it. */
}
.tabs::-webkit-scrollbar {
  display: none;
}
.tab {
  flex: none;
  padding: 7px 15px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--muted);
  font-weight: 700;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.tab:hover {
  color: var(--text);
  border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
}
.tab.on {
  background: var(--grad-pitch);
  color: #fff;
  border-color: transparent;
}
</style>
