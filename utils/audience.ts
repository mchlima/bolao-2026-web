import type {
  AudienceCondition,
  AudienceField,
  AudienceGroup,
  AudienceNode,
} from '~/types/api';

export interface OperatorOpt {
  value: string;
  label: string;
}
export interface FieldDef {
  field: AudienceField;
  label: string;
  input: 'team' | 'boolean' | 'role' | 'tz' | 'date';
  operators: OperatorOpt[];
  defaultValue: unknown;
}

// The attributes/behaviours the audience filter can target (v1).
export const FIELD_DEFS: FieldDef[] = [
  {
    field: 'followsTeam',
    label: 'Segue o time',
    input: 'team',
    operators: [
      { value: 'any', label: 'segue' },
      { value: 'none', label: 'não segue' },
    ],
    defaultValue: [],
  },
  {
    field: 'role',
    label: 'Papel',
    input: 'role',
    operators: [
      { value: 'eq', label: 'é' },
      { value: 'neq', label: 'não é' },
    ],
    defaultValue: 'USER',
  },
  {
    field: 'isActive',
    label: 'Conta ativa',
    input: 'boolean',
    operators: [{ value: 'eq', label: 'é' }],
    defaultValue: true,
  },
  {
    field: 'pushEnabled',
    label: 'Push ativado',
    input: 'boolean',
    operators: [{ value: 'eq', label: 'é' }],
    defaultValue: true,
  },
  {
    field: 'inPool',
    label: 'Participa de bolão',
    input: 'boolean',
    operators: [{ value: 'eq', label: 'é' }],
    defaultValue: true,
  },
  {
    field: 'hasPredicted',
    label: 'Já palpitou',
    input: 'boolean',
    operators: [{ value: 'eq', label: 'é' }],
    defaultValue: true,
  },
  {
    field: 'timezone',
    label: 'Fuso horário',
    input: 'tz',
    operators: [
      { value: 'in', label: 'é' },
      { value: 'notin', label: 'não é' },
    ],
    defaultValue: [],
  },
  {
    field: 'createdAt',
    label: 'Cadastro',
    input: 'date',
    operators: [
      { value: 'after', label: 'depois de' },
      { value: 'before', label: 'antes de' },
    ],
    defaultValue: '',
  },
];

export function fieldDef(field: AudienceField): FieldDef {
  return FIELD_DEFS.find((f) => f.field === field) ?? FIELD_DEFS[0];
}

export function isAudienceGroup(node: AudienceNode): node is AudienceGroup {
  return (node as AudienceGroup).op === 'and' || (node as AudienceGroup).op === 'or';
}

export function newCondition(field: AudienceField = 'followsTeam'): AudienceCondition {
  const d = fieldDef(field);
  const v = d.defaultValue;
  return { field, operator: d.operators[0].value, value: Array.isArray(v) ? [...v] : v };
}

export function newGroup(op: 'and' | 'or' = 'and'): AudienceGroup {
  return { op, children: [newCondition()] };
}

// Stable v-for key per node object reference (so removing/reordering children
// keeps each row's local state). Not serialized — lives only in this WeakMap.
let _seq = 0;
const _keys = new WeakMap<object, number>();
export function keyOf(node: object): number {
  let k = _keys.get(node);
  if (k == null) {
    k = ++_seq;
    _keys.set(node, k);
  }
  return k;
}

/** Human-readable summary of a filter tree (for the review step). */
export function describeNode(node: AudienceNode, teamNames: Record<string, string> = {}): string {
  if (isAudienceGroup(node)) {
    if (!node.children.length) return '(vazio)';
    const sep = node.op === 'or' ? ' OU ' : ' E ';
    const parts = node.children.map((c) => describeNode(c, teamNames));
    return node.children.length > 1 ? `(${parts.join(sep)})` : parts[0];
  }
  const d = fieldDef(node.field);
  const opLabel = d.operators.find((o) => o.value === node.operator)?.label ?? node.operator;
  return `${d.label} ${opLabel} ${describeValue(node, teamNames)}`.trim();
}

function describeValue(c: AudienceCondition, teamNames: Record<string, string>): string {
  const d = fieldDef(c.field);
  switch (d.input) {
    case 'team': {
      const ids = Array.isArray(c.value) ? (c.value as string[]) : [];
      return ids.map((id) => teamNames[id] ?? 'time').join(', ');
    }
    case 'boolean':
      return c.value === false ? 'não' : 'sim';
    case 'role':
      return c.value === 'ADMIN' ? 'admin' : 'comum';
    case 'tz': {
      const tzs = Array.isArray(c.value) ? (c.value as string[]) : [];
      return tzs.join(', ');
    }
    case 'date':
      return typeof c.value === 'string' && c.value
        ? new Date(c.value).toLocaleDateString('pt-BR')
        : '—';
    default:
      return '';
  }
}

export const CAMPAIGN_STATUS: Record<
  string,
  { label: string; tone: 'azure' | 'gold' | 'neutral' | 'emerald' | 'scarlet' }
> = {
  DRAFT: { label: 'Rascunho', tone: 'neutral' },
  SCHEDULED: { label: 'Agendada', tone: 'azure' },
  SENDING: { label: 'Enviando', tone: 'gold' },
  SENT: { label: 'Enviada', tone: 'emerald' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
  FAILED: { label: 'Falhou', tone: 'scarlet' },
};
