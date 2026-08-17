import { describe, it, expect } from "bun:test";
import { evaluateConditions } from "../../../lib/automations/condition-evaluator";
import type { Conditions, Rule, ConditionGroup } from "../../../lib/automations/condition-evaluator";

// ─── null / undefined → true ──────────────────────────────────────────────────

describe("evaluateConditions – null / undefined", () => {
  it("returns true for null conditions", () => {
    expect(evaluateConditions(null, {})).toBe(true);
  });

  it("returns true for undefined conditions", () => {
    expect(evaluateConditions(undefined, {})).toBe(true);
  });
});

// ─── flat array (implicit AND) ─────────────────────────────────────────────────

describe("evaluateConditions – flat array (implicit AND)", () => {
  it("returns true for empty array", () => {
    expect(evaluateConditions([], {})).toBe(true);
  });

  it("returns true when all rules pass", () => {
    const conditions: Rule[] = [
      { fact: "age", operator: "greaterThan", value: 18 },
      { fact: "active", operator: "isTrue" },
    ];
    expect(evaluateConditions(conditions, { age: 25, active: true })).toBe(true);
  });

  it("returns false when any rule fails", () => {
    const conditions: Rule[] = [
      { fact: "age", operator: "greaterThan", value: 18 },
      { fact: "active", operator: "isTrue" },
    ];
    expect(evaluateConditions(conditions, { age: 25, active: false })).toBe(false);
  });

  it("uses dot-notation to access nested context values", () => {
    const conditions: Rule[] = [{ fact: "user.role", operator: "equals", value: "admin" }];
    expect(evaluateConditions(conditions, { user: { role: "admin" } })).toBe(true);
  });
});

// ─── AND group ────────────────────────────────────────────────────────────────

describe("evaluateConditions – AND group", () => {
  it("returns true when all rules pass", () => {
    const cond: ConditionGroup = {
      operator: "AND",
      rules: [
        { fact: "x", operator: "equals", value: 1 },
        { fact: "y", operator: "equals", value: 2 },
      ],
    };
    expect(evaluateConditions(cond, { x: 1, y: 2 })).toBe(true);
  });

  it("returns false when any rule fails", () => {
    const cond: ConditionGroup = {
      operator: "AND",
      rules: [
        { fact: "x", operator: "equals", value: 1 },
        { fact: "y", operator: "equals", value: 99 },
      ],
    };
    expect(evaluateConditions(cond, { x: 1, y: 2 })).toBe(false);
  });

  it("returns true for empty rules", () => {
    expect(evaluateConditions({ operator: "AND", rules: [] }, {})).toBe(true);
  });

  it("supports nested AND groups", () => {
    const inner: ConditionGroup = {
      operator: "AND",
      rules: [{ fact: "a", operator: "isTrue" }],
    };
    const outer: ConditionGroup = {
      operator: "AND",
      rules: [inner, { fact: "b", operator: "isTrue" }],
    };
    expect(evaluateConditions(outer, { a: true, b: true })).toBe(true);
    expect(evaluateConditions(outer, { a: true, b: false })).toBe(false);
  });
});

// ─── OR group ─────────────────────────────────────────────────────────────────

describe("evaluateConditions – OR group", () => {
  it("returns true when at least one rule passes", () => {
    const cond: ConditionGroup = {
      operator: "OR",
      rules: [
        { fact: "x", operator: "equals", value: 1 },
        { fact: "y", operator: "equals", value: 99 },
      ],
    };
    expect(evaluateConditions(cond, { x: 1, y: 2 })).toBe(true);
  });

  it("returns false when no rules pass", () => {
    const cond: ConditionGroup = {
      operator: "OR",
      rules: [
        { fact: "x", operator: "equals", value: 99 },
        { fact: "y", operator: "equals", value: 100 },
      ],
    };
    expect(evaluateConditions(cond, { x: 1, y: 2 })).toBe(false);
  });

  it("returns true for empty rules", () => {
    expect(evaluateConditions({ operator: "OR", rules: [] }, {})).toBe(true);
  });
});

// ─── NOT group ────────────────────────────────────────────────────────────────

describe("evaluateConditions – NOT group", () => {
  it("negates a passing rule", () => {
    const cond: ConditionGroup = {
      operator: "NOT",
      rules: [{ fact: "active", operator: "isTrue" }],
    };
    expect(evaluateConditions(cond, { active: true })).toBe(false);
  });

  it("negates a failing rule", () => {
    const cond: ConditionGroup = {
      operator: "NOT",
      rules: [{ fact: "active", operator: "isTrue" }],
    };
    expect(evaluateConditions(cond, { active: false })).toBe(true);
  });

  it("returns true for empty NOT rules", () => {
    expect(evaluateConditions({ operator: "NOT", rules: [] }, {})).toBe(true);
  });

  it("can negate a nested group", () => {
    const inner: ConditionGroup = {
      operator: "AND",
      rules: [{ fact: "x", operator: "equals", value: 1 }],
    };
    const outer: ConditionGroup = { operator: "NOT", rules: [inner] };
    expect(evaluateConditions(outer, { x: 1 })).toBe(false);
    expect(evaluateConditions(outer, { x: 2 })).toBe(true);
  });
});

