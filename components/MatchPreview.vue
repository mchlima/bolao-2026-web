<script setup lang="ts">
import type { MatchPreview, PreviewTeamRef } from '~/types/api';

// Prévia de um jogo AGENDADO: forma recente, retrospecto (H2H), o que está em
// jogo (tabela do grupo) e artilheiros da competição. Tudo determinístico, do
// nosso banco (GET /matches/:id/preview). Renderizada SSR pelo MatchRankingView
// só enquanto a partida não começou. Cada bloco some quando não há dado.
const props = defineProps<{ matchId: string }>();

const api = useApi();
const { data: preview } = await useAsyncData(`preview-${props.matchId}`, () =>
  api<MatchPreview>(`/matches/${props.matchId}/preview`),
);

const show = computed(() => !!preview.value?.available);
const homeName = computed(() => preview.value?.home?.name ?? '');
const awayName = computed(() => preview.value?.away?.name ?? '');

// Data curta (dd/mm/aa) no fuso de Brasília — usada nas listas de jogos.
function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: DEFAULT_TZ,
  }).format(new Date(iso));
}
function resultLabel(r: 'W' | 'D' | 'L'): string {
  return r === 'W' ? 'V' : r === 'D' ? 'E' : 'D';
}
</script>

<template>
  <section v-if="show && preview" class="preview">
    <div class="pv-in">
      <header class="pv-head">
        <span class="pv-kicker"><AppIcon name="ball" :size="13" :stroke="2" /> Prévia</span>
        <h2 class="pv-title">Antes da bola rolar</h2>
      </header>

      <!-- O QUE ESTÁ EM JOGO — posição na tabela do grupo -->
      <div v-if="preview.standings && (preview.standings.home || preview.standings.away)" class="pv-block">
        <h3 class="pv-bt">Na tabela · {{ preview.standings.groupName }}</h3>
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
        <h3 class="pv-bt">Forma recente</h3>
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
            </div>
            <div v-if="col.f.matches.length" class="chips">
              <!-- mais antigo → mais recente (matches vem recente-primeiro) -->
              <span
                v-for="(m, i) in [...col.f.matches].reverse()"
                :key="i"
                class="chip"
                :class="m.result.toLowerCase()"
                :title="`${m.home ? 'casa' : 'fora'} · ${m.goalsFor}-${m.goalsAgainst}${m.opponent ? ' vs ' + m.opponent.name : ''}`"
              >{{ resultLabel(m.result) }}</span>
            </div>
            <ul v-if="col.f.matches.length" class="form-list">
              <li v-for="(m, i) in col.f.matches" :key="i">
                <span class="fl-res" :class="m.result.toLowerCase()">{{ resultLabel(m.result) }}</span>
                <span class="fl-opp">{{ m.home ? '' : '@' }}{{ m.opponent?.shortName ?? '—' }}</span>
                <span class="fl-score font-numeric">{{ m.goalsFor }}-{{ m.goalsAgainst }}</span>
                <span class="fl-date">{{ shortDate(m.kickoffAt) }}</span>
              </li>
            </ul>
            <p v-else class="pv-empty">Sem jogos recentes.</p>
          </div>
        </div>
      </div>

      <!-- RETROSPECTO — confrontos diretos -->
      <div v-if="preview.h2h && preview.h2h.total" class="pv-block">
        <h3 class="pv-bt">Retrospecto · {{ preview.h2h.total }} jogo{{ preview.h2h.total > 1 ? 's' : '' }}</h3>
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
        <h3 class="pv-bt">Artilheiros{{ preview.scorers.competition ? ' · ' + preview.scorers.competition : '' }}</h3>
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
.pv-block { margin-bottom: 22px; }
.pv-bt {
  font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 13.5px;
  text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 0 0 11px;
}
.pv-empty { font-size: 12.5px; color: var(--muted); margin: 8px 0 0; }

/* Crest reutilizável (logo ou sigla) */
.crest { display: inline-grid; place-items: center; flex: none; overflow: hidden; }
.crest.sm { width: 22px; height: 22px; }
.crest img { width: 100%; height: 100%; object-fit: contain; }
.crest span { font-size: 9px; font-weight: 800; color: var(--muted); }

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
.chips { display: flex; gap: 5px; margin-bottom: 11px; }
.chip {
  width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center;
  font-size: 11px; font-weight: 800; color: #fff;
}
.chip.w { background: var(--emerald); }
.chip.d { background: color-mix(in srgb, var(--muted) 65%, var(--border)); }
.chip.l { background: var(--scarlet); }
.form-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.form-list li { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
.fl-res { width: 16px; height: 16px; border-radius: 4px; display: grid; place-items: center; font-size: 9.5px; font-weight: 800; color: #fff; flex: none; }
.fl-res.w { background: var(--emerald); }
.fl-res.d { background: color-mix(in srgb, var(--muted) 65%, var(--border)); }
.fl-res.l { background: var(--scarlet); }
.fl-opp { font-weight: 700; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fl-score { font-weight: 800; flex: none; }
.fl-date { font-size: 11px; color: var(--muted); flex: none; }

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
</style>
