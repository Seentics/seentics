/**
 * Automation condition evaluator.
 * Supports full boolean tree (AND / OR / NOT) with all operators from the spec.
 */

export type Operator =
  | 'equals' | 'notEquals'
  | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual'
  | 'contains' | 'notContains' | 'startsWith' | 'endsWith' | 'matches'
  | 'isSet' | 'isNotSet' | 'isTrue' | 'isFalse'
  | 'in' | 'notIn'
  // Legacy operators from the old system
  | 'eq' | 'neq' | 'gt' | 'lt' | 'regex';

export type Rule = {
  fact: string;
  operator: Operator;
  value?: unknown;
  // legacy fields
  field?: string;
  op?: string;
};

export type ConditionGroup = {
  operator: 'AND' | 'OR' | 'NOT';
  rules: Array<Rule | ConditionGroup>;
};

export type Conditions = ConditionGroup | Rule[];

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function applyOperator(value: unknown, op: Operator | string, expected: unknown): boolean {
  switch (op) {
    case 'equals': case 'eq':
      // eslint-disable-next-line eqeqeq
      return value == expected || String(value) === String(expected);
    case 'notEquals': case 'neq':
      // eslint-disable-next-line eqeqeq
      return value != expected && String(value) !== String(expected);
    case 'greaterThan': case 'gt':
      return Number(value) > Number(expected);
    case 'lessThan': case 'lt':
      return Number(value) < Number(expected);
    case 'greaterThanOrEqual':
      return Number(value) >= Number(expected);
    case 'lessThanOrEqual':
      return Number(value) <= Number(expected);
    case 'contains':
      return value != null && String(value).toLowerCase().includes(String(expected).toLowerCase());
    case 'notContains':
      return value == null || !String(value).toLowerCase().includes(String(expected).toLowerCase());
    case 'startsWith':
      return value != null && String(value).startsWith(String(expected));
    case 'endsWith':
      return value != null && String(value).endsWith(String(expected));
    case 'matches': case 'regex': {
      try { return value != null && new RegExp(String(expected)).test(String(value)); }
      catch { return false; }
    }
    case 'isSet':
      return value != null && value !== '';
    case 'isNotSet':
      return value == null || value === '';
    case 'isTrue':
      return value === true || value === 'true' || value === 1;
    case 'isFalse':
      return value === false || value === 'false' || value === 0;
    case 'in':
      return Array.isArray(expected) && expected.includes(value);
    case 'notIn':
      return !Array.isArray(expected) || !expected.includes(value);
    default:
      return true;
  }
}

function evalRule(rule: Rule, context: Record<string, unknown>): boolean {
  const factPath = rule.fact ?? rule.field ?? '';
  const op = (rule.operator ?? rule.op ?? 'equals') as Operator;
  const value = getNestedValue(context, factPath);
  return applyOperator(value, op, rule.value);
}

export function evaluateConditions(
  conditions: Conditions | null | undefined,
  context: Record<string, unknown>,
): boolean {
  if (!conditions) return true;

  // Legacy flat array format: every rule must pass (implicit AND)
  if (Array.isArray(conditions)) {
    return conditions.every((rule) => evalRule(rule as Rule, context));
  }

  const group = conditions as ConditionGroup;
  const { operator, rules } = group;
  if (!rules || rules.length === 0) return true;

  if (operator === 'NOT') {
    const first = rules[0];
    if (!first) return true;
    if ('fact' in first || 'field' in first) return !evalRule(first as Rule, context);
    return !evaluateConditions(first as ConditionGroup, context);
  }

  const evaluate = (r: Rule | ConditionGroup): boolean => {
    if ('fact' in r || 'field' in r) return evalRule(r as Rule, context);
    return evaluateConditions(r as ConditionGroup, context);
  };

  if (operator === 'OR') return rules.some(evaluate);
  return rules.every(evaluate); // AND (default)
}
