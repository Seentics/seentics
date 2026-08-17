/**
 * Retention's contract with the modules that own the data it deletes.
 *
 * Retention owns the policy; each module owns the deletion of its own rows.
 */
export type {
  RetentionCutoffs,
  RetentionOptions,
  RetentionPurge,
  RetentionTarget,
} from "./retention.interface";
