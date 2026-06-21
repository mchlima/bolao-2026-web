<script setup lang="ts">
import type { TermSeoForm } from '~/utils/termSeo';
// Editor manual de SEO/GEO da página de um termo (categoria/tag). Diferente do
// conteúdo, NADA aqui é gerado por modelo — é o admin afinando o hub para rankear
// no Google e ser citado por buscadores de IA (GEO). Muta `model` por referência.

const props = defineProps<{
  model: TermSeoForm;
  name: string; // nome do termo (fallback de título/H1 na prévia)
  kind: 'categoria' | 'assunto';
}>();

const siteUrl = String(useRuntimeConfig().public.siteUrl).replace(/^https?:\/\//, '');
const base = computed(() => (props.kind === 'categoria' ? 'categorias' : 'assuntos'));

function lenClass(len: number, min: number, max: number) {
  if (!len) return 'cc-muted';
  return len < min || len > max ? 'cc-warn' : 'cc-ok';
}
function addFaq() {
  props.model.faq.push({ question: '', answer: '' });
}
function removeFaq(i: number) {
  props.model.faq.splice(i, 1);
}
</script>

<template>
  <div class="tseo">
    <p class="tseo-hint">
      Metadados de SEO/GEO desta página (preenchimento manual). O título e a descrição vão para o
      Google; a introdução e as perguntas dão lastro para buscadores de IA citarem o hub. Vazio cai
      no padrão (nome e descrição).
    </p>

    <!-- Prévia de resultado no Google -->
    <div class="serp">
      <div class="serp-url">{{ siteUrl }} › notícias › {{ base }}</div>
      <div class="serp-title">{{ model.metaTitle || `${name} — Notícias | Cravei` }}</div>
      <div class="serp-desc">{{ model.metaDescription || model.intro || '—' }}</div>
    </div>

    <div class="tseo-grid">
      <label class="fld full">
        <span class="fl">Meta título <em :class="lenClass(model.metaTitle.length, 30, 60)">{{ model.metaTitle.length }}/60</em></span>
        <input v-model="model.metaTitle" class="input" maxlength="90" :placeholder="`${name} — Notícias | Cravei`" />
      </label>
      <label class="fld full">
        <span class="fl">Meta descrição <em :class="lenClass(model.metaDescription.length, 120, 155)">{{ model.metaDescription.length }}/155</em></span>
        <textarea v-model="model.metaDescription" class="input area" rows="2" maxlength="220" />
      </label>
      <label class="fld full">
        <span class="fl">Título visível (H1) <span class="opt">opcional — default: {{ name }}</span></span>
        <input v-model="model.heading" class="input" :placeholder="name" />
      </label>
      <label class="fld full">
        <span class="fl">Introdução <span class="opt">resposta direta exibida no topo (GEO)</span></span>
        <textarea v-model="model.intro" class="input area" rows="3" maxlength="2000" />
      </label>
    </div>

    <div class="faq-block">
      <div class="faq-head">
        <span class="fl">Perguntas frequentes <span class="opt">aparecem na página + FAQPage (Google/IA)</span></span>
        <button type="button" class="btn btn-sm" @click="addFaq">
          <AppIcon name="plus" :size="13" :stroke="2.4" /> Pergunta
        </button>
      </div>
      <p v-if="!model.faq.length" class="faq-empty">Nenhuma pergunta. Opcional, mas ajuda a ser citado por buscadores de IA.</p>
      <div v-for="(q, i) in model.faq" :key="i" class="faq-row">
        <div class="faq-fields">
          <input v-model="q.question" class="input" placeholder="Pergunta (ex.: Quando é a final?)" />
          <textarea v-model="q.answer" class="input area" rows="2" placeholder="Resposta objetiva" />
        </div>
        <button type="button" class="faq-del" title="Remover" @click="removeFaq(i)">
          <AppIcon name="trash" :size="15" :stroke="2.2" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tseo { display: flex; flex-direction: column; gap: 14px; }
.tseo-hint { font-size: 12px; color: var(--muted); margin: 0; line-height: 1.5; }
.serp { background: var(--bg-base); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; }
.serp-url { font-size: 12px; color: var(--muted); }
.serp-title { font-size: 16px; color: #1a0dab; font-weight: 600; line-height: 1.3; margin-top: 2px; }
[data-theme='dark'] .serp-title { color: #8ab4f8; }
.serp-desc { font-size: 12.5px; color: var(--muted); margin-top: 2px; line-height: 1.4; }
.tseo-grid { display: flex; flex-direction: column; gap: 10px; }
.fld { display: flex; flex-direction: column; gap: 5px; }
.fl { font-size: 12px; font-weight: 700; color: var(--muted); }
.fl .opt { font-weight: 600; opacity: 0.7; }
.fl em { font-style: normal; font-weight: 700; margin-left: 4px; }
.cc-muted { color: var(--muted); opacity: 0.6; }
.cc-ok { color: var(--emerald); }
.cc-warn { color: var(--amber, #d97706); }
.area { resize: vertical; }
.faq-block { display: flex; flex-direction: column; gap: 8px; }
.faq-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.faq-empty { font-size: 12px; color: var(--muted); margin: 0; }
.faq-row { display: flex; gap: 8px; align-items: flex-start; }
.faq-fields { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.faq-del { flex-shrink: 0; width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--danger, #dc2626); cursor: pointer; }
.faq-del:hover { background: var(--bg-base); }
</style>
