<script setup lang="ts">
import type { MatchPreview, PreviewTeamRef } from '~/types/api';

// Prévia de um jogo AGENDADO: forma recente, retrospecto (H2H), o que está em
// jogo (tabela do grupo) e artilheiros da competição. Tudo determinístico, do
// nosso banco (GET /matches/:id/preview). Renderizada SSR pelo MatchRankingView
// só enquanto a partida não começou. Cada bloco some quando não há dado.
const props = defineProps<{ matchId: string }>();

const api = useApi();
const auth = useAuthStore();
const authLink = useAuthLink();
const route = useRoute();
const router = useRouter();
const { data: preview } = await useAsyncData(`preview-${props.matchId}`, () =>
  api<MatchPreview>(`/matches/${props.matchId}/preview`),
);

const show = computed(() => !!preview.value?.available);
const homeName = computed(() => preview.value?.home?.name ?? '');
const awayName = computed(() => preview.value?.away?.name ?? '');
// Lede determinístico (só nomes dos times): enquadra a seção e dá texto factual
// rastreável (SEO/GEO), denso em palavras-chave de intenção — sem inventar nada.
const lede = computed(
  () =>
    `Análise pré-jogo de ${homeName.value} x ${awayName.value}: probabilidades e favorito, forma recente, retrospecto do confronto direto, classificação e artilheiros — tudo para você cravar o placar do palpite com mais embasamento.`,
);

// Fechamento → rampa pro palpite. O board deriva a aba ativa da URL (segmento
// [[aba]]); se o usuário está em outra aba, o stepper está escondido (v-show) —
// então primeiro voltamos pra aba "Bolão" (remove o segmento) e só depois rolamos
// até o stepper, posicionado logo abaixo do cabeçalho fixo (placar+abas).
async function scrollToPalpite() {
  if (!import.meta.client) return;
  // Garante a aba "Bolão" ativa (onde mora o stepper de palpite).
  const aba = route.params.aba as string | undefined;
  if (aba) {
    const base = route.path.replace(/\/$/, '').slice(0, -(aba.length + 1));
    await router.replace(base);
    await nextTick();
  }
  const el = document.querySelector('.mypred') as HTMLElement | null;
  if (el && el.offsetParent !== null) {
    const sticky = document.querySelector('.msticky') as HTMLElement | null;
    const offset = (sticky?.offsetHeight ?? 0) + 12;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  } else {
    // sem stepper (jogo fechado) → topo do board, já na aba Bolão.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
// Grupo de letra única ("C", "J") vira "Grupo C"; nome de liga ("Série A") fica como está.
const tableLabel = computed(() => {
  const g = preview.value?.standings?.groupName ?? '';
  return /^[A-Z]$/i.test(g) ? `Grupo ${g.toUpperCase()}` : g;
});

// Data curta (dd/mm/aa) no fuso de Brasília — usada nas listas de jogos.
function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: DEFAULT_TZ,
  }).format(new Date(iso));
}
// % no formato pt-BR, sem ".0" supérfluo (83.7→"83,7%", 5→"5%").
function fmtPct(n: number): string {
  return `${(Math.round(n * 10) / 10).toString().replace('.', ',')}%`;
}
const favoriteName = computed(() => {
  const p = preview.value?.probability;
  if (!p) return '';
  return p.favorite === 'home' ? homeName.value : p.favorite === 'away' ? awayName.value : 'Empate';
});
function resultLabel(r: 'W' | 'D' | 'L'): string {
  return r === 'W' ? 'V' : r === 'D' ? 'E' : 'D';
}
function resultWord(r: 'W' | 'D' | 'L'): string {
  return r === 'W' ? 'Vitória' : r === 'D' ? 'Empate' : 'Derrota';
}
</script>