// ─── Individual operators ──────────────────────────────────────────────────────

function rule(fact: string, operator: string, value?: unknown): Conditions {
  return [{ fact, operator: operator as Rule["operator"], value }];
}

describe("operator: equals / eq", () => {
  it("equals: matches by loose equality and string coercion", () => {
    expect(evaluateConditions(rule("v", "equals", "hello"), { v: "hello" })).toBe(true);
    expect(evaluateConditions(rule("v", "equals", 1), { v: "1" })).toBe(true);
    expect(evaluateConditions(rule("v", "equals", "hello"), { v: "world" })).toBe(false);
  });

  it("eq (legacy): same behavior", () => {
    expect(evaluateConditions(rule("v", "eq", 42), { v: 42 })).toBe(true);
    expect(evaluateConditions(rule("v", "eq", 42), { v: 43 })).toBe(false);
  });
});

describe("operator: notEquals / neq", () => {
  it("notEquals: true when values differ", () => {
    expect(evaluateConditions(rule("v", "notEquals", "a"), { v: "b" })).toBe(true);
    expect(evaluateConditions(rule("v", "notEquals", "a"), { v: "a" })).toBe(false);
  });

  it("neq (legacy): same behavior", () => {
    expect(evaluateConditions(rule("v", "neq", 1), { v: 2 })).toBe(true);
  });
});

describe("operator: greaterThan / lessThan / greaterThanOrEqual / lessThanOrEqual", () => {
  it("greaterThan: true when value > expected", () => {
    expect(evaluateConditions(rule("n", "greaterThan", 5), { n: 10 })).toBe(true);
    expect(evaluateConditions(rule("n", "greaterThan", 5), { n: 5 })).toBe(false);
    expect(evaluateConditions(rule("n", "greaterThan", 5), { n: 3 })).toBe(false);
  });

  it("gt (legacy): same behavior", () => {
    expect(evaluateConditions(rule("n", "gt", 5), { n: 10 })).toBe(true);
  });

  it("lessThan: true when value < expected", () => {
    expect(evaluateConditions(rule("n", "lessThan", 5), { n: 3 })).toBe(true);
    expect(evaluateConditions(rule("n", "lessThan", 5), { n: 5 })).toBe(false);
  });

  it("lt (legacy): same behavior", () => {
    expect(evaluateConditions(rule("n", "lt", 5), { n: 3 })).toBe(true);
  });

  it("greaterThanOrEqual: true when value >= expected", () => {
    expect(evaluateConditions(rule("n", "greaterThanOrEqual", 5), { n: 5 })).toBe(true);
    expect(evaluateConditions(rule("n", "greaterThanOrEqual", 5), { n: 6 })).toBe(true);
    expect(evaluateConditions(rule("n", "greaterThanOrEqual", 5), { n: 4 })).toBe(false);
  });

  it("lessThanOrEqual: true when value <= expected", () => {
    expect(evaluateConditions(rule("n", "lessThanOrEqual", 5), { n: 5 })).toBe(true);
    expect(evaluateConditions(rule("n", "lessThanOrEqual", 5), { n: 4 })).toBe(true);
    expect(evaluateConditions(rule("n", "lessThanOrEqual", 5), { n: 6 })).toBe(false);
  });
});

describe("operator: contains / notContains", () => {
  it("contains: case-insensitive substring match", () => {
    expect(evaluateConditions(rule("s", "contains", "ell"), { s: "Hello" })).toBe(true);
    expect(evaluateConditions(rule("s", "contains", "xyz"), { s: "Hello" })).toBe(false);
    expect(evaluateConditions(rule("s", "contains", "ELL"), { s: "hello" })).toBe(true);
  });

  it("contains: null value → false", () => {
    expect(evaluateConditions(rule("s", "contains", "a"), { s: null })).toBe(false);
  });

  it("notContains: true when not present", () => {
    expect(evaluateConditions(rule("s", "notContains", "xyz"), { s: "Hello" })).toBe(true);
    expect(evaluateConditions(rule("s", "notContains", "ell"), { s: "Hello" })).toBe(false);
  });

  it("notContains: null value → true (not set, so not containing)", () => {
    expect(evaluateConditions(rule("s", "notContains", "a"), { s: null })).toBe(true);
  });
});

