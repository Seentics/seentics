/**
 * Usage reporting's contract with the modules whose rows it counts.
 *
 * This layer owns the report shape and resolves the scope; each module owns counting.
 */
export type { UsageCounter, UsageScope } from "./usage.interface";
