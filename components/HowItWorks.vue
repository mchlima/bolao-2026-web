<script setup lang="ts">
// Bloco "Como funciona" reutilizável — cabeçalho clicável (expandir/recolher,
// persistido no navegador via storageKey), intro, passos em timeline vertical
// ilustrada e um exemplo "na prática". 1ª vez expandido. Os textos são estáticos
// e confiáveis (v-html só pra realçar termos com <strong>).
interface Step {
  n: number;
  icon: string;
  color: string; // ex.: 'var(--azure)'
  title: string;
  desc: string; // pode conter <strong>
  ex?: string;
  tag?: string; // chip à direita do título (ex.: "25 pts")
}
const props = defineProps<{
  title: string;
  storageKey: string;
  lead?: string; // pode conter <strong>
  steps: Step[];
  example?: string; // pode conter <strong>/<b>
}>();

const open = ref(true);
onMounted(() => {
  const saved = localStorage.getItem(props.storageKey);
  if (saved !== null) open.value = saved === '1';
});
function toggle() {
  open.value = !open.value;
  localStorage.setItem(props.storageKey, open.value ? '1' : '0');
}
</script>

<template>
  <section class="howto" :class="{ closed: !open }">
    <button class="howto-toggle" :aria-expanded="open" @click="toggle">
      <span class="howto-q"><AppIcon name="display" :size="17" :stroke="2" /></span>
      <h2 class="howto-title font-display">{{ title }}</h2>
      <AppIcon name="chevronDown" :size="20" :stroke="2.4" class="howto-chev" :class="{ on: open }" />
    </button>

    <div v-show="open" class="howto-body">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <p v-if="lead" class="howto-lead" v-html="lead" />

      <ol class="steps">
        <li v-for="s in steps" :key="s.n" class="step" :style="{ '--c': s.color }">
          <span class="step-node"><span class="step-n">{{ s.n }}</span><AppIcon :name="s.icon" :size="18" :stroke="2.2" /></span>
          <div class="step-tx">
            <div class="step-h">
              <b>{{ s.title }}</b>
              <span v-if="s.tag" class="step-tag">{{ s.tag }}</span>
            </div>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <p v-html="s.desc" />
            <span v-if="s.ex" class="step-ex">{{ s.ex }}</span>
          </div>
        </li>
      </ol>

      <aside v-if="example" class="howto-ex">
        <span class="hx-ic"><AppIcon name="star" :size="16" :stroke="2" /></span>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <p v-html="example" />
      </aside>
    </div>
  </section>
</template>

<style scoped>
.howto {
  margin-bottom: 18px;
  padding: 18px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
}
.howto-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  color: var(--text);
  text-align: left;
}
.howto-q {
  flex: none;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: color-mix(in srgb, var(--azure) 14%, transparent);
  color: var(--azure);
}
.howto-title {
  flex: 1;
  min-width: 0;
  font-size: clamp(1rem, 4vw, 1.25rem);
  font-weight: 700;
  text-transform: uppercase;
  margin: 0;
}
.howto-chev {
  flex: none;
  color: var(--muted);
  transition: transform 0.16s;
}
.howto-chev.on {
  transform: rotate(180deg);
}
.howto-body {
  margin-top: 14px;
}
.howto-lead {
  margin: 0 0 14px;
  font-size: var(--fs-sm);
  line-height: 1.6;
  color: var(--muted);
}
.howto-lead :deep(strong) {
  color: var(--text);
  font-weight: 700;
}
/* Timeline vertical — limpa em qualquer largura. */
.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.step {
  position: relative;
  display: flex;
  gap: 13px;
  padding-bottom: 16px;
}
.step:last-child {
  padding-bottom: 0;
}
.step:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 18px;
  top: 40px;
  bottom: 2px;
  width: 2px;
  background: var(--border);
}
.step-node {
  position: relative;
  flex: none;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--c, var(--azure)) 15%, var(--bg-surface));
  border: 1px solid color-mix(in srgb, var(--c, var(--azure)) 45%, var(--border));
  color: var(--c, var(--azure));
}
.step-n {
  position: absolute;
  top: -6px;
  left: -6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-family: 'Oswald', sans-serif;
  font-size: var(--fs-xs);
  font-weight: 800;
  color: #fff;
  background: var(--c, var(--azure));
}
.step-tx {
  min-width: 0;
  padding-top: 2px;
}
.step-h {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.step-h b {
  font-size: var(--fs-sm);
  font-weight: 700;
  line-height: 1.25;
}
.step-tag {
  flex: none;
  font-size: var(--fs-xs);
  font-weight: 800;
  color: var(--c, var(--azure));
  background: color-mix(in srgb, var(--c, var(--azure)) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--c, var(--azure)) 35%, transparent);
  border-radius: 999px;
  padding: 2px 9px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.step-tx p {
  margin: 4px 0 0;
  font-size: var(--fs-xs);
  line-height: 1.5;
  color: var(--muted);
}
.step-tx :deep(strong) {
  color: var(--text);
  font-weight: 700;
}
.step-ex {
  display: block;
  margin-top: 6px;
  font-size: var(--fs-xs);
  font-style: italic;
  color: color-mix(in srgb, var(--c, var(--azure)) 75%, var(--muted));
}
.howto-ex {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 13px;
  border: 1px solid color-mix(in srgb, var(--gold) 32%, var(--border));
  background: color-mix(in srgb, var(--gold) 8%, var(--bg-surface));
}
.hx-ic {
  flex: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--gold) 18%, transparent);
  color: var(--gold);
}
.howto-ex p {
  margin: 0;
  font-size: var(--fs-sm);
  line-height: 1.55;
  color: var(--text);
}
.howto-ex :deep(strong) {
  font-weight: 700;
}
</style>
