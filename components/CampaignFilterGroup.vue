<script setup lang="ts">
import type { AudienceCondition, AudienceGroup, AudienceNode } from '~/types/api';
import { isAudienceGroup, keyOf, newCondition, newGroup } from '~/utils/audience';

// Recursive boolean group (E/OU) with nested groups + conditions. Mutates the
// node in place; the wizard owns the root tree. `depth` drives the nesting cue
// (accent colour + inset) so it's clear what lives inside what.
const props = withDefaults(defineProps<{ node: AudienceGroup; depth?: number }>(), { depth: 0 });
const emit = defineEmits<{ remove: [] }>();

const ACCENTS = ['--gold', '--azure', '--emerald', '--magenta'];
const accent = computed(() => `var(${ACCENTS[props.depth % ACCENTS.length]})`);

function addCondition(): void {
  props.node.children.push(newCondition());
}
function addGroup(): void {
  props.node.children.push(newGroup(props.node.op === 'and' ? 'or' : 'and'));
}
function removeChild(i: number): void {
  props.node.children.splice(i, 1);
}
const asGroup = (n: AudienceNode) => n as AudienceGroup;
const asCond = (n: AudienceNode) => n as AudienceCondition;
</script>

<template>
  <div class="grp" :class="{ root: depth === 0, nested: depth > 0 }" :style="{ '--accent': accent }">
    <div class="grp-head">
      <div class="combo">
        <span class="combo-lead">Recebe quem atende a</span>
        <div class="seg">
          <button type="button" class="seg-btn" :class="{ on: node.op === 'and' }" @click="node.op = 'and'">TODAS</button>
          <button type="button" class="seg-btn" :class="{ on: node.op === 'or' }" @click="node.op = 'or'">QUALQUER</button>
        </div>
        <span class="combo-lead">das condições</span>
      </div>
      <button v-if="depth > 0" type="button" class="grp-remove" @click="emit('remove')">
        <AppIcon name="trash" :size="13" :stroke="2" /> remover grupo
      </button>
    </div>

    <div class="grp-body">
      <template v-for="(child, i) in node.children" :key="keyOf(child)">
        <div v-if="i > 0" class="op-divider"><span>{{ node.op === 'and' ? 'E' : 'OU' }}</span></div>
        <div class="node" :class="{ 'is-cond': !isAudienceGroup(child) }">
          <CampaignFilterGroup
            v-if="isAudienceGroup(child)"
            :node="asGroup(child)"
            :depth="depth + 1"
            @remove="removeChild(i)"
          />
          <CampaignFilterCondition v-else :node="asCond(child)" @remove="removeChild(i)" />
        </div>
      </template>
      <p v-if="!node.children.length" class="grp-empty">Nenhuma condição ainda — adicione abaixo.</p>
    </div>

    <div class="grp-actions">
      <button type="button" class="addbtn primary" @click="addCondition">
        <AppIcon name="plus" :size="13" :stroke="2.6" /> condição
      </button>
      <button type="button" class="addbtn" @click="addGroup">
        <AppIcon name="plus" :size="13" :stroke="2.6" /> subgrupo
      </button>
    </div>
  </div>
</template>

<style scoped>
.grp {
  border-radius: 14px;
  padding: 16px;
}
.grp.root {
  border: 1px dashed var(--border);
  background: var(--bg-base);
}
/* nested group: a card inset with a coloured left rail → clearly "inside" */
.grp.nested {
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 5%, var(--bg-surface));
}

.grp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.combo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.combo-lead {
  font-size: var(--fs-sm);
  color: var(--muted);
  font-weight: 600;
}
.seg {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-base);
}
.seg-btn {
  padding: 4px 12px;
  border: none;
  border-radius: 999px;
  background: none;
  color: var(--muted);
  font-weight: 800;
  font-size: var(--fs-xs);
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: color 0.12s, background 0.12s;
}
.seg-btn.on {
  color: #0a0e14;
  background: var(--accent);
}
.grp-remove {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-base);
  color: var(--muted);
  font-size: var(--fs-xs);
  font-weight: 700;
  cursor: pointer;
}
.grp-remove:hover {
  color: var(--scarlet);
  border-color: color-mix(in srgb, var(--scarlet) 40%, var(--border));
}

.grp-body {
  display: flex;
  flex-direction: column;
}
/* each condition sits in its own card → clear separation + breathing room */
.node.is-cond {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--bg-surface);
}
/* connector between siblings, with the combinator on a short rail */
.op-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0;
  padding-left: 6px;
}
.op-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: color-mix(in srgb, var(--accent) 30%, var(--border));
}
.op-divider span {
  display: inline-grid;
  place-items: center;
  min-width: 34px;
  padding: 2px 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: color-mix(in srgb, var(--accent) 75%, var(--text));
  border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  font-size: var(--fs-xs);
  font-weight: 800;
  letter-spacing: 0.04em;
}
.grp-empty {
  font-size: var(--fs-sm);
  color: var(--muted);
  padding: 10px 2px;
}

.grp-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.addbtn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 13px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--bg-surface);
  color: var(--text);
  font-size: var(--fs-xs);
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
}
.addbtn:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  color: color-mix(in srgb, var(--accent) 80%, var(--text));
}
.addbtn.primary {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-surface));
  color: color-mix(in srgb, var(--accent) 82%, var(--text));
}
</style>