describe("operator: startsWith / endsWith", () => {
  it("startsWith: true when value starts with expected", () => {
    expect(evaluateConditions(rule("s", "startsWith", "He"), { s: "Hello" })).toBe(true);
    expect(evaluateConditions(rule("s", "startsWith", "lo"), { s: "Hello" })).toBe(false);
  });

  it("endsWith: true when value ends with expected", () => {
    expect(evaluateConditions(rule("s", "endsWith", "lo"), { s: "Hello" })).toBe(true);
    expect(evaluateConditions(rule("s", "endsWith", "He"), { s: "Hello" })).toBe(false);
  });
});

describe("operator: matches / regex", () => {
  it("matches: applies regex to value", () => {
    expect(evaluateConditions(rule("s", "matches", "^hello"), { s: "hello world" })).toBe(true);
    expect(evaluateConditions(rule("s", "matches", "^world"), { s: "hello world" })).toBe(false);
  });

  it("regex (legacy): same behavior", () => {
    expect(evaluateConditions(rule("s", "regex", "\\d+"), { s: "abc123" })).toBe(true);
  });

  it("blocks pattern longer than 200 chars (ReDoS guard)", () => {
    const longPattern = "a".repeat(201);
    expect(evaluateConditions(rule("s", "matches", longPattern), { s: "aaa" })).toBe(false);
  });

  it("blocks patterns with nested quantifiers (ReDoS guard)", () => {
    expect(evaluateConditions(rule("s", "matches", "(a+)+"), { s: "aaa" })).toBe(false);
    expect(evaluateConditions(rule("s", "matches", "a**"), { s: "aaa" })).toBe(false);
  });
});

describe("operator: isSet / isNotSet", () => {
  it("isSet: true when value is non-null and non-empty", () => {
    expect(evaluateConditions(rule("v", "isSet"), { v: "hello" })).toBe(true);
    expect(evaluateConditions(rule("v", "isSet"), { v: 0 })).toBe(true);
    expect(evaluateConditions(rule("v", "isSet"), { v: "" })).toBe(false);
    expect(evaluateConditions(rule("v", "isSet"), { v: null })).toBe(false);
    expect(evaluateConditions(rule("v", "isSet"), {})).toBe(false);
  });

  it("isNotSet: inverse of isSet", () => {
    expect(evaluateConditions(rule("v", "isNotSet"), { v: "" })).toBe(true);
    expect(evaluateConditions(rule("v", "isNotSet"), {})).toBe(true);
    expect(evaluateConditions(rule("v", "isNotSet"), { v: "hello" })).toBe(false);
  });
});

describe("operator: isTrue / isFalse", () => {
  it("isTrue: matches true, 'true', 1", () => {
    expect(evaluateConditions(rule("v", "isTrue"), { v: true })).toBe(true);
    expect(evaluateConditions(rule("v", "isTrue"), { v: "true" })).toBe(true);
    expect(evaluateConditions(rule("v", "isTrue"), { v: 1 })).toBe(true);
    expect(evaluateConditions(rule("v", "isTrue"), { v: false })).toBe(false);
  });

  it("isFalse: matches false, 'false', 0", () => {
    expect(evaluateConditions(rule("v", "isFalse"), { v: false })).toBe(true);
    expect(evaluateConditions(rule("v", "isFalse"), { v: "false" })).toBe(true);
    expect(evaluateConditions(rule("v", "isFalse"), { v: 0 })).toBe(true);
    expect(evaluateConditions(rule("v", "isFalse"), { v: true })).toBe(false);
  });
});

describe("operator: in / notIn", () => {
  it("in: true when value is in the expected array", () => {
    expect(evaluateConditions(rule("v", "in", ["a", "b", "c"]), { v: "b" })).toBe(true);
    expect(evaluateConditions(rule("v", "in", ["a", "b", "c"]), { v: "d" })).toBe(false);
  });

  it("in: false when expected is not an array", () => {
    expect(evaluateConditions(rule("v", "in", "abc"), { v: "a" })).toBe(false);
  });

  it("notIn: true when value is NOT in the array", () => {
    expect(evaluateConditions(rule("v", "notIn", ["a", "b"]), { v: "c" })).toBe(true);
    expect(evaluateConditions(rule("v", "notIn", ["a", "b"]), { v: "a" })).toBe(false);
  });

  it("notIn: true when expected is not an array", () => {
    expect(evaluateConditions(rule("v", "notIn", null), { v: "a" })).toBe(true);
  });
});

// ─── Nested context paths ──────────────────────────────────────────────────────

describe("nested context (dot-notation fact)", () => {
  it("accesses deeply nested values", () => {
    const cond: Rule[] = [{ fact: "a.b.c", operator: "equals", value: 42 }];
    expect(evaluateConditions(cond, { a: { b: { c: 42 } } })).toBe(true);
    expect(evaluateConditions(cond, { a: { b: { c: 0 } } })).toBe(false);
  });

  it("returns undefined when path does not exist", () => {
    const cond: Rule[] = [{ fact: "a.b.missing", operator: "isSet" }];
    expect(evaluateConditions(cond, { a: { b: {} } })).toBe(false);
  });
});