<template>
  <section v-if="show && preview" class="preview">
    <div class="pv-in">
      <header class="pv-head">
        <span class="pv-kicker"><AppIcon name="ball" :size="13" :stroke="2" /> Antes da bola rolar</span>
        <h2 class="pv-title">Prévia de {{ homeName }} x {{ awayName }}</h2>
        <p class="pv-lede">{{ lede }}</p>
      </header>

      <!-- PROBABILIDADE — favorito do mercado (odds da ESPN, de-vigadas) -->
      <div v-if="preview.probability" class="pv-block">
        <h3 class="pv-bt">
          Quem é o favorito em {{ homeName }} x {{ awayName }}?
          <InfoTip text="Chance de cada resultado segundo as odds do mercado (casas de apostas), já descontada a margem. É uma estimativa do mercado — não uma garantia." />
        </h3>
        <div class="prob">
          <div class="prob-head">
            <span class="prob-side home" :class="{ fav: preview.probability.favorite === 'home' }">
              <span class="ps-name">{{ homeName }}</span>
              <b class="ps-pct font-numeric">{{ fmtPct(preview.probability.home) }}</b>
            </span>
            <span class="prob-side draw" :class="{ fav: preview.probability.favorite === 'draw' }">
              <span class="ps-name">Empate</span>
              <b class="ps-pct font-numeric">{{ fmtPct(preview.probability.draw) }}</b>
            </span>
            <span class="prob-side away" :class="{ fav: preview.probability.favorite === 'away' }">
              <span class="ps-name">{{ awayName }}</span>
              <b class="ps-pct font-numeric">{{ fmtPct(preview.probability.away) }}</b>
            </span>
          </div>
          <div class="prob-bar">
            <span class="seg home" :style="{ width: preview.probability.home + '%' }" />
            <span class="seg draw" :style="{ width: preview.probability.draw + '%' }" />
            <span class="seg away" :style="{ width: preview.probability.away + '%' }" />
          </div>
          <p class="prob-foot">
            Favorito: <b>{{ favoriteName }}</b>
            <span class="prob-src">· segundo as odds do mercado</span>
          </p>
        </div>
      </div>

      <!-- O QUE ESTÁ EM JOGO — posição na tabela do grupo -->
      <div v-if="preview.standings && (preview.standings.home || preview.standings.away)" class="pv-block">
        <h3 class="pv-bt">
          Classificação · {{ tableLabel }}
          <InfoTip text="Como cada time está no grupo antes desta partida. pts = pontos, j = jogos disputados, e o número final é o saldo de gols (gols marcados menos sofridos)." />
        </h3>
        <div class="tbl">
          <div
            v-for="row in [
              { side: 'home', team: preview.home, r: preview.standings.home },
              { side: 'away', team: preview.away, r: preview.standings.away },
            ].filter((x) => x.r && x.team)"
            :key="row.side"
            class="tbl-row"
          >
            <span class="tbl-pos font-numeric">{{ row.r!.position }}º</span>
            <span class="crest sm">
              <img v-if="row.team!.logoUrl" :src="row.team!.logoUrl" :alt="row.team!.name" >
              <span v-else>{{ row.team!.shortName }}</span>
            </span>
            <span class="tbl-name">{{ row.team!.name }}</span>
            <span class="tbl-stat"><b class="font-numeric">{{ row.r!.points }}</b> pts</span>
            <span class="tbl-stat sub">{{ row.r!.played }}j</span>
            <span class="tbl-stat sub">{{ row.r!.goalDiff > 0 ? '+' : '' }}{{ row.r!.goalDiff }}</span>
          </div>
        </div>
      </div>

      <!-- FORMA RECENTE — últimos jogos de cada time -->
      <div v-if="preview.form && (preview.form.home.matches.length || preview.form.away.matches.length)" class="pv-block">
        <h3 class="pv-bt">
          Forma recente de {{ homeName }} e {{ awayName }}
          <InfoTip text="Como cada time vem jogando: seus últimos jogos. Os quadradinhos mostram a sequência da esquerda (mais antigo) para a direita (mais recente). V = vitória (verde), E = empate (cinza), D = derrota (vermelho). Na lista, o placar mostra os gols do próprio time primeiro." />
        </h3>
        <div class="forms">
          <div
            v-for="col in [
              { team: preview.home, f: preview.form.home },
              { team: preview.away, f: preview.form.away },
            ]"
            :key="col.team?.id"
            class="form-col"
          >
            <div class="form-team">
              <span class="crest sm">
                <img v-if="col.team?.logoUrl" :src="col.team.logoUrl" :alt="col.team.name" >
                <span v-else>{{ col.team?.shortName }}</span>
              </span>
              <span class="form-name">{{ col.team?.name }}</span>
              <span v-if="col.f.matches.length" class="form-tally">
                {{ col.f.summary.w }}V · {{ col.f.summary.d }}E · {{ col.f.summary.l }}D
              </span>
            </div>
            <div v-if="col.f.matches.length" class="chips">
              <!-- mais antigo → mais recente (matches vem recente-primeiro) -->
              <span
                v-for="(m, i) in [...col.f.matches].reverse()"
                :key="i"
                class="chip"
                :class="m.result.toLowerCase()"
                :title="`${resultWord(m.result)} ${m.home ? 'em casa contra' : 'fora contra'} ${m.opponent?.name ?? ''}: ${m.goalsFor} a ${m.goalsAgainst}`"
              >{{ resultLabel(m.result) }}</span>
            </div>
            <ul v-if="col.f.matches.length" class="form-list">
              <li v-for="(m, i) in col.f.matches" :key="i">
                <span class="fl-res" :class="m.result.toLowerCase()">{{ resultLabel(m.result) }}</span>
                <span class="fl-crest crest xs">
                  <img v-if="m.opponent?.logoUrl" :src="m.opponent.logoUrl" :alt="m.opponent?.name ?? ''" >
                  <span v-else>{{ m.opponent?.shortName ?? '—' }}</span>
                </span>
                <span class="fl-opp">
                  <span class="fl-opp-name">{{ m.opponent?.name ?? '—' }}</span>
                  <span class="fl-loc">{{ m.home ? 'em casa' : 'fora' }}</span>
                </span>
                <span class="fl-score font-numeric">{{ m.goalsFor }}<i>–</i>{{ m.goalsAgainst }}</span>
                <span class="fl-date">{{ shortDate(m.kickoffAt) }}</span>
              </li>
            </ul>
            <p v-else class="pv-empty">Sem jogos recentes.</p>
          </div>
        </div>
      </div>

      <!-- RETROSPECTO — confrontos diretos -->
      <div v-if="preview.h2h && preview.h2h.total" class="pv-block">
        <h3 class="pv-bt">
          Retrospecto e confronto direto · {{ preview.h2h.total }} jogo{{ preview.h2h.total > 1 ? 's' : '' }}
          <InfoTip text="Histórico dos confrontos diretos entre os dois times: quantas vezes cada um venceu e quantos empates, com os jogos mais recentes listados abaixo." />
        </h3>
        <div class="tape">
          <div class="tape-side">
            <b class="font-numeric">{{ preview.h2h.homeWins }}</b>
            <span>{{ homeName }}</span>
          </div>
          <div class="tape-mid">
            <b class="font-numeric">{{ preview.h2h.draws }}</b>
            <span>empate{{ preview.h2h.draws === 1 ? '' : 's' }}</span>
          </div>
          <div class="tape-side right">
            <b class="font-numeric">{{ preview.h2h.awayWins }}</b>
            <span>{{ awayName }}</span>
          </div>
        </div>
        <ul v-if="preview.h2h.meetings.length" class="h2h-list">
          <li v-for="m in preview.h2h.meetings" :key="m.matchId">
            <span class="h-date">{{ shortDate(m.kickoffAt) }}</span>
            <span class="h-team">{{ m.homeTeam?.shortName ?? '—' }}</span>
            <span class="h-score font-numeric">{{ m.homeScore }}<i>×</i>{{ m.awayScore }}</span>
            <span class="h-team right">{{ m.awayTeam?.shortName ?? '—' }}</span>
          </li>
        </ul>
      </div>

      <!-- ARTILHEIROS — da competição, por time -->
      <div v-if="preview.scorers && (preview.scorers.home.length || preview.scorers.away.length)" class="pv-block">
        <h3 class="pv-bt">
          Artilheiros{{ preview.scorers.competition ? ' · ' + preview.scorers.competition : '' }}
          <InfoTip text="Os jogadores que mais marcaram gols em cada time nesta competição até aqui. O número ao lado é o total de gols." />
        </h3>
        <div class="scorers">
          <div
            v-for="col in [
              { team: preview.home, list: preview.scorers.home },
              { team: preview.away, list: preview.scorers.away },
            ]"
            :key="col.team?.id"
            class="sc-col"
          >
            <div class="form-team">
              <span class="crest sm">
                <img v-if="col.team?.logoUrl" :src="col.team.logoUrl" :alt="col.team.name" >
                <span v-else>{{ col.team?.shortName }}</span>
              </span>
              <span class="form-name">{{ col.team?.name }}</span>
            </div>
            <ul v-if="col.list.length" class="sc-list">
              <li v-for="s in col.list" :key="s.player.id">
                <span class="sc-av">
                  <img v-if="s.player.photoUrl" :src="s.player.photoUrl" :alt="s.player.name" >
                </span>
                <span class="sc-name">{{ s.player.name }}</span>
                <span class="sc-goals font-numeric">{{ s.goals }}<i>⚽</i></span>
              </li>
            </ul>
            <p v-else class="pv-empty">Sem gols ainda.</p>
          </div>
        </div>
      </div>

      <!-- FECHAMENTO — converte a confiança da prévia em palpite. Adapta ao login;
           não duplica o stepper do board (rola até ele) nem o banner da seção SEO. -->
      <div class="pv-cta">
        <template v-if="!auth.isAuthenticated">
          <p class="pv-cta-lead">Confiante no palpite? Crie sua conta e crave o placar de <b>{{ homeName }}</b> x <b>{{ awayName }}</b>.</p>
          <NuxtLink :to="authLink('/cadastro')" class="btn btn-gold pv-cta-btn">Criar conta grátis</NuxtLink>
        </template>
        <template v-else>
          <p class="pv-cta-lead">Agora é com você. Crave o placar de <b>{{ homeName }}</b> x <b>{{ awayName }}</b> com mais embasamento.</p>
          <button type="button" class="btn btn-gold pv-cta-btn" @click="scrollToPalpite">Fazer meu palpite</button>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.preview { border-top: 1px solid var(--border); background: var(--bg-surface); padding: 24px 16px 8px; }
