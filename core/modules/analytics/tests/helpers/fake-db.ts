/**
 * The analytics tests' view of the shared database fake.
 *
 * A re-export rather than its own implementation: `mock.module` is process-global and a
 * module namespace materialises once, so two independent fakes meant whichever module's
 * tests ran second linked against the other's and failed on a missing table export.
 */
export * from "../../../../app/tests/helpers/fake-db";
