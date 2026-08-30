/**
 * The automations tests' view of the shared database fake.
 *
 * See the note in the analytics counterpart: one shared implementation, because Bun's
 * mock registry only lets one of them win.
 */
export * from "../../../../app/tests/helpers/fake-db";