.pv-in { max-width: 720px; margin: 0 auto; }
.pv-head { margin-bottom: 18px; }
.pv-kicker {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--emerald);
}
.pv-kicker :deep(svg) { color: var(--emerald); }
.pv-title {
  font-family: 'Oswald', sans-serif; font-weight: 700; font-size: clamp(19px, 4vw, 24px);
  text-transform: uppercase; letter-spacing: 0.01em; margin: 4px 0 0;
}
.pv-lede { margin: 8px 0 0; font-size: 14.5px; line-height: 1.6; color: var(--muted); max-width: 60ch; }
.pv-block { margin-bottom: 22px; }
.pv-bt {
  display: flex; align-items: center; gap: 6px;
  font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 13.5px;
  text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 0 0 11px;
}
.pv-empty { font-size: 12.5px; color: var(--muted); margin: 8px 0 0; }

/* Crest reutilizável (logo ou sigla) */
.crest { display: inline-grid; place-items: center; flex: none; overflow: hidden; }
.crest.sm { width: 22px; height: 22px; }
.crest.xs { width: 18px; height: 18px; }
.crest img { width: 100%; height: 100%; object-fit: contain; }
.crest span { font-size: 9px; font-weight: 800; color: var(--muted); }

/* Probabilidade (favorito do mercado) */
.prob { background: var(--bg-base); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; }
.prob-head { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; margin-bottom: 10px; }
.prob-side { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.prob-side.home { align-items: flex-start; text-align: left; }
.prob-side.draw { align-items: center; text-align: center; }
.prob-side.away { align-items: flex-end; text-align: right; }
.ps-name { font-size: 12px; font-weight: 700; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.ps-pct { font-size: 19px; line-height: 1; color: var(--text); }
.prob-side.home.fav .ps-pct { color: var(--emerald); }
.prob-side.away.fav .ps-pct { color: var(--azure); }
.prob-side.draw.fav .ps-pct { color: var(--text); }
.prob-side.fav .ps-name { color: var(--text); }
.prob-bar { display: flex; height: 10px; border-radius: 999px; overflow: hidden; background: var(--border); }
.prob-bar .seg { height: 100%; }
.prob-bar .seg.home { background: var(--emerald); }
.prob-bar .seg.draw { background: color-mix(in srgb, var(--muted) 55%, var(--border)); }
.prob-bar .seg.away { background: var(--azure); }
.prob-foot { margin: 10px 0 0; font-size: 12px; color: var(--muted); }
.prob-foot b { color: var(--text); font-weight: 800; }
.prob-src { opacity: 0.85; }

/* Tabela (o que está em jogo) */
.tbl { display: flex; flex-direction: column; gap: 7px; }
.tbl-row {
  display: flex; align-items: center; gap: 9px;
  background: var(--bg-base); border: 1px solid var(--border); border-radius: 12px; padding: 9px 12px;
}
.tbl-pos { font-size: 15px; font-weight: 800; color: var(--gold); flex: none; min-width: 26px; }
.tbl-name { font-size: 13.5px; font-weight: 700; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tbl-stat { font-size: 12px; color: var(--muted); flex: none; }
.tbl-stat b { font-size: 14px; color: var(--text); }
.tbl-stat.sub { font-size: 11.5px; opacity: 0.85; }

/* Forma recente */
.forms, .scorers { display: grid; grid-template-columns: 1fr; gap: 12px; }
@media (min-width: 560px) { .forms, .scorers { grid-template-columns: 1fr 1fr; } }
.form-col, .sc-col { background: var(--bg-base); border: 1px solid var(--border); border-radius: 14px; padding: 13px; }
.form-team { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.form-name { font-size: 13.5px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.form-tally { margin-left: auto; flex: none; font-size: 11px; font-weight: 700; color: var(--muted); letter-spacing: 0.02em; }
.chips { display: flex; gap: 5px; margin-bottom: 11px; }
.chip {
  width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center;
  font-size: 11px; font-weight: 800; color: #fff;
}
.chip.w { background: var(--emerald); }
.chip.d { background: color-mix(in srgb, var(--muted) 65%, var(--border)); }
.chip.l { background: var(--scarlet); }
.form-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.form-list li { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
.fl-res { width: 18px; height: 18px; border-radius: 5px; display: grid; place-items: center; font-size: 10px; font-weight: 800; color: #fff; flex: none; }
.fl-res.w { background: var(--emerald); }
.fl-res.d { background: color-mix(in srgb, var(--muted) 65%, var(--border)); }
.fl-res.l { background: var(--scarlet); }
.fl-crest { flex: none; }
.fl-opp { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.fl-opp-name { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fl-loc { font-size: 10.5px; font-weight: 600; color: var(--muted); }
.fl-score { font-weight: 800; flex: none; font-size: 13px; }
.fl-score i { color: var(--muted); font-style: normal; margin: 0 1px; }
.fl-date { font-size: 11px; color: var(--muted); flex: none; min-width: 46px; text-align: right; }

/* Retrospecto (tale of the tape) */
.tape {
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--emerald) 9%, var(--bg-base)), color-mix(in srgb, var(--azure) 8%, var(--bg-base)));
  border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; margin-bottom: 10px;
}
.tape-side, .tape-mid { display: flex; flex-direction: column; align-items: center; min-width: 0; text-align: center; }
.tape-side b { font-size: 28px; line-height: 1; color: var(--emerald); }
.tape-side.right b { color: var(--azure); }
.tape-mid b { font-size: 22px; line-height: 1; color: var(--muted); }
.tape-side span, .tape-mid span { font-size: 11.5px; font-weight: 700; color: var(--muted); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.h2h-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.h2h-list li { display: grid; grid-template-columns: 52px 1fr auto 1fr; align-items: center; gap: 8px; font-size: 12.5px; padding: 6px 10px; background: var(--bg-base); border: 1px solid var(--border); border-radius: 10px; }
.h-date { font-size: 11px; color: var(--muted); }
.h-team { font-weight: 700; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.h-team.right { text-align: left; }
.h-score { font-weight: 800; }
.h-score i { color: var(--muted); font-style: normal; margin: 0 4px; }

/* Artilheiros */
.sc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.sc-list li { display: flex; align-items: center; gap: 9px; font-size: 13px; }
.sc-av { width: 26px; height: 26px; border-radius: 50%; overflow: hidden; flex: none; background: var(--bg-surface); border: 1px solid var(--border); display: grid; place-items: center; }
.sc-av img { width: 100%; height: 100%; object-fit: cover; }
.sc-name { font-weight: 700; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc-goals { font-weight: 800; flex: none; }
.sc-goals i { font-style: normal; font-size: 11px; margin-left: 3px; }

/* Fechamento (rampa pro palpite) */
.pv-cta {
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px;
  margin-top: 6px; padding: 20px 18px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 11%, var(--bg-base)), var(--bg-base));
  border: 1px solid color-mix(in srgb, var(--gold) 26%, var(--border)); border-radius: 16px;
}
.pv-cta-lead { margin: 0; font-size: 14.5px; line-height: 1.5; font-weight: 600; color: var(--text); max-width: 44ch; }
.pv-cta-lead b { font-weight: 800; }
.pv-cta-btn { min-width: 220px; }
</style>
