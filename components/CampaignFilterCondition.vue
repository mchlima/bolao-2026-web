<script setup lang="ts">
import type { AudienceCondition, AudienceField, Team } from '~/types/api';
import { FIELD_DEFS, fieldDef, newCondition } from '~/utils/audience';

// One leaf condition. Mutates the node in place (reactive from the parent tree).
const props = defineProps<{ node: AudienceCondition }>();
const emit = defineEmits<{ remove: [] }>();

// Provided by the wizard: resolved team names + a register hook (so the review
// step and chips can show names instead of ids).
const teams = inject<{ names: Record<string, string>; register: (t: Team) => void }>('campaignTeams', {
  names: {},
  register: () => {},
});

const def = computed(() => fieldDef(props.node.field));

function onFieldChange(e: Event) {
  const field = (e.target as HTMLSelectElement).value as AudienceField;
  const fresh = newCondition(field);
  props.node.field = fresh.field;
  props.node.operator = fresh.operator;
  props.node.value = fresh.value;
}

// team value = single id in an array
const teamId = computed(() => (Array.isArray(props.node.value) ? (props.node.value[0] as string) : ''));
function pickTeam(t: Team) {
  teams.register(t);
  props.node.value = [t.id];
}
function clearTeam() {
  props.node.value = [];
}

// tz value = single tz string in an array
const tz = computed({
  get: () => (Array.isArray(props.node.value) ? (props.node.value[0] as string) || '' : ''),
  set: (v: string) => {
    props.node.value = v ? [v] : [];
  },
});

// boolean value
const boolVal = computed({
  get: () => (props.node.value === false ? 'false' : 'true'),
  set: (v: string) => {
    props.node.value = v === 'true';
  },
});

// date value (YYYY-MM-DD)
const dateVal = computed({
  get: () => (typeof props.node.value === 'string' ? props.node.value.slice(0, 10) : ''),
  set: (v: string) => {
    props.node.value = v;
  },
});
</script>

<template>
  <div class="cond">
    <select class="input cond-field" :value="node.field" @change="onFieldChange">
      <option v-for="f in FIELD_DEFS" :key="f.field" :value="f.field">{{ f.label }}</option>
    </select>

    <select v-if="def.operators.length > 1" v-model="node.operator" class="input cond-op">
      <option v-for="o in def.operators" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <span v-else class="cond-op-static">{{ def.operators[0].label }}</span>

    <!-- value -->
    <div class="cond-val">
      <template v-if="def.input === 'team'">
        <span v-if="teamId" class="cond-chip">
          {{ teams.names[teamId] || 'time selecionado' }}
          <button type="button" class="cond-x" @click="clearTeam">×</button>
        </span>
        <TeamPicker v-else clear-on-select placeholder="Buscar time…" @select="pickTeam" />
      </template>

      <select v-else-if="def.input === 'boolean'" v-model="boolVal" class="input">
        <option value="true">sim</option>
        <option value="false">não</option>
      </select>

      <select v-else-if="def.input === 'role'" v-model="node.value" class="input">
        <option value="USER">comum</option>
        <option value="ADMIN">admin</option>
      </select>

      <TimezonePicker v-else-if="def.input === 'tz'" v-model="tz" />

      <input v-else-if="def.input === 'date'" v-model="dateVal" type="date" class="input" />
    </div>

    <button type="button" class="cond-remove" title="Remover condição" @click="emit('remove')">
      <AppIcon name="close" :size="15" :stroke="2.2" />
    </button>
  </div>
</template>

<style scoped>
.cond {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.cond-field { flex: 0 0 auto; min-width: 150px; }
.cond-op { flex: 0 0 auto; min-width: 90px; }
.cond-op-static { font-size: 13px; color: var(--muted); font-weight: 600; }
.cond-val { flex: 1 1 200px; min-width: 180px; }
.cond-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 6px 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-base);
  font-size: 13px;
  font-weight: 700;
}
.cond-x {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: color-mix(in srgb, var(--muted) 20%, transparent);
  color: var(--text);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.cond-remove {
  flex: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-base);
  color: var(--muted);
  cursor: pointer;
}
.cond-remove:hover { color: var(--scarlet); border-color: color-mix(in srgb, var(--scarlet) 40%, var(--border)); }
</style>
